import { resolve } from "node:path";
import type { Command } from "commander";
import { ExitCode, HarnessError } from "../common/errors/index.js";
import {
  buildProjectSpec,
  displayMatchMode,
  type MatchResult,
  type ProjectSpec,
} from "../domain/index.js";
import {
  loadAllPlaybooks,
  loadInterviewDefinition,
} from "../external/index.js";
import {
  InquirerPrompter,
  InterviewRunner,
  type Prompter,
} from "../service/interview/index.js";
import { matchPlaybooks } from "../service/matcher/index.js";
import { scaffold } from "../service/scaffolder/index.js";

const TRELLIS_VERSION = "0.14.0"; // x-release-please-version

interface NewOptions {
  dryRun?: boolean;
  force?: boolean;
  json?: boolean;
}

/**
 * JSON mode 의 성공/실패 결과 스키마.
 */
export type NewJsonResult = {
  readonly ok: boolean;
  readonly command: "new";
  readonly projectName?: string;
  readonly playbookId?: string;
  readonly matchMode?: string;
  readonly created?: readonly string[];
  readonly trellisVersion?: string;
  readonly error?: {
    readonly code: number;
    readonly message: string;
    readonly hint?: string;
  };
};

export function registerNewCommand(program: Command): void {
  program
    .command("new <projectName>")
    .description("Run the harness interview and scaffold a new project.")
    .option("--dry-run", "Emit ProjectSpec JSON without writing files")
    .option(
      "--force",
      "Allow writing into a non-empty target directory (overwrites)",
    )
    .option(
      "--json",
      "Output result as single JSON line to stdout (interview prompts go to stderr)",
    )
    .action(async (projectName: string, options: NewOptions) => {
      await runNew(projectName, new InquirerPrompter(), options);
    });
}

export async function runNew(
  projectName: string,
  prompter: Prompter,
  options: NewOptions = {},
): Promise<void> {
  const jsonMode = options.json === true;

  try {
    await runNewInner(projectName, prompter, options, jsonMode);
  } catch (err) {
    if (jsonMode && err instanceof HarnessError) {
      const result: NewJsonResult = {
        ok: false,
        command: "new",
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

async function runNewInner(
  projectName: string,
  prompter: Prompter,
  options: NewOptions,
  jsonMode: boolean,
): Promise<void> {
  validateProjectName(projectName);
  if (!process.stdin.isTTY) {
    throw new HarnessError(
      "trellis new 는 TTY 가 필요합니다 (대화형 인터뷰).",
      ExitCode.UserInputError,
      "TTY 환경에서 trellis new <프로젝트명> 을 실행하세요.",
    );
  }

  const definition = loadInterviewDefinition();
  const playbooks = loadAllPlaybooks();
  const initialPlaybook = playbooks[0];
  if (!initialPlaybook) {
    throw new HarnessError(
      "플레이북이 하나도 등록되어 있지 않습니다.",
      ExitCode.GeneralError,
    );
  }

  process.stderr.write(
    `Trellis 인터뷰를 시작합니다 (${definition.questions.length}문항).\n\n`,
  );

  const runner = new InterviewRunner(prompter, definition);
  const interviewResult = await runner.run(initialPlaybook.recommendations);

  const matchResult = matchPlaybooks(interviewResult.answers, playbooks);
  printMatchSummary(matchResult);

  if (matchResult.mode === "new") {
    process.stderr.write(
      `\n⚠ 어떤 플레이북도 충분히 매칭되지 않았습니다 (mode: new).\n` +
        `  가장 가까운 '${matchResult.primary.id}' 플레이북을 출발점으로 사용합니다.\n` +
        `  더 잘 맞는 구조가 필요하면 커스텀 플레이북 작성을 고려하세요.\n`,
    );
  }
  const proceed = await prompter.confirm(
    "이대로 진행할까요?",
    matchResult.mode !== "new",
  );
  if (!proceed) {
    process.stderr.write("취소됨.\n");
    if (jsonMode) {
      const result: NewJsonResult = {
        ok: false,
        command: "new",
        error: {
          code: ExitCode.UserInputError,
          message: "사용자가 취소했습니다.",
        },
      };
      process.stdout.write(JSON.stringify(result) + "\n");
      process.exit(ExitCode.UserInputError);
    }
    return;
  }

  const spec = buildProjectSpec({
    projectName,
    rootPath: resolve(process.cwd(), projectName),
    matchResult,
    answers: interviewResult.answers,
    trellisVersion: TRELLIS_VERSION,
    generatedAt: new Date().toISOString(),
  });

  if (options.dryRun) {
    process.stdout.write(JSON.stringify(spec, null, 2) + "\n");
    return;
  }

  const tree = scaffold(spec, { force: options.force });

  if (jsonMode) {
    const result: NewJsonResult = {
      ok: true,
      command: "new",
      projectName: spec.projectName,
      playbookId: spec.playbookId,
      matchMode: spec.matchMode,
      created: tree.map((f) => f.path),
      trellisVersion: spec.trellisVersion,
    };
    process.stdout.write(JSON.stringify(result) + "\n");
  } else {
    printSuccess(spec, tree.length);
  }
}

function validateProjectName(name: string): void {
  if (!name || /[\\/\s]/.test(name)) {
    throw new HarnessError(
      `잘못된 프로젝트 이름: "${name}". 알파벳/숫자/대시/언더스코어만 사용하세요.`,
      ExitCode.UserInputError,
      `trellis new <프로젝트명> 형식으로 입력하세요. 예: trellis new my-project`,
    );
  }
}

function printMatchSummary(match: MatchResult): void {
  process.stderr.write(`\n매칭 결과: ${displayMatchMode(match.mode)}\n`);
  process.stderr.write(
    `기반 플레이북: ${match.primary.id} (${match.primary.title})\n`,
  );
  process.stderr.write(`점수: ${(match.score * 100).toFixed(1)}%\n`);
  if (match.diff.length > 0) {
    process.stderr.write(`차이점:\n`);
    for (const d of match.diff) {
      process.stderr.write(`  - ${d}\n`);
    }
  }
  process.stderr.write("\n");
}

function printSuccess(spec: ProjectSpec, fileCount: number): void {
  process.stderr.write(`\n✓ ${fileCount} 개 파일 생성 완료\n`);
  process.stderr.write(`  → ${spec.rootPath}\n\n`);
  process.stderr.write(`다음 단계:\n`);
  process.stderr.write(`  cd ${spec.projectName}\n`);
  process.stderr.write(`  npm install\n`);
  process.stderr.write(`  npm run build\n`);
  process.stderr.write(`  ${spec.projectName} hello\n\n`);
}
