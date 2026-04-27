import { describe, expect, it } from "vitest";
import { matchPlaybooks } from "./score-matcher.js";
import type { Answer, Playbook } from "../../domain/index.js";

const cliToolPlaybook: Playbook = {
  id: "cli-tool",
  title: "CLI Tool",
  version: 1,
  sourceMd: "test.md",
  recommendations: { "1": "B", "2": "B" },
  scoring: {
    exactThreshold: 0.85,
    closeThreshold: 0.6,
    rules: [
      { questionId: "1", scores: { A: 0.9, B: 1.0, C: 0.5 } },
      { questionId: "2", scores: { A: 1.0, B: 1.0, C: 0.7 } },
    ],
  },
};

describe("matchPlaybooks", () => {
  it("returns exact when answers maximise the only playbook's score", () => {
    const answers: Answer[] = [
      { questionId: "1", selectedOptionId: "B" },
      { questionId: "2", selectedOptionId: "B" },
    ];
    const result = matchPlaybooks(answers, [cliToolPlaybook]);

    expect(result.mode).toBe("exact");
    expect(result.primary.id).toBe("cli-tool");
    expect(result.score).toBeCloseTo(1.0);
    expect(result.diff).toEqual([]);
  });

  it("returns close when score lands between close and exact threshold", () => {
    const answers: Answer[] = [
      { questionId: "1", selectedOptionId: "C" }, // 0.5
      { questionId: "2", selectedOptionId: "C" }, // 0.7
    ];
    const result = matchPlaybooks(answers, [cliToolPlaybook]);

    expect(result.mode).toBe("close");
    expect(result.score).toBeCloseTo(0.6);
    expect(result.diff.length).toBeGreaterThan(0);
  });

  it("returns new when score is below closeThreshold", () => {
    const lowScorePlaybook: Playbook = {
      ...cliToolPlaybook,
      scoring: {
        ...cliToolPlaybook.scoring,
        rules: [
          { questionId: "1", scores: { A: 0.0, B: 0.1, C: 0.0 } },
          { questionId: "2", scores: { A: 0.0, B: 0.1, C: 0.0 } },
        ],
      },
    };
    const answers: Answer[] = [
      { questionId: "1", selectedOptionId: "B" },
      { questionId: "2", selectedOptionId: "B" },
    ];
    const result = matchPlaybooks(answers, [lowScorePlaybook]);

    expect(result.mode).toBe("new");
  });

  it("computes diff entries only for diverged answers", () => {
    const answers: Answer[] = [
      { questionId: "1", selectedOptionId: "A" }, // recommended B → diverged
      { questionId: "2", selectedOptionId: "B" }, // recommended B → match
    ];
    const result = matchPlaybooks(answers, [cliToolPlaybook]);

    expect(result.diff).toContain("Q1: 추천 B, 선택 A");
    expect(result.diff.some((s) => s.startsWith("Q2"))).toBe(false);
  });

  it("returns exact when best score leads second by more than parity gap", () => {
    // cli-tool with A,A: 0.9+1.0=1.9/2 = 0.95
    // weakAlt  with A,A: 0.5+0.5=1.0/2 = 0.50  → gap 0.45 (>> 0.10)
    const weakAlt: Playbook = {
      ...cliToolPlaybook,
      id: "weak-alt",
      title: "Weak Alt",
      scoring: {
        ...cliToolPlaybook.scoring,
        rules: [
          { questionId: "1", scores: { A: 0.5, B: 0.5, C: 0.5 } },
          { questionId: "2", scores: { A: 0.5, B: 0.5, C: 0.5 } },
        ],
      },
    };
    const answers: Answer[] = [
      { questionId: "1", selectedOptionId: "A" },
      { questionId: "2", selectedOptionId: "A" },
    ];
    const result = matchPlaybooks(answers, [cliToolPlaybook, weakAlt]);

    expect(result.mode).toBe("exact");
    expect(result.primary.id).toBe("cli-tool");
    expect(result.secondary?.id).toBe("weak-alt");
  });

  it("returns hybrid when two playbooks score within parity gap", () => {
    // cli-tool   with A,A: 0.9+1.0=1.9/2  = 0.95
    // closeAlt   with A,A: 0.92+1.0=1.92/2 = 0.96  → gap 0.01 (< 0.10)
    const closeAlt: Playbook = {
      ...cliToolPlaybook,
      id: "close-alt",
      title: "Close Alt",
      scoring: {
        ...cliToolPlaybook.scoring,
        rules: [
          { questionId: "1", scores: { A: 0.92, B: 1.0, C: 0.5 } },
          { questionId: "2", scores: { A: 1.0, B: 1.0, C: 0.5 } },
        ],
      },
    };
    const answers: Answer[] = [
      { questionId: "1", selectedOptionId: "A" },
      { questionId: "2", selectedOptionId: "A" },
    ];
    const result = matchPlaybooks(answers, [cliToolPlaybook, closeAlt]);

    expect(result.mode).toBe("hybrid");
    // primary is the higher-scoring one (close-alt)
    expect(result.primary.id).toBe("close-alt");
    expect(result.secondary?.id).toBe("cli-tool");
  });

  it("throws when no playbooks provided", () => {
    expect(() => matchPlaybooks([], [])).toThrow();
  });
});
