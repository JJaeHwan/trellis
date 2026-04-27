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

const TRELLIS_VERSION = "0.0.0";

interface NewOptions {
  dryRun?: boolean;
  force?: boolean;
}

export function registerNewCommand(program: Command): void {
  program
    .command("new <projectName>")
    .description("Run the harness interview and scaffold a new project.")
    .option("--dry-run", "Emit ProjectSpec JSON without writing files")
    .option(
      "--force",
      "Allow writing into a non-empty target directory (overwrites)",
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
  validateProjectName(projectName);
  if (!process.stdin.isTTY) {
    throw new HarnessError(
      "trellis new 는 TTY 가 필요합니다 (대화형 인터뷰).",
      ExitCode.UserInputError,
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

  const proceed = await prompter.confirm("이대로 진행할까요?", true);
  if (!proceed) {
    process.stderr.write("취소됨.\n");
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
  printSuccess(spec, tree.length);
}

function validateProjectName(name: string): void {
  if (!name || /[\\/\s]/.test(name)) {
    throw new HarnessError(
      `잘못된 프로젝트 이름: "${name}". 알파벳/숫자/대시/언더스코어만 사용하세요.`,
      ExitCode.UserInputError,
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
