import { resolve } from "node:path";
import { ExitCode, HarnessError } from "../../common/errors/index.js";
import { realFsAdapter, type FsAdapter } from "../../external/fs-adapter.js";
import { resolveResourcesDir } from "../../external/resources-root.js";
import type { AstPatchDecl, AstPatchSelector } from "../fragment/types.js";
import type { MigrationManifest, PlaybookMigration, AddSlotAction, AddFileAction } from "./types.js";

function getMigrationsRoot(): string {
  return resolveResourcesDir("migrations");
}

/**
 * `resources/migrations/<from>-to-<to>.json` 을 로드.
 *
 * @throws HarnessError — 파일 없음 / 파싱 실패 / 필수 필드 누락
 */
export function loadManifest(
  fromVersion: string,
  toVersion: string,
  fs: FsAdapter = realFsAdapter,
): MigrationManifest {
  const root = getMigrationsRoot();
  const path = resolve(root, `${fromVersion}-to-${toVersion}.json`);

  if (!fs.exists(path)) {
    throw new HarnessError(
      `migration manifest not found: ${fromVersion} → ${toVersion}`,
      ExitCode.UserInputError,
      "trellis upgrade 는 인접 minor 만 지원합니다. 단계적으로 업그레이드하세요.",
    );
  }

  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFile(path));
  } catch {
    throw new HarnessError(
      `migration manifest invalid JSON: ${fromVersion}-to-${toVersion}.json`,
      ExitCode.GeneralError,
    );
  }

  return parseManifest(raw, fromVersion, toVersion);
}

/**
 * 사용 가능한 모든 manifest 의 (from, to) 쌍 목록.
 */
export function listManifests(
  fs: FsAdapter = realFsAdapter,
): readonly { from: string; to: string }[] {
  const root = getMigrationsRoot();
  if (!fs.exists(root) || !fs.isDirectory(root)) return [];
  return fs
    .listDir(root)
    .filter((f) => f.endsWith(".json") && !f.startsWith("schema"))
    .map((f) => {
      const match = /^(\d+\.\d+\.\d+)-to-(\d+\.\d+\.\d+)\.json$/.exec(f);
      if (!match) return undefined;
      return { from: match[1]!, to: match[2]! };
    })
    .filter((x): x is { from: string; to: string } => x !== undefined);
}

function parseManifest(
  raw: unknown,
  expectedFrom: string,
  expectedTo: string,
): MigrationManifest {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new HarnessError(
      "migration manifest invalid: not an object",
      ExitCode.GeneralError,
    );
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj["from"] !== "string" || obj["from"].length === 0) {
    throw new HarnessError(
      "migration manifest invalid: missing or non-string 'from'",
      ExitCode.GeneralError,
    );
  }
  if (typeof obj["to"] !== "string" || obj["to"].length === 0) {
    throw new HarnessError(
      "migration manifest invalid: missing or non-string 'to'",
      ExitCode.GeneralError,
    );
  }

  if (obj["from"] !== expectedFrom) {
    throw new HarnessError(
      `migration manifest mismatch: expected from="${expectedFrom}", got "${obj["from"]}"`,
      ExitCode.GeneralError,
    );
  }
  if (obj["to"] !== expectedTo) {
    throw new HarnessError(
      `migration manifest mismatch: expected to="${expectedTo}", got "${obj["to"]}"`,
      ExitCode.GeneralError,
    );
  }

  if (
    obj["playbooks"] === null ||
    typeof obj["playbooks"] !== "object" ||
    Array.isArray(obj["playbooks"])
  ) {
    throw new HarnessError(
      "migration manifest invalid: 'playbooks' must be an object",
      ExitCode.GeneralError,
    );
  }

  const playbooksRaw = obj["playbooks"] as Record<string, unknown>;
  const playbooks: Record<string, PlaybookMigration> = {};

  for (const [playbookId, playbookRaw] of Object.entries(playbooksRaw)) {
    playbooks[playbookId] = parsePlaybookMigration(playbookRaw, playbookId);
  }

  return {
    from: obj["from"],
    to: obj["to"],
    playbooks,
  };
}

function parsePlaybookMigration(raw: unknown, playbookId: string): PlaybookMigration {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new HarnessError(
      `migration manifest invalid: playbook "${playbookId}" must be an object`,
      ExitCode.GeneralError,
    );
  }

  const obj = raw as Record<string, unknown>;
  const result: {
    addSlots?: readonly AddSlotAction[];
    addFiles?: readonly AddFileAction[];
    astPatches?: readonly AstPatchDecl[];
  } = {};

  if (obj["addSlots"] !== undefined) {
    if (!Array.isArray(obj["addSlots"])) {
      throw new HarnessError(
        `migration manifest invalid: playbook "${playbookId}".addSlots must be an array`,
        ExitCode.GeneralError,
      );
    }
    result.addSlots = obj["addSlots"].map((item: unknown, i: number) =>
      parseAddSlotAction(item, playbookId, i),
    );
  }

  if (obj["addFiles"] !== undefined) {
    if (!Array.isArray(obj["addFiles"])) {
      throw new HarnessError(
        `migration manifest invalid: playbook "${playbookId}".addFiles must be an array`,
        ExitCode.GeneralError,
      );
    }
    result.addFiles = obj["addFiles"].map((item: unknown, i: number) =>
      parseAddFileAction(item, playbookId, i),
    );
  }

  if (obj["astPatches"] !== undefined) {
    if (!Array.isArray(obj["astPatches"])) {
      throw new HarnessError(
        `migration manifest invalid: playbook "${playbookId}".astPatches must be an array`,
        ExitCode.GeneralError,
      );
    }
    result.astPatches = obj["astPatches"].map((item: unknown, i: number) =>
      parseAstPatchActionForMigration(item, playbookId, i),
    );
  }

  return result;
}

function parseAstPatchActionForMigration(
  raw: unknown,
  playbookId: string,
  index: number,
): AstPatchDecl {
  const context = `playbook "${playbookId}".astPatches[${index}]`;
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new HarnessError(
      `migration manifest invalid: ${context} must be an object`,
      ExitCode.GeneralError,
    );
  }
  const obj = raw as Record<string, unknown>;

  if (typeof obj["file"] !== "string" || obj["file"].length === 0) {
    throw new HarnessError(
      `migration manifest invalid: ${context}.file must be a non-empty string`,
      ExitCode.GeneralError,
    );
  }
  if (typeof obj["entryKey"] !== "string" || obj["entryKey"].length === 0) {
    throw new HarnessError(
      `migration manifest invalid: ${context}.entryKey must be a non-empty string`,
      ExitCode.GeneralError,
    );
  }
  if (typeof obj["content"] !== "string") {
    throw new HarnessError(
      `migration manifest invalid: ${context}.content must be a string`,
      ExitCode.GeneralError,
    );
  }

  const selRaw = obj["selector"];
  if (selRaw === null || typeof selRaw !== "object" || Array.isArray(selRaw)) {
    throw new HarnessError(
      `migration manifest invalid: ${context}.selector must be an object`,
      ExitCode.GeneralError,
    );
  }
  const sel = selRaw as Record<string, unknown>;
  let selector: AstPatchSelector;
  if (sel["type"] === "arrayPush" && typeof sel["target"] === "string") {
    selector = { type: "arrayPush", target: sel["target"] };
  } else if (
    sel["type"] === "objectKey" &&
    typeof sel["target"] === "string" &&
    typeof sel["key"] === "string"
  ) {
    selector = { type: "objectKey", target: sel["target"], key: sel["key"] };
  } else if (sel["type"] === "importAdd" && typeof sel["from"] === "string") {
    selector = { type: "importAdd", from: sel["from"] };
  } else {
    throw new HarnessError(
      `migration manifest invalid: ${context}.selector has unknown shape`,
      ExitCode.GeneralError,
    );
  }

  return {
    file: obj["file"],
    selector,
    entryKey: obj["entryKey"],
    content: obj["content"],
  };
}

function parseAddSlotAction(raw: unknown, playbookId: string, index: number): AddSlotAction {
  const context = `playbook "${playbookId}".addSlots[${index}]`;

  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new HarnessError(
      `migration manifest invalid: ${context} must be an object`,
      ExitCode.GeneralError,
    );
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj["file"] !== "string" || obj["file"].length === 0) {
    throw new HarnessError(
      `migration manifest invalid: ${context}.file must be a non-empty string`,
      ExitCode.GeneralError,
    );
  }
  if (typeof obj["slot"] !== "string" || obj["slot"].length === 0) {
    throw new HarnessError(
      `migration manifest invalid: ${context}.slot must be a non-empty string`,
      ExitCode.GeneralError,
    );
  }
  if (typeof obj["afterLine"] !== "string" || obj["afterLine"].length === 0) {
    throw new HarnessError(
      `migration manifest invalid: ${context}.afterLine must be a non-empty string`,
      ExitCode.GeneralError,
    );
  }
  if (obj["indent"] !== undefined && typeof obj["indent"] !== "string") {
    throw new HarnessError(
      `migration manifest invalid: ${context}.indent must be a string`,
      ExitCode.GeneralError,
    );
  }

  return {
    file: obj["file"],
    slot: obj["slot"],
    afterLine: obj["afterLine"],
    ...(obj["indent"] !== undefined ? { indent: obj["indent"] as string } : {}),
  };
}

function parseAddFileAction(raw: unknown, playbookId: string, index: number): AddFileAction {
  const context = `playbook "${playbookId}".addFiles[${index}]`;

  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new HarnessError(
      `migration manifest invalid: ${context} must be an object`,
      ExitCode.GeneralError,
    );
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj["path"] !== "string" || obj["path"].length === 0) {
    throw new HarnessError(
      `migration manifest invalid: ${context}.path must be a non-empty string`,
      ExitCode.GeneralError,
    );
  }
  if (typeof obj["content"] !== "string") {
    throw new HarnessError(
      `migration manifest invalid: ${context}.content must be a string`,
      ExitCode.GeneralError,
    );
  }

  return {
    path: obj["path"],
    content: obj["content"],
  };
}
