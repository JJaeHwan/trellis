/**
 * 프로젝트 명세 — 인터뷰 + 매칭 결과를 묶은 generator 입력.
 *
 * P1 종료 시점에 stdout 으로 직렬화될 최종 산출물.
 */

import type { Answer } from "./interview.js";
import type { MatchMode } from "./playbook.js";

export interface ProjectSpec {
  readonly projectName: string;
  /** 사용자가 지정한 절대/상대 경로. P1 에서는 미사용 (P2 generator 가 사용). */
  readonly rootPath: string;
  readonly playbookId: string;
  readonly matchMode: MatchMode;
  /** 매처 점수 (0..1). */
  readonly matchScore: number;
  readonly answers: readonly Answer[];
  /** 템플릿 치환 키-값 (P2 에서 채움). P1 에서는 비어있을 수 있다. */
  readonly placeholders: Readonly<Record<string, string>>;
  /** ISO-8601. */
  readonly generatedAt: string;
  readonly trellisVersion: string;
}
