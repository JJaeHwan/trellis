import {
  select,
  input,
  confirm as inquirerConfirm,
} from "@inquirer/prompts";
import { FREEFORM_OPTION_ID, type Question } from "../../domain/index.js";
import type { Prompter, SelectedAnswer } from "./prompter.js";

interface Choice {
  name: string;
  value: string;
  description?: string;
}

export class InquirerPrompter implements Prompter {
  async selectOption(
    question: Question,
    recommendation?: string,
  ): Promise<SelectedAnswer> {
    const choices: Choice[] = question.options.map((opt) => {
      const star = opt.id === recommendation ? "  ⭐" : "";
      const choice: Choice = {
        name: `${opt.id}. ${opt.label}${star}`,
        value: opt.id,
      };
      if (opt.description) choice.description = opt.description;
      return choice;
    });

    if (question.allowFreeform) {
      choices.push({
        name: "D. 기타 (직접 입력)",
        value: FREEFORM_OPTION_ID,
        description: "위 옵션에 없는 답변을 자유롭게 입력합니다.",
      });
    }

    const optionId = await select({
      message: `[${question.id}] ${question.label}`,
      choices,
      default: recommendation,
    });

    if (optionId === FREEFORM_OPTION_ID) {
      const freeformNote = await input({
        message: "기타 답변을 입력해주세요:",
        validate: (v: string): true | string =>
          v.trim().length > 0 || "내용을 입력하세요.",
      });
      return { optionId: FREEFORM_OPTION_ID, freeformNote: freeformNote.trim() };
    }

    return { optionId };
  }

  async confirm(message: string, defaultValue = false): Promise<boolean> {
    return inquirerConfirm({ message, default: defaultValue });
  }
}
