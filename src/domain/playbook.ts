/**
 * 플레이북 도메인 모델 — 매처 입력 스펙 + 매칭 결과.
 *
 * 변환 규칙: 내부(TS 유니온)는 lowercase, 외부(사람 읽는 출력)는 Capitalize.
 * 모든 표시 변환은 이 모듈의 displayMatchMode 함수만 사용한다.
 */

export type MatchMode = "exact" | "close" | "hybrid" | "new";

export const MATCH_MODES: readonly MatchMode[] = [
  "exact",
  "close",
  "hybrid",
  "new",
] as const;

/** 한 질문에 대한 옵션별 점수 (0..1). */
export interface PlaybookScoringRule {
  readonly questionId: string;
  /** option id → score (0..1). 누락 옵션은 0 점 처리. */
  readonly scores: Readonly<Record<string, number>>;
  readonly comment?: string;
}

export interface PlaybookScoring {
  /** 평균 점수가 이 값 이상이면 exact. */
  readonly exactThreshold: number;
  /** exactThreshold 미만이지만 이 값 이상이면 close. */
  readonly closeThreshold: number;
  readonly rules: readonly PlaybookScoringRule[];
}

export interface Playbook {
  readonly id: string;
  readonly title: string;
  readonly version: number;
  readonly description?: string;
  /** 원본 메서돌로지 MD 의 상대 경로. */
  readonly sourceMd: string;
  /** question id → 추천 option id. */
  readonly recommendations: Readonly<Record<string, string>>;
  /** 추천 이유 (사람용 설명, optional). */
  readonly recommendationReasons?: Readonly<Record<string, string>>;
  readonly scoring: PlaybookScoring;
}

/** doctor 의 향후 동기화 검사용 메타. */
export interface PlaybookMeta {
  readonly id: string;
  readonly sourceMd: string;
  /** SHA-256 hex of the source MD content. */
  readonly sourceMdHash: string;
  readonly lastSyncedAt: string;
  readonly trellisVersion: string;
}

export interface MatchResult {
  readonly mode: MatchMode;
  readonly primary: Playbook;
  readonly secondary?: Playbook;
  /** primary 에 대한 평균 점수 (0..1). */
  readonly score: number;
  /** close / hybrid 모드에서 노출할 차이점. */
  readonly diff: readonly string[];
}

/** "exact" → "Exact". CLI 사용자 출력에서만 사용. */
export function displayMatchMode(mode: MatchMode): string {
  return mode[0]!.toUpperCase() + mode.slice(1);
}
