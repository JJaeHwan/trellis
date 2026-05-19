import Handlebars from "handlebars";
import type { VirtualTree } from "../../domain/index.js";
import {
  registerHelpers,
  toCamel,
  toKebab,
  toPascal,
  toSnake,
} from "../generator/handlebars-helpers.js";
import type { Fragment } from "./types.js";

const HBS_EXT = ".hbs";

/**
 * fragment 렌더링 컨텍스트.
 *
 * name 5종 케이스 변환 + ProjectSpec 의 placeholders 를 포함한다.
 */
export interface FragmentContext {
  readonly name: string;
  readonly namePascal: string;
  readonly nameKebab: string;
  readonly nameCamel: string;
  readonly nameSnake: string;
  readonly [key: string]: string;
}

/**
 * name 으로부터 FragmentContext 를 빌드한다.
 *
 * @param name    — 사용자가 입력한 원본 이름 (예: "users", "UserProfile")
 * @param extras  — ProjectSpec.placeholders 등 추가 컨텍스트
 */
export function buildFragmentContext(
  name: string,
  extras: Readonly<Record<string, string>> = {},
): FragmentContext {
  return {
    name,
    namePascal: toPascal(name),
    nameKebab: toKebab(name),
    nameCamel: toCamel(name),
    nameSnake: toSnake(name),
    ...extras,
  };
}

/**
 * Fragment 의 templates 를 context 로 렌더링해 VirtualTree 를 반환한다.
 *
 * - `.hbs` 파일: Handlebars 컴파일 후 확장자 제거
 * - 그 외: 내용 그대로 (경로 내 `{{...}}` 패턴도 Handlebars 로 치환)
 *
 * 출력 경로의 `{{nameKebab}}` 등도 치환한다 (경로 템플릿 지원).
 */
export function renderFragment(
  fragment: Fragment,
  context: FragmentContext,
): VirtualTree {
  const hbs = Handlebars.create();
  registerHelpers(hbs);

  return fragment.templates.map((tpl) => {
    // 경로 자체도 핸들바 치환 (예: app/api/{{nameKebab}}/route.ts.hbs)
    const rawPath = tpl.sourcePath.endsWith(HBS_EXT)
      ? tpl.sourcePath.slice(0, -HBS_EXT.length)
      : tpl.sourcePath;
    const renderedPath = hbs.compile(rawPath, { noEscape: true })(context);

    const renderedContent = tpl.sourcePath.endsWith(HBS_EXT)
      ? hbs.compile(tpl.content, { noEscape: true })(context)
      : tpl.content;

    return { path: renderedPath, content: renderedContent };
  });
}
