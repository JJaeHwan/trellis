import { resolve } from "node:path";
import { Node, type SourceFile } from "ts-morph";
import { entryKeyPresent } from "./entry-key.js";

/** JS 식별자로 바로 쓸 수 있는지 판단 (슬래시, 하이픈 등 포함 시 따옴표 필요). */
function isValidIdentifier(key: string): boolean {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key);
}
import { realFsAdapter, type FsAdapter } from "../../external/fs-adapter.js";
import {
  findExportedVariable,
  findImportSpecifier,
  parseSourceFile,
} from "./ast-parser.js";
import type { AstPatchDecl } from "./types.js";

/**
 * removeAstPatches 의 결과.
 *
 * - removed: 실제 제거된 patch
 * - notFound: 파일 없음 / 타겟 없음 / 매칭 없음 으로 skip 된 patch (멱등)
 */
export interface AstUnPatchResult {
  readonly removed: readonly AstPatchDecl[];
  readonly notFound: readonly AstPatchDecl[];
}

/**
 * 프로젝트 디렉토리 내 파일들에서 AST patch 를 제거한다 (applyAstPatches 의 역연산).
 *
 * 흐름:
 * 1. 파일 없음 → notFound, continue
 * 2. SourceFile 로드 (파일별 캐싱)
 * 3. selector type 별:
 *    - arrayPush: 배열에서 entryKey 포함된 요소 찾아 remove. 없으면 notFound.
 *    - objectKey: 객체에서 key 와 일치하는 property 찾아 remove. 없으면 notFound.
 *    - importAdd: from 일치하는 import declaration remove. 없으면 notFound.
 * 4. 변경 시 한 번에 writeFile
 */
export function removeAstPatches(
  projectDir: string,
  patches: readonly AstPatchDecl[],
  fs: FsAdapter = realFsAdapter,
): AstUnPatchResult {
  const removed: AstPatchDecl[] = [];
  const notFound: AstPatchDecl[] = [];

  const cache = new Map<string, { sf: SourceFile; dirty: boolean }>();

  for (const patch of patches) {
    const filePath = resolve(projectDir, patch.file);

    if (!fs.exists(filePath)) {
      notFound.push(patch);
      continue;
    }

    let entry = cache.get(filePath);
    if (entry === undefined) {
      const content = fs.readFile(filePath);
      const sf = parseSourceFile(content, filePath);
      entry = { sf, dirty: false };
      cache.set(filePath, entry);
    }

    const wasRemoved = removeSingleAstPatch(patch, entry.sf);
    if (wasRemoved) {
      entry.dirty = true;
      removed.push(patch);
    } else {
      notFound.push(patch);
    }
  }

  for (const [filePath, { sf, dirty }] of cache) {
    if (dirty) {
      fs.writeFile(filePath, sf.getFullText());
    }
  }

  return { removed, notFound };
}

/**
 * 단일 AST patch 를 SourceFile 에서 제거한다.
 *
 * @returns true 면 제거됨, false 면 notFound (멱등)
 */
function removeSingleAstPatch(patch: AstPatchDecl, sf: SourceFile): boolean {
  const sel = patch.selector;

  if (sel.type === "arrayPush") {
    const decl = findExportedVariable(sf, sel.target);
    if (decl === undefined) return false;
    const init = decl.getInitializer();
    if (init === undefined || !Node.isArrayLiteralExpression(init)) return false;
    const elements = init.getElements();
    for (let i = 0; i < elements.length; i++) {
      const elem = elements[i]!;
      if (entryKeyPresent(elem.getText(), patch.entryKey)) {
        init.removeElement(i);
        return true;
      }
    }
    return false;
  }

  if (sel.type === "objectKey") {
    const decl = findExportedVariable(sf, sel.target);
    if (decl === undefined) return false;
    const init = decl.getInitializer();
    if (init === undefined || !Node.isObjectLiteralExpression(init)) return false;
    // ts-morph 는 string literal key 를 따옴표 포함 이름으로 저장하므로
    // 식별자가 아닌 key 는 따옴표 포함 형태로 조회해야 한다.
    // addPropertyAssignment 는 ManipulationSettings.quoteKind (Single) 를 따르므로
    // 단일 따옴표 형태로 먼저 시도하고, 없으면 이중 따옴표로 폴백한다.
    const prop = isValidIdentifier(sel.key)
      ? init.getProperty(sel.key)
      : (init.getProperty(`'${sel.key.replace(/'/g, "\\'")}'`) ??
        init.getProperty(`"${sel.key.replace(/"/g, '\\"')}"`) ??
        undefined);
    if (prop === undefined) return false;
    prop.remove();
    return true;
  }

  if (sel.type === "importAdd") {
    const decl = findImportSpecifier(sf, sel.from);
    if (decl === undefined) return false;
    decl.remove();
    return true;
  }

  // Exhaustiveness guard
  const unknownSel: never = sel;
  void unknownSel;
  return false;
}
