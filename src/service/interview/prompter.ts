import type { Question } from "../../domain/index.js";

export interface SelectedAnswer {
  optionId: string;
  freeformNote?: string;
}

/**
 * 인터뷰 단계에서 사용자 입력을 수집하는 추상 인터페이스.
 *
 * 실 구현체는 inquirer-prompter.ts (TTY 사용자 입력).
 * 테스트에서는 fake 구현체를 주입.
 */
export interface Prompter {
  selectOption(question: Question, recommendation?: string): Promise<SelectedAnswer>;
  confirm(message: string, defaultValue?: boolean): Promise<boolean>;
}
