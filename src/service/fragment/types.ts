import type { Template } from "../../domain/index.js";

/**
 * fragment 의 meta.json 에서 선언하는 patch 항목 하나.
 * 기존 파일의 slot 에 텍스트를 삽입한다.
 */
export interface PatchDecl {
  /** 대상 파일의 프로젝트 루트 기준 상대 경로 (예: "src/lib/nav-items.ts") */
  readonly file: string;
  /** 슬롯 이름 — block-style marker 의 식별자 */
  readonly slot: string;
  /** 멱등성 키 — 같은 entryKey 가 슬롯에 이미 있으면 no-op */
  readonly entryKey: string;
  /** 슬롯에 삽입할 텍스트 (Handlebars 치환됨) */
  readonly content: string;
}

/**
 * AST patch selector — 3종 (MVP).
 *
 * - arrayPush:  `target` 으로 식별되는 export 된 배열 끝에 요소 추가
 * - objectKey:  `target` 으로 식별되는 export 된 객체에 key-value 추가
 * - importAdd:  파일에 import 선언 추가 (`from` 으로 중복 검사)
 */
export type AstPatchSelector =
  | { readonly type: "arrayPush"; readonly target: string }
  | { readonly type: "objectKey"; readonly target: string; readonly key: string }
  | { readonly type: "importAdd"; readonly from: string };

/**
 * fragment 의 meta.json 에서 선언하는 AST patch 항목 하나.
 * marker 시스템과 공존 — 별도 필드 (`astPatches`) 로 선언.
 */
export interface AstPatchDecl {
  /** 대상 파일의 프로젝트 루트 기준 상대 경로 */
  readonly file: string;
  /** 어떤 노드를 어떻게 조작할지 선언 */
  readonly selector: AstPatchSelector;
  /** 멱등성 키 — selector 영역 내부에 entryKey 가 이미 등장하면 skip */
  readonly entryKey: string;
  /** 삽입할 텍스트 (Handlebars 치환됨). 선택자 종류별 의미가 다르다. */
  readonly content: string;
}

/**
 * fragment 의 meta.json 스키마.
 * 각 fragment 디렉토리에 반드시 존재해야 한다.
 */
export interface FragmentMeta {
  readonly description: string;
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
  readonly patches?: readonly PatchDecl[];
  readonly astPatches?: readonly AstPatchDecl[];
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
