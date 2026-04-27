/**
 * Generator(L4) 내부 타입.
 *
 * Template / VirtualFile / VirtualTree 는 도메인(L2) 으로 끌어올려져 있으므로
 * 여기서는 GeneratorContext 만 정의.
 */

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
