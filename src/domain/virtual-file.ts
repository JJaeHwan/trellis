/**
 * Generator(L4) 가 만들고 fs-writer(L3) 가 소비하는 데이터 모델.
 * 양쪽이 직접 import 하기 위해 도메인(L2) 으로 끌어올렸다.
 */

export interface VirtualFile {
  /** 프로젝트 루트로부터의 상대 경로. forward-slash. */
  readonly path: string;
  /** UTF-8 텍스트 컨텐츠 (현재 이진 파일 미지원). */
  readonly content: string;
}

export type VirtualTree = readonly VirtualFile[];
