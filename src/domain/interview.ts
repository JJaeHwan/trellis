/**
 * 인터뷰 도메인 모델 — 9문항 인터뷰 정의와 답변 표현.
 *
 * 이 모듈은 순수 타입/데이터 정의만 담는다 (L2 domain). I/O 금지.
 */

export interface Option {
  /** "A" | "B" | "C" | ... — 사용자에게 표시되는 단일 문자 식별자. */
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly pros: readonly string[];
  readonly cons: readonly string[];
}

export interface Question {
  /** "1" ~ "9" — interview.json 정의 순서. */
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly options: readonly Option[];
  /** true 이면 "기타 (D)" freeform 답변을 추가로 허용. */
  readonly allowFreeform?: boolean;
}

export interface InterviewDefinition {
  readonly version: number;
  readonly questions: readonly Question[];
}

/** 사용자가 선택한 옵션 식별자. "OTHER" 는 freeform 답변. */
export type SelectedOptionId = string;

export interface Answer {
  readonly questionId: string;
  readonly selectedOptionId: SelectedOptionId;
  /** allowFreeform=true 인 질문에서 "기타" 선택 시 채워진다. */
  readonly freeformNote?: string;
}

/** 매처 / 시리얼라이저가 받는 입력 — 인터뷰 1회 완료 후 묶음. */
export interface InterviewResult {
  readonly definitionVersion: number;
  readonly answers: readonly Answer[];
  /** ISO-8601 타임스탬프. */
  readonly completedAt: string;
}

export const FREEFORM_OPTION_ID = "OTHER" as const;
