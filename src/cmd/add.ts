import { resolve } from "node:path";
import { input, select } from "@inquirer/prompts";
import Handlebars from "handlebars";
import type { Command } from "commander";
import { ExitCode, HarnessError } from "../common/errors/index.js";
import type { ProjectSpec } from "../domain/index.js";
import { listFragmentTypes, loadSpec } from "../external/index.js";
import {
  applyPatches,
  buildFragmentContext,
  loadFragment,
  patchPackageJson,
  renderFragment,
} from "../service/fragment/index.js";
import type { DepPatchResult, PatchResult } from "../service/fragment/index.js";
import { registerHelpers } from "../service/generator/handlebars-helpers.js";
import { realFsAdapter, type FsAdapter } from "../external/fs-adapter.js";
import type { VirtualTree } from "../domain/index.js";

/** `^[a-zA-Z][a-zA-Z0-9-_]*$` */
const NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9\-_]*$/;

interface AddOptions {
  force?: boolean;
  verbose?: boolean;
  json?: boolean;
}

/**
 * JSON mode 의 성공/실패 결과 스키마.
 */
export type AddJsonResult = {
  readonly ok: boolean;
  readonly command: "add";
  readonly playbookId?: string;
  readonly fragmentType?: string;
  readonly name?: string;
  readonly created?: readonly string[];
  readonly patches?: {
    readonly applied: readonly { file: string; slot: string; entryKey: string }[];
    readonly skipped: readonly { file: string; slot: string; entryKey: string }[];
  };
  readonly dependencies?: {
    readonly added: readonly string[];
    readonly skipped: readonly string[];
    readonly conflicts: readonly { name: string; existing: string; requested: string }[];
  };
  readonly error?: {
    readonly code: number;
    readonly message: string;
    readonly hint?: string;
  };
};

/**
 * Handlebars 컴파일러 (helpers 등록) — 단순 문자열 치환용.
 */
function renderHandlebars(template: string, context: Record<string, string>): string {
  const hbs = Handlebars.create();
  registerHelpers(hbs);
  return hbs.compile(template, { noEscape: true })(context);
}

export function registerAddCommand(program: Command): void {
  program
    .command("add [type] [name]")
    .description(
      "기존 trellis 프로젝트에 플레이북 fragment 를 추가합니다. (예: trellis add api users)",
    )
    .option("--force", "기존 파일을 덮어씁니다")
    .option("--verbose", "스킵된 patch 도 표시합니다")
    .option("--json", "출력을 JSON 객체로 표준 출력 (사람용 메시지는 stderr 로 이동)")
    .action(async (type: string | undefined, name: string | undefined, options: AddOptions) => {
      await runAdd(type, name, options);
    });
}

export async function runAdd(
  typeArg: string | undefined,
  nameArg: string | undefined,
  options: AddOptions = {},
  fs: FsAdapter = realFsAdapter,
  projectDir: string = process.cwd(),
): Promise<void> {
  const jsonMode = options.json === true;

  try {
    await runAddInner(typeArg, nameArg, options, fs, projectDir, jsonMode);
  } catch (err) {
    if (jsonMode && err instanceof HarnessError) {
      const result: AddJsonResult = {
        ok: false,
        command: "add",
        error: {
          code: err.exitCode,
          message: err.message,
          ...(err.hint !== undefined ? { hint: err.hint } : {}),
        },
      };
      process.stdout.write(JSON.stringify(result) + "\n");
      // stderr 에 사람용 메시지
      process.stderr.write(`${err.message}\n`);
      if (err.hint !== undefined) {
        process.stderr.write(`→ ${err.hint}\n`);
      }
      process.exit(err.exitCode);
    }
    // non-json mode — re-throw for cmd/index.ts to handle
    throw err;
  }
}

async function runAddInner(
  typeArg: string | undefined,
  nameArg: string | undefined,
  options: AddOptions,
  fs: FsAdapter,
  projectDir: string,
  jsonMode: boolean,
): Promise<void> {

  // 1. spec.json 확인
  const spec = loadSpec(projectDir, fs);
  if (spec === undefined) {
    throw new HarnessError(
      "이 디렉토리는 trellis 프로젝트가 아닙니다 (.trellis/spec.json 없음). `trellis new` 로 시작하세요.",
      ExitCode.UserInputError,
      "trellis new <디렉토리> 로 프로젝트를 먼저 생성하세요.",
    );
  }

  // 2. type 결정 (인자 없으면 인터랙티브)
  const type = await resolveType(typeArg, spec, fs);

  // 3. name 결정 (인자 없으면 인터랙티브)
  const name = await resolveName(nameArg, spec.playbookId, type);

  // 4. fragment 로드
  const fragment = loadFragment(spec.playbookId, type, fs);

  // 5. 렌더링
  const context = buildFragmentContext(name, spec.placeholders);
  const tree = renderFragment(fragment, context);

  // 6. 충돌 확인 후 쓰기
  writeTree(tree, projectDir, options, fs);

  // 7. package.json dep merge (package.json 없으면 skip)
  let depResult: DepPatchResult | undefined;
  const pkgPath = resolve(projectDir, "package.json");
  if (fs.exists(pkgPath)) {
    depResult = patchPackageJson(projectDir, fragment.meta, fs);
    if (!jsonMode) {
      printDepResult(depResult);
    }
  }

  // 8. patches 적용 (fragment.meta.patches 가 있을 때만)
  let patchResult: PatchResult | undefined;
  if (fragment.meta.patches !== undefined && fragment.meta.patches.length > 0) {
    const renderedPatches = fragment.meta.patches.map((p) => ({
      file: renderHandlebars(p.file, context),
      slot: p.slot,
      entryKey: renderHandlebars(p.entryKey, context),
      content: renderHandlebars(p.content, context),
    }));
    patchResult = applyPatches(projectDir, renderedPatches, fs);
    if (!jsonMode) {
      printPatchResult(patchResult, options.verbose ?? false);
    }
  }

  // 9. 성공 출력
  if (jsonMode) {
    const created = tree.map((f) => f.path);
    const patchApplied = (patchResult?.applied ?? []).map((p) => ({
      file: p.file,
      slot: p.slot,
      entryKey: p.entryKey,
    }));
    const patchSkipped = options.verbose
      ? (patchResult?.skipped ?? []).map((p) => ({
          file: p.file,
          slot: p.slot,
          entryKey: p.entryKey,
        }))
      : [];

    const result: AddJsonResult = {
      ok: true,
      command: "add",
      playbookId: spec.playbookId,
      fragmentType: type,
      name,
      created,
      patches: {
        applied: patchApplied,
        skipped: patchSkipped,
      },
      ...(depResult !== undefined
        ? {
            dependencies: {
              added: depResult.added,
              skipped: depResult.skipped,
              conflicts: depResult.conflicts,
            },
          }
        : {}),
    };
    process.stdout.write(JSON.stringify(result) + "\n");
  } else {
    printSuccess(tree);
  }
}

async function resolveType(
  typeArg: string | undefined,
  spec: ProjectSpec,
  fs: FsAdapter,
): Promise<string> {
  if (typeArg !== undefined && typeArg.length > 0) {
    return typeArg;
  }

  const types = listFragmentTypes(spec.playbookId, fs);
  if (types.length === 0) {
    throw new HarnessError(
      `플레이북 '${spec.playbookId}' 에 사용 가능한 fragment 타입이 없습니다.`,
      ExitCode.ValidationFailure,
    );
  }

  if (!process.stdin.isTTY) {
    throw new HarnessError(
      "type 인자가 필요합니다 (비-TTY 환경에서는 인터랙티브 선택 불가).",
      ExitCode.UserInputError,
      `trellis add ${types[0] ?? "<type>"} <name> 과 같은 형식으로 호출하세요.`,
    );
  }

  return select({
    message: "추가할 fragment 타입을 선택하세요:",
    choices: types.map((t) => ({ value: t, name: t })),
  });
}

async function resolveName(
  nameArg: string | undefined,
  playbookId: string,
  type: string,
): Promise<string> {
  if (nameArg !== undefined && nameArg.length > 0) {
    validateName(nameArg, playbookId, type);
    return nameArg;
  }

  if (!process.stdin.isTTY) {
    throw new HarnessError(
      "name 인자가 필요합니다 (비-TTY 환경에서는 인터랙티브 입력 불가).",
      ExitCode.UserInputError,
      `trellis add ${type} <name> 과 같은 형식으로 호출하세요.`,
    );
  }

  return input({
    message: "이름을 입력하세요 (예: users, UserProfile):",
    validate(value: string) {
      if (!NAME_PATTERN.test(value)) {
        return `유효하지 않은 이름입니다. 알파벳으로 시작하고 알파벳/숫자/대시/언더스코어만 사용하세요 (${NAME_PATTERN.source})`;
      }
      return true;
    },
  });
}

function validateName(name: string, playbookId: string, type: string): void {
  if (!NAME_PATTERN.test(name)) {
    throw new HarnessError(
      `유효하지 않은 이름: "${name}". 알파벳으로 시작하고 알파벳/숫자/대시/언더스코어만 사용하세요.`,
      ExitCode.UserInputError,
      `trellis add ${type} <name> 와 같은 형식으로 호출하세요. (playbookId: ${playbookId})`,
    );
  }
}

export function checkConflicts(
  tree: VirtualTree,
  projectDir: string,
  fs: FsAdapter,
): string[] {
  const conflicts: string[] = [];
  for (const file of tree) {
    const absPath = resolve(projectDir, file.path);
    if (fs.exists(absPath)) {
      conflicts.push(file.path);
    }
  }
  return conflicts;
}

function writeTree(
  tree: VirtualTree,
  projectDir: string,
  options: AddOptions,
  fs: FsAdapter,
): void {
  const conflicts = checkConflicts(tree, projectDir, fs);

  if (conflicts.length > 0 && !options.force) {
    const list = conflicts.map((p) => `  - ${p}`).join("\n");
    throw new HarnessError(
      `Conflict: 다음 파일이 이미 존재합니다. --force 를 추가하면 덮어씁니다.\n${list}`,
      ExitCode.ValidationFailure,
      "trellis add <type> <name> --force 로 덮어쓸 수 있습니다.",
    );
  }

  if (conflicts.length > 0 && options.force) {
    const list = conflicts.map((p) => `  - ${p}`).join("\n");
    process.stderr.write(`Warning: --force 로 덮어쓰는 파일:\n${list}\n`);
  }

  for (const file of tree) {
    const absPath = resolve(projectDir, file.path);
    const dir = absPath.slice(0, absPath.lastIndexOf("/"));
    fs.ensureDir(dir);
    fs.writeFile(absPath, file.content);
  }
}

function printSuccess(tree: VirtualTree): void {
  process.stdout.write("✓ 생성된 파일:\n");
  for (const file of tree) {
    process.stdout.write(`  ${file.path}\n`);
  }
}

function printDepResult(result: DepPatchResult): void {
  if (result.added.length > 0) {
    process.stdout.write(`Added dependencies: ${result.added.join(", ")}\n`);
  }
  for (const conflict of result.conflicts) {
    process.stderr.write(
      `⚠ Skipped (version conflict): ${conflict.name} (have ${conflict.existing}, fragment wants ${conflict.requested})\n`,
    );
  }
}

function printPatchResult(result: PatchResult, verbose: boolean): void {
  if (result.applied.length > 0) {
    process.stdout.write("Patched files:\n");
    for (const p of result.applied) {
      process.stdout.write(`  - ${p.file} (slot: ${p.slot}, entry: ${p.entryKey})\n`);
    }
  }
  if (verbose && result.skipped.length > 0) {
    process.stdout.write("Skipped patches (already applied):\n");
    for (const p of result.skipped) {
      process.stdout.write(`  - ${p.file} (slot: ${p.slot}, entry: ${p.entryKey})\n`);
    }
  }
}
