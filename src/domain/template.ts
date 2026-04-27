/**
 * 템플릿 파일 1개 — disk(L3) → generator(L4) 사이의 데이터 모델.
 * 양쪽이 직접 import 하기 위해 도메인(L2) 으로 끌어올렸다.
 */

export interface Template {
  /** 템플릿 루트 기준 상대 경로 (.hbs 포함). forward-slash. */
  readonly sourcePath: string;
  /** 파일 컨텐츠 (UTF-8 텍스트). */
  readonly content: string;
}
