import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildProjectSpec, type Answer } from "../../src/domain/index.js";
import { loadAllPlaybooks } from "../../src/external/index.js";
import { matchPlaybooks } from "../../src/service/matcher/index.js";

const here = dirname(fileURLToPath(import.meta.url));

const PLAYBOOK_IDS = ["cli-tool", "b2b-saas", "ai-rag-platform"] as const;

interface StrippedSpec {
  projectName: string;
  playbookId: string;
  matchMode: string;
  matchScore: number;
  answers: ReadonlyArray<Answer>;
  placeholders: Readonly<Record<string, string>>;
}

describe.each(PLAYBOOK_IDS)(
  "golden — %s recommended path",
  (playbookId) => {
    it("matches the recorded ProjectSpec when answers follow recommendations", () => {
      const playbooks = loadAllPlaybooks();
      const target = playbooks.find((p) => p.id === playbookId);
      if (!target) throw new Error(`${playbookId} playbook missing`);

      const answers: Answer[] = Object.entries(target.recommendations).map(
        ([questionId, optionId]) => ({ questionId, selectedOptionId: optionId }),
      );

      const matchResult = matchPlaybooks(answers, playbooks);
      expect(matchResult.mode).toBe("exact");
      expect(matchResult.primary.id).toBe(playbookId);

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

      const goldenPath = resolve(here, `${playbookId}.spec.json`);
      const expected = JSON.parse(readFileSync(goldenPath, "utf-8")) as StrippedSpec;
      expect(stripped).toEqual(expected);
    });
  },
);
