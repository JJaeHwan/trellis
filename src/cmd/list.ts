import type { Command } from "commander";
import { ExitCode, HarnessError } from "../common/errors/index.js";
import { listFragmentTypes, loadSpec } from "../external/index.js";
import { loadFragment } from "../service/fragment/index.js";
import { realFsAdapter, type FsAdapter } from "../external/fs-adapter.js";

interface ListOptions {
  json?: boolean;
}

export type ListJsonResult =
  | {
      readonly ok: true;
      readonly command: "list";
      readonly playbookId: string;
      readonly types: readonly string[];
    }
  | {
      readonly ok: true;
      readonly command: "list";
      readonly playbookId: string;
      readonly fragmentType: string;
      readonly description: string;
      readonly files: readonly string[];
      readonly patches: readonly { file: string; slot: string; entryKey: string }[];
      readonly dependencies: Readonly<Record<string, string>>;
    }
  | {
      readonly ok: false;
      readonly command: "list";
      readonly error: {
        readonly code: number;
        readonly message: string;
        readonly hint?: string;
      };
    };

export function registerListCommand(program: Command): void {
  program
    .command("list [type]")
    .description(
      "사용 가능한 fragment 타입 목록, 또는 특정 fragment 의 상세 정보를 출력합니다.",
    )
    .option("--json", "출력을 JSON 객체로 표준 출력 (사람용 메시지는 stderr 로 이동)")
    .action(async (type: string | undefined, options: ListOptions) => {
      await runList(type, options);
    });
}

export async function runList(
  typeArg: string | undefined,
  options: ListOptions = {},
  fs: FsAdapter = realFsAdapter,
  projectDir: string = process.cwd(),
): Promise<void> {
  const jsonMode = options.json === true;

  try {
    await runListInner(typeArg, options, fs, projectDir, jsonMode);
  } catch (err) {
    if (jsonMode && err instanceof HarnessError) {
      const result: ListJsonResult = {
        ok: false,
        command: "list",
        error: {
          code: err.exitCode,
          message: err.message,
          ...(err.hint !== undefined ? { hint: err.hint } : {}),
        },
      };
      process.stdout.write(JSON.stringify(result) + "\n");
      process.stderr.write(`${err.message}\n`);
      if (err.hint !== undefined) {
        process.stderr.write(`→ ${err.hint}\n`);
      }
      process.exit(err.exitCode);
    }
    throw err;
  }
}

async function runListInner(
  typeArg: string | undefined,
  _options: ListOptions,
  fs: FsAdapter,
  projectDir: string,
  jsonMode: boolean,
): Promise<void> {
  const spec = loadSpec(projectDir, fs);
  if (spec === undefined) {
    throw new HarnessError(
      "이 디렉토리는 trellis 프로젝트가 아닙니다 (.trellis/spec.json 없음). `trellis new` 로 시작하세요.",
      ExitCode.UserInputError,
      "trellis new <디렉토리> 로 프로젝트를 먼저 생성하세요.",
    );
  }

  if (typeArg === undefined || typeArg.length === 0) {
    // 목록 모드
    const types = listFragmentTypes(spec.playbookId, fs);

    if (jsonMode) {
      const result: ListJsonResult = {
        ok: true,
        command: "list",
        playbookId: spec.playbookId,
        types,
      };
      process.stdout.write(JSON.stringify(result) + "\n");
    } else {
      printTypes(spec.playbookId, types);
    }
  } else {
    // 상세 모드
    const fragment = loadFragment(spec.playbookId, typeArg, fs);
    const files = fragment.templates.map((t) => t.sourcePath);
    const patches = (fragment.meta.patches ?? []).map((p) => ({
      file: p.file,
      slot: p.slot,
      entryKey: p.entryKey,
    }));
    const dependencies: Record<string, string> = {
      ...fragment.meta.dependencies,
      ...fragment.meta.devDependencies,
    };

    if (jsonMode) {
      const result: ListJsonResult = {
        ok: true,
        command: "list",
        playbookId: spec.playbookId,
        fragmentType: typeArg,
        description: fragment.meta.description,
        files,
        patches,
        dependencies,
      };
      process.stdout.write(JSON.stringify(result) + "\n");
    } else {
      printDetail(typeArg, fragment.meta.description, files, patches, dependencies);
    }
  }
}

function printTypes(playbookId: string, types: readonly string[]): void {
  const isTTY = process.stdout.isTTY === true;
  if (isTTY) {
    process.stdout.write(`Fragment types for playbook "${playbookId}":\n`);
  } else {
    process.stdout.write(`Fragment types for playbook "${playbookId}":\n`);
  }
  if (types.length === 0) {
    process.stdout.write("  (none)\n");
    return;
  }
  for (const t of types) {
    process.stdout.write(`  ${t}\n`);
  }
}

function printDetail(
  type: string,
  description: string,
  files: readonly string[],
  patches: readonly { file: string; slot: string; entryKey: string }[],
  dependencies: Readonly<Record<string, string>>,
): void {
  process.stdout.write(`Fragment: ${type}\n`);
  process.stdout.write(`Description: ${description}\n`);

  process.stdout.write("\nFiles:\n");
  if (files.length === 0) {
    process.stdout.write("  (none)\n");
  } else {
    for (const f of files) {
      process.stdout.write(`  ${f}\n`);
    }
  }

  process.stdout.write("\nPatches:\n");
  if (patches.length === 0) {
    process.stdout.write("  (none)\n");
  } else {
    for (const p of patches) {
      process.stdout.write(`  ${p.file} (slot: ${p.slot}, entryKey: ${p.entryKey})\n`);
    }
  }

  const depEntries = Object.entries(dependencies);
  if (depEntries.length > 0) {
    process.stdout.write("\nDependencies:\n");
    for (const [name, version] of depEntries) {
      process.stdout.write(`  ${name}: ${version}\n`);
    }
  }
}
