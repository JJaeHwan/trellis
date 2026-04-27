import type {
  Answer,
  InterviewDefinition,
  InterviewResult,
} from "../../domain/index.js";
import type { Prompter } from "./prompter.js";

export class InterviewRunner {
  constructor(
    private readonly prompter: Prompter,
    private readonly definition: InterviewDefinition,
  ) {}

  async run(
    playbookRecommendations?: Readonly<Record<string, string>>,
  ): Promise<InterviewResult> {
    const answers: Answer[] = [];
    for (const question of this.definition.questions) {
      const recommendation = playbookRecommendations?.[question.id];
      const { optionId, freeformNote } = await this.prompter.selectOption(
        question,
        recommendation,
      );
      answers.push({
        questionId: question.id,
        selectedOptionId: optionId,
        freeformNote,
      });
    }
    return {
      definitionVersion: this.definition.version,
      answers,
      completedAt: new Date().toISOString(),
    };
  }
}
