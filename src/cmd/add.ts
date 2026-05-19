import { resolve } from "node:path";
import { input, select } from "@inquirer/prompts";
import type { Command } from "commander";
import { ExitCode, HarnessError } from "../common/errors/index.js";
import type { ProjectSpec } from "../domain/index.js";
import { listFragmentTypes, loadSpec } from "../external/index.js";
import {
  buildFragmentContext,
  loadFragment,
  patchPackageJson,
  renderFragment,
} from "../service/fragment/index.js";
import type { PatchResult } from "../service/fragment/index.js";
import { realFsAdapter, type FsAdapter } from "../external/fs-adapter.js";
import type { VirtualTree } from "../domain/index.js";

/** `^[a-zA-Z][a-zA-Z0-9-_]*$` */
const NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9\-_]*$/;

interface AddOptions {
  force?: boolean;
}

export function registerAddCommand(program: Command): void {
  program
    .command("add [type] [name]")
    .description(
      "기존 trellis 프로젝트에 플레이북 fragment 를 추가합니다. (예: trellis add api users)",
    )
    .option("--force", "기존 파일을 덮어씁니다")
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

  // 1. spec.json 확인
  const spec = loadSpec(projectDir, fs);
  if (spec === undefined) {
    throw new HarnessError(
      "이 디렉토리는 trellis 프로젝트가 아닙니다 (.trellis/spec.json 없음). `trellis new` 로 시작하세요.",
      ExitCode.UserInputError,
    );
  }

  // 2. type 결정 (인자 없으면 인터랙티브)
  const type = await resolveType(typeArg, spec, fs);

  // 3. name 결정 (인자 없으면 인터랙티브)
  const name = await resolveName(nameArg);

  // 4. fragment 로드
  const fragment = loadFragment(spec.playbookId, type, fs);

  // 5. 렌더링
  const context = buildFragmentContext(name, spec.placeholders);
  const tree = renderFragment(fragment, context);

  // 6. 충돌 확인 후 쓰기
  writeTree(tree, projectDir, options, fs);

  // 7. package.json dep merge (package.json 없으면 skip)
  const pkgPath = resolve(projectDir, "package.json");
  if (fs.exists(pkgPath)) {
    const depResult = patchPackageJson(projectDir, fragment.meta, fs);
    printDepResult(depResult);
  }

  // 8. 성공 출력
  printSuccess(tree);
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
    );
  }

  return select({
    message: "추가할 fragment 타입을 선택하세요:",
    choices: types.map((t) => ({ value: t, name: t })),
  });
}

async function resolveName(nameArg: string | undefined): Promise<string> {
  if (nameArg !== undefined && nameArg.length > 0) {
    validateName(nameArg);
    return nameArg;
  }

  if (!process.stdin.isTTY) {
    throw new HarnessError(
      "name 인자가 필요합니다 (비-TTY 환경에서는 인터랙티브 입력 불가).",
      ExitCode.UserInputError,
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

function validateName(name: string): void {
  if (!NAME_PATTERN.test(name)) {
    throw new HarnessError(
      `유효하지 않은 이름: "${name}". 알파벳으로 시작하고 알파벳/숫자/대시/언더스코어만 사용하세요.`,
      ExitCode.UserInputError,
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

function printDepResult(result: PatchResult): void {
  if (result.added.length > 0) {
    process.stdout.write(`Added dependencies: ${result.added.join(", ")}\n`);
  }
  for (const conflict of result.conflicts) {
    process.stderr.write(
      `⚠ Skipped (version conflict): ${conflict.name} (have ${conflict.existing}, fragment wants ${conflict.requested})\n`,
    );
  }
}
