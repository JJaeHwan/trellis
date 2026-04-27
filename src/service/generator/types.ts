/**
 * Generator(L4) 내부 타입.
 * VirtualFile/VirtualTree 는 L3/L4 양쪽에서 쓰이므로 domain 에 위치 (../domain/virtual-file.ts).
 */

/** 디스크에서 읽어들인 (또는 메모리에서 합성한) 템플릿 파일 1개. */
export interface Template {
  /** 템플릿 루트 기준 상대 경로 (.hbs 포함). */
  readonly sourcePath: string;
  /** 파일 컨텐츠 (UTF-8 텍스트). */
  readonly content: string;
}

/** Handlebars 컨텍스트 — 템플릿이 참조할 수 있는 모든 변수. */
export interface GeneratorContext {
  readonly projectName: string;
  readonly projectNameKebab: string;
  readonly projectNamePascal: string;
  readonly playbookId: string;
  readonly year: number;
  readonly generatedAt: string;
  readonly trellisVersion: string;
  /** Q id → 선택된 option id ("A"|"B"|"OTHER" 등). */
  readonly answers: Readonly<Record<string, string>>;
}
