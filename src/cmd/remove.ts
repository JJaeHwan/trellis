import { resolve } from "node:path";
import { input, select } from "@inquirer/prompts";
import Handlebars from "handlebars";
import type { Command } from "commander";
import { ExitCode, HarnessError } from "../common/errors/index.js";
import { listFragmentTypes, loadSpec } from "../external/index.js";
import {
  buildFragmentContext,
  loadFragment,
  removeAstPatches,
  removeFiles,
  removePatches,
  renderFragment,
} from "../service/fragment/index.js";
import type {
  AstPatchDecl,
  AstPatchSelector,
  AstUnPatchResult,
  UnPatchResult,
  UnWriteResult,
} from "../service/fragment/index.js";
import { registerHelpers } from "../service/generator/handlebars-helpers.js";
import { realFsAdapter, type FsAdapter } from "../external/fs-adapter.js";
import { realGitChecker, type GitChecker } from "../service/upgrader/git-status.js";
import type { VirtualTree } from "../domain/index.js";

/** `^[a-zA-Z][a-zA-Z0-9-_]*$` */
const NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9\-_]*$/;

interface RemoveOptions {
  force?: boolean;
  verbose?: boolean;
  json?: boolean;
  dryRun?: boolean;
}

/**
 * JSON mode 의 성공/실패 결과 스키마.
 */
export type RemoveJsonResult = {
  readonly ok: boolean;
  readonly command: "remove";
  readonly playbookId?: string;
  readonly fragmentType?: string;
  readonly name?: string;
  readonly removed?: {
    readonly files: readonly string[];
    readonly patches: readonly { file: string; slot: string; entryKey: string }[];
    readonly astPatches: readonly { file: string; selector: AstPatchSelector; entryKey: string }[];
  };
  readonly notFound?: {
    readonly files: readonly string[];
    readonly patches: readonly { file: string; slot: string; entryKey: string }[];
    readonly astPatches: readonly { file: string; selector: AstPatchSelector; entryKey: string }[];
  };
  readonly userModified?: readonly string[];
  readonly dryRun?: boolean;
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

export function registerRemoveCommand(program: Command): void {
  program
    .command("remove [type] [name]")
    .description(
      "trellis 프로젝트에서 플레이북 fragment 를 제거합니다. (예: trellis remove api users)",
    )
    .option("--force", "사용자 수정 파일도 강제 삭제하고, git dirty 검사를 우회합니다")
    .option("--dry-run", "실제 변경 없이 수행 예정 결과만 출력합니다")
    .option("--json", "출력을 JSON 객체로 표준 출력 (사람용 메시지는 stderr 로 이동)")
    .option("--verbose", "notFound 항목도 상세 표시합니다")
    .action(
      async (
        type: string | undefined,
        name: string | undefined,
        options: RemoveOptions,
      ) => {
        await runRemove(type, name, options);
      },
    );
}

export async function runRemove(
  typeArg: string | undefined,
  nameArg: string | undefined,
  options: RemoveOptions = {},
  fs: FsAdapter = realFsAdapter,
  projectDir: string = process.cwd(),
  gitChecker: GitChecker = realGitChecker,
): Promise<void> {
  const jsonMode = options.json === true;

  try {
    await runRemoveInner(typeArg, nameArg, options, fs, projectDir, jsonMode, gitChecker);
  } catch (err) {
    if (jsonMode && err instanceof HarnessError) {
      const result: RemoveJsonResult = {
        ok: false,
        command: "remove",
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

async function runRemoveInner(
  typeArg: string | undefined,
  nameArg: string | undefined,
  options: RemoveOptions,
  fs: FsAdapter,
  projectDir: string,
  jsonMode: boolean,
  gitChecker: GitChecker,
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

  // 4. git working tree clean 검사
  if (!options.force && !options.dryRun) {
    const isClean = gitChecker(projectDir);
    if (!isClean) {
      throw new HarnessError(
        "git working tree dirty. 변경 사항을 commit/stash 하거나 --force 로 우회 가능합니다.",
        ExitCode.ValidationFailure,
        "git status 로 변경사항 확인 후 commit/stash 하거나 --force 사용",
      );
    }
  }

  // 5. fragment 로드 (A1 결정론적 재추론)
  const fragment = loadFragment(spec.playbookId, type, fs);

  // 6. 렌더링
  const context = buildFragmentContext(name, spec.placeholders);
  const tree: VirtualTree = renderFragment(fragment, context);

  // 7. patches Handlebars 렌더
  const renderedPatches =
    fragment.meta.patches !== undefined && fragment.meta.patches.length > 0
      ? fragment.meta.patches.map((p) => ({
          file: renderHandlebars(p.file, context),
          slot: p.slot,
          entryKey: renderHandlebars(p.entryKey, context),
          content: renderHandlebars(p.content, context),
        }))
      : [];

  // 7b. astPatches Handlebars 렌더 (P15)
  const renderedAstPatches: AstPatchDecl[] =
    fragment.meta.astPatches !== undefined && fragment.meta.astPatches.length > 0
      ? fragment.meta.astPatches.map((p) => renderAstPatch(p, context))
      : [];

  // 8. dry-run 처리
  if (options.dryRun === true) {
    printDryRun(
      tree,
      renderedPatches,
      renderedAstPatches,
      projectDir,
      fs,
      jsonMode,
      spec.playbookId,
      type,
      name,
    );
    return;
  }

  // 9. 실 변경: patches → astPatches → 파일 순
  let patchResult: UnPatchResult = { removed: [], notFound: [] };
  if (renderedPatches.length > 0) {
    patchResult = removePatches(projectDir, renderedPatches, fs);
  }

  let astPatchResult: AstUnPatchResult = { removed: [], notFound: [] };
  if (renderedAstPatches.length > 0) {
    astPatchResult = removeAstPatches(projectDir, renderedAstPatches, fs);
  }

  // 10. 파일 삭제 (package.json 은 절대 건드리지 않음 — Q-C C1)
  const filteredTree = tree.filter((f) => f.path !== "package.json");
  const writeResult: UnWriteResult = removeFiles(projectDir, filteredTree, fs, {
    force: options.force,
  });

  // 11. 결과 출력
  if (jsonMode) {
    const result: RemoveJsonResult = {
      ok: true,
      command: "remove",
      playbookId: spec.playbookId,
      fragmentType: type,
      name,
      removed: {
        files: writeResult.removed,
        patches: patchResult.removed.map((p) => ({
          file: p.file,
          slot: p.slot,
          entryKey: p.entryKey,
        })),
        astPatches: astPatchResult.removed.map((p) => ({
          file: p.file,
          selector: p.selector,
          entryKey: p.entryKey,
        })),
      },
      notFound: {
        files: writeResult.notFound,
        patches: patchResult.notFound.map((p) => ({
          file: p.file,
          slot: p.slot,
          entryKey: p.entryKey,
        })),
        astPatches: astPatchResult.notFound.map((p) => ({
          file: p.file,
          selector: p.selector,
          entryKey: p.entryKey,
        })),
      },
      userModified: writeResult.userModified,
      dryRun: false,
    };
    process.stdout.write(JSON.stringify(result) + "\n");
  } else {
    printResult(writeResult, patchResult, astPatchResult, options.verbose ?? false);
  }
}

function renderAstPatch(
  p: AstPatchDecl,
  context: Record<string, string>,
): AstPatchDecl {
  return {
    file: renderHandlebars(p.file, context),
    selector: renderSelector(p.selector, context),
    entryKey: renderHandlebars(p.entryKey, context),
    content: renderHandlebars(p.content, context),
  };
}

function renderSelector(
  sel: AstPatchSelector,
  context: Record<string, string>,
): AstPatchSelector {
  if (sel.type === "arrayPush") {
    return { type: "arrayPush", target: renderHandlebars(sel.target, context) };
  }
  if (sel.type === "objectKey") {
    return {
      type: "objectKey",
      target: renderHandlebars(sel.target, context),
      key: renderHandlebars(sel.key, context),
    };
  }
  return { type: "importAdd", from: renderHandlebars(sel.from, context) };
}

function describeSelector(sel: AstPatchSelector): string {
  if (sel.type === "arrayPush") return `arrayPush:${sel.target}`;
  if (sel.type === "objectKey") return `objectKey:${sel.target}.${sel.key}`;
  return `importAdd:${sel.from}`;
}

function printDryRun(
  tree: VirtualTree,
  renderedPatches: { file: string; slot: string; entryKey: string; content: string }[],
  renderedAstPatches: readonly AstPatchDecl[],
  projectDir: string,
  fs: FsAdapter,
  jsonMode: boolean,
  playbookId: string,
  type: string,
  name: string,
): void {
  // 미리보기: 파일 존재 여부 + 내용 일치 여부 파악
  const wouldRemoveFiles: string[] = [];
  const wouldNotFoundFiles: string[] = [];
  const wouldUserModifiedFiles: string[] = [];

  for (const file of tree) {
    if (file.path === "package.json") continue;
    const absPath = resolve(projectDir, file.path);
    if (!fs.exists(absPath)) {
      wouldNotFoundFiles.push(file.path);
    } else {
      const current = fs.readFile(absPath);
      if (current === file.content) {
        wouldRemoveFiles.push(file.path);
      } else {
        wouldUserModifiedFiles.push(file.path);
      }
    }
  }

  const wouldRemovePatches = renderedPatches.map((p) => ({
    file: p.file,
    slot: p.slot,
    entryKey: p.entryKey,
  }));

  const wouldRemoveAstPatches = renderedAstPatches.map((p) => ({
    file: p.file,
    selector: p.selector,
    entryKey: p.entryKey,
  }));

  if (jsonMode) {
    const result: RemoveJsonResult = {
      ok: true,
      command: "remove",
      playbookId,
      fragmentType: type,
      name,
      removed: {
        files: wouldRemoveFiles,
        patches: wouldRemovePatches,
        astPatches: wouldRemoveAstPatches,
      },
      notFound: {
        files: wouldNotFoundFiles,
        patches: [],
        astPatches: [],
      },
      userModified: wouldUserModifiedFiles,
      dryRun: true,
    };
    process.stdout.write(JSON.stringify(result) + "\n");
  } else {
    process.stdout.write("Dry-run preview — no changes written.\n");
    if (wouldRemoveFiles.length > 0) {
      process.stdout.write("Files to be removed:\n");
      for (const f of wouldRemoveFiles) {
        process.stdout.write(`  - ${f}\n`);
      }
    }
    if (wouldRemovePatches.length > 0) {
      process.stdout.write("Patches to be removed:\n");
      for (const p of wouldRemovePatches) {
        process.stdout.write(`  - ${p.file} (slot: ${p.slot}, entry: ${p.entryKey})\n`);
      }
    }
    if (wouldRemoveAstPatches.length > 0) {
      process.stdout.write("AST patches to be removed:\n");
      for (const p of wouldRemoveAstPatches) {
        process.stdout.write(
          `  - ${p.file} (${describeSelector(p.selector)}, entry: ${p.entryKey})\n`,
        );
      }
    }
    if (wouldNotFoundFiles.length > 0) {
      process.stdout.write("Files not found (already removed):\n");
      for (const f of wouldNotFoundFiles) {
        process.stdout.write(`  - ${f}\n`);
      }
    }
    if (wouldUserModifiedFiles.length > 0) {
      process.stdout.write("Files with user modifications (will be skipped without --force):\n");
      for (const f of wouldUserModifiedFiles) {
        process.stdout.write(`  - ${f}\n`);
      }
    }
  }
}

function printResult(
  writeResult: UnWriteResult,
  patchResult: UnPatchResult,
  astPatchResult: AstUnPatchResult,
  verbose: boolean,
): void {
  if (writeResult.removed.length > 0) {
    process.stdout.write("Removed files:\n");
    for (const f of writeResult.removed) {
      process.stdout.write(`  - ${f}\n`);
    }
  }
  if (patchResult.removed.length > 0) {
    process.stdout.write("Removed patches:\n");
    for (const p of patchResult.removed) {
      process.stdout.write(`  - ${p.file} (slot: ${p.slot}, entry: ${p.entryKey})\n`);
    }
  }
  if (astPatchResult.removed.length > 0) {
    process.stdout.write("Removed AST patches:\n");
    for (const p of astPatchResult.removed) {
      process.stdout.write(
        `  - ${p.file} (${describeSelector(p.selector)}, entry: ${p.entryKey})\n`,
      );
    }
  }
  if (writeResult.userModified.length > 0) {
    process.stderr.write("Warning: skipped user-modified files (use --force to delete):\n");
    for (const f of writeResult.userModified) {
      process.stderr.write(`  - ${f}\n`);
    }
  }
  if (verbose) {
    if (writeResult.notFound.length > 0) {
      process.stdout.write("Files not found (already removed):\n");
      for (const f of writeResult.notFound) {
        process.stdout.write(`  - ${f}\n`);
      }
    }
    if (patchResult.notFound.length > 0) {
      process.stdout.write("Patches not found (already removed):\n");
      for (const p of patchResult.notFound) {
        process.stdout.write(`  - ${p.file} (slot: ${p.slot}, entry: ${p.entryKey})\n`);
      }
    }
    if (astPatchResult.notFound.length > 0) {
      process.stdout.write("AST patches not found (already removed):\n");
      for (const p of astPatchResult.notFound) {
        process.stdout.write(
          `  - ${p.file} (${describeSelector(p.selector)}, entry: ${p.entryKey})\n`,
        );
      }
    }
  }
  if (
    writeResult.removed.length === 0 &&
    patchResult.removed.length === 0 &&
    astPatchResult.removed.length === 0 &&
    writeResult.userModified.length === 0
  ) {
    process.stdout.write("Nothing to remove (fragment not found in project).\n");
  }
}

async function resolveType(
  typeArg: string | undefined,
  spec: { playbookId: string },
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
      `trellis remove ${types[0] ?? "<type>"} <name> 과 같은 형식으로 호출하세요.`,
    );
  }

  return select({
    message: "제거할 fragment 타입을 선택하세요:",
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
      `trellis remove ${type} <name> 과 같은 형식으로 호출하세요.`,
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
      `trellis remove ${type} <name> 와 같은 형식으로 호출하세요. (playbookId: ${playbookId})`,
    );
  }
}
