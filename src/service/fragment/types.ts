import type { Template } from "../../domain/index.js";

/**
 * fragment 의 meta.json 스키마.
 * 각 fragment 디렉토리에 반드시 존재해야 한다.
 */
export interface FragmentMeta {
  readonly description: string;
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
}

/**
 * 로드된 fragment — 메타 + 템플릿 파일 목록.
 */
export interface Fragment {
  readonly playbookId: string;
  readonly type: string;
  readonly meta: FragmentMeta;
  readonly templates: readonly Template[];
}
