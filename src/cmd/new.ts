import { resolve } from "node:path";
import type { Command } from "commander";
import { ExitCode, HarnessError } from "../common/errors/index.js";
import {
  buildProjectSpec,
  displayMatchMode,
  type Answer,
  type MatchResult,
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

const TRELLIS_VERSION = "0.0.0";

export function registerNewCommand(program: Command): void {
  program
    .command("new <projectName>")
    .description(
      "Run the harness interview and emit a ProjectSpec JSON. P1: no files generated yet.",
    )
    .action(async (projectName: string) => {
      await runNew(projectName, new InquirerPrompter());
    });
}

export async function runNew(
  projectName: string,
  prompter: Prompter,
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
  process.stdout.write(JSON.stringify(spec, null, 2) + "\n");
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

// Suppress unused warning for the Answer type re-export pattern (used in
// implicit return-type inference of runNew when called from cmd/index.ts).
export type { Answer };
