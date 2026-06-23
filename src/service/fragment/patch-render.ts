import Handlebars from "handlebars";
import { registerHelpers } from "../generator/handlebars-helpers.js";
import type { AstPatchDecl, AstPatchSelector, PatchDecl } from "./types.js";

/**
 * patch 필드(file / entryKey / content / selector target 등)에 들어있는
 * Handlebars 토큰(`{{nameKebab}}` 등)을 fragment 컨텍스트로 치환한다.
 *
 * cmd(add / remove)가 meta.json 의 patch 선언을 적용 전 렌더하는 데 쓰는
 * 공유 로직 — 이전에는 add.ts / remove.ts 에 verbatim 중복돼 있었다 (DEP-05).
 */
export function renderHandlebars(template: string, context: Record<string, string>): string {
  const hbs = Handlebars.create();
  registerHelpers(hbs);
  return hbs.compile(template, { noEscape: true })(context);
}

/** marker patch 의 file/entryKey/content 를 렌더 (slot 이름은 정적이므로 그대로). */
export function renderPatch(p: PatchDecl, context: Record<string, string>): PatchDecl {
  return {
    file: renderHandlebars(p.file, context),
    slot: p.slot,
    entryKey: renderHandlebars(p.entryKey, context),
    content: renderHandlebars(p.content, context),
  };
}

export function renderSelector(
  sel: AstPatchSelector,
  context: Record<string, string>,
): AstPatchSelector {
  if (sel.type === "arrayPush") {
    return { type: "arrayPush", target: renderHandlebars(sel.target, context) };
  }
  if (sel.type === "objectKey") {
    return {
      type: "objectKey",
      target: renderHandlebars(sel.target, context),
      key: renderHandlebars(sel.key, context),
    };
  }
  return { type: "importAdd", from: renderHandlebars(sel.from, context) };
}

export function renderAstPatch(
  p: AstPatchDecl,
  context: Record<string, string>,
): AstPatchDecl {
  return {
    file: renderHandlebars(p.file, context),
    selector: renderSelector(p.selector, context),
    entryKey: renderHandlebars(p.entryKey, context),
    content: renderHandlebars(p.content, context),
  };
}

/** astPatch selector 의 사람용 한 줄 요약 (진행/프리뷰 출력). */
export function describeSelector(sel: AstPatchSelector): string {
  if (sel.type === "arrayPush") return `arrayPush:${sel.target}`;
  if (sel.type === "objectKey") return `objectKey:${sel.target}.${sel.key}`;
  return `importAdd:${sel.from}`;
}
