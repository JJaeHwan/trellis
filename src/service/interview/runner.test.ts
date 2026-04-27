import { describe, expect, it } from "vitest";
import { InterviewRunner } from "./runner.js";
import type { Prompter } from "./prompter.js";
import type { InterviewDefinition, Question } from "../../domain/index.js";

const fakeDefinition: InterviewDefinition = {
  version: 1,
  questions: [
    {
      id: "1",
      label: "Q1",
      options: [{ id: "A", label: "A1", pros: [], cons: [] }],
    },
    {
      id: "2",
      label: "Q2",
      options: [{ id: "A", label: "A2", pros: [], cons: [] }],
      allowFreeform: true,
    },
  ],
};

class FakePrompter implements Prompter {
  public seenRecommendations: Record<string, string | undefined> = {};

  constructor(
    private readonly answers: Record<
      string,
      { optionId: string; freeformNote?: string }
    >,
  ) {}

  async selectOption(
    question: Question,
    recommendation?: string,
  ): Promise<{ optionId: string; freeformNote?: string }> {
    this.seenRecommendations[question.id] = recommendation;
    const answer = this.answers[question.id];
    if (!answer) throw new Error(`No fake answer for ${question.id}`);
    return answer;
  }

  async confirm(): Promise<boolean> {
    return true;
  }
}

describe("InterviewRunner", () => {
  it("collects answers in question order", async () => {
    const prompter = new FakePrompter({
      "1": { optionId: "A" },
      "2": { optionId: "OTHER", freeformNote: "custom" },
    });
    const runner = new InterviewRunner(prompter, fakeDefinition);
    const result = await runner.run();

    expect(result.answers).toHaveLength(2);
    expect(result.answers[0]).toEqual({
      questionId: "1",
      selectedOptionId: "A",
      freeformNote: undefined,
    });
    expect(result.answers[1]).toEqual({
      questionId: "2",
      selectedOptionId: "OTHER",
      freeformNote: "custom",
    });
    expect(result.definitionVersion).toBe(1);
    expect(result.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("passes per-question playbook recommendation to prompter", async () => {
    const prompter = new FakePrompter({
      "1": { optionId: "A" },
      "2": { optionId: "A" },
    });
    const runner = new InterviewRunner(prompter, fakeDefinition);
    await runner.run({ "1": "A", "2": "OTHER" });

    expect(prompter.seenRecommendations).toEqual({ "1": "A", "2": "OTHER" });
  });

  it("passes undefined recommendation when none provided for a question", async () => {
    const prompter = new FakePrompter({
      "1": { optionId: "A" },
      "2": { optionId: "A" },
    });
    const runner = new InterviewRunner(prompter, fakeDefinition);
    await runner.run({ "1": "A" });

    expect(prompter.seenRecommendations).toEqual({
      "1": "A",
      "2": undefined,
    });
  });
});
