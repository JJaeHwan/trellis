import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildProjectSpec, type Answer } from "../../src/domain/index.js";
import { loadAllPlaybooks } from "../../src/external/index.js";
import { matchPlaybooks } from "../../src/service/matcher/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const goldenPath = resolve(here, "cli-tool.spec.json");

/**
 * 환경에 의존하는 필드(rootPath, generatedAt, trellisVersion)를 제외한
 * 결정론적 부분만 비교한다.
 */
interface StrippedSpec {
  projectName: string;
  playbookId: string;
  matchMode: string;
  matchScore: number;
  answers: ReadonlyArray<Answer>;
  placeholders: Readonly<Record<string, string>>;
}

describe("golden — cli-tool recommended path", () => {
  it("matches the recorded ProjectSpec when answers follow recommendations", () => {
    const playbooks = loadAllPlaybooks();
    const cliTool = playbooks.find((p) => p.id === "cli-tool");
    if (!cliTool) throw new Error("cli-tool playbook missing");

    const answers: Answer[] = Object.entries(cliTool.recommendations).map(
      ([questionId, optionId]) => ({ questionId, selectedOptionId: optionId }),
    );

    const matchResult = matchPlaybooks(answers, playbooks);
    expect(matchResult.mode).toBe("exact");

    const spec = buildProjectSpec({
      projectName: "my-test",
      rootPath: "/fixed/path",
      matchResult,
      answers,
      trellisVersion: "0.0.0-golden",
      generatedAt: "2026-01-01T00:00:00.000Z",
    });

    const stripped: StrippedSpec = {
      projectName: spec.projectName,
      playbookId: spec.playbookId,
      matchMode: spec.matchMode,
      matchScore: spec.matchScore,
      answers: spec.answers,
      placeholders: spec.placeholders,
    };

    const expected = JSON.parse(readFileSync(goldenPath, "utf-8")) as StrippedSpec;
    expect(stripped).toEqual(expected);
  });
});
