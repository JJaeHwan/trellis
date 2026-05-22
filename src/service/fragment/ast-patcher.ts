import { resolve } from "node:path";
import { Node, SyntaxKind, type SourceFile } from "ts-morph";
import { ExitCode, HarnessError } from "../../common/errors/index.js";
import { realFsAdapter, type FsAdapter } from "../../external/fs-adapter.js";
import {
  findExportedVariable,
  findImportSpecifier,
  parseSourceFile,
} from "./ast-parser.js";
import type { AstPatchDecl } from "./types.js";

/** JS 식별자로 바로 쓸 수 있는지 판단 (슬래시, 하이픈 등 포함 시 따옴표 필요). */
function isValidIdentifier(key: string): boolean {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key);
}

/**
 * applyAstPatches 의 결과.
 *
 * - applied: 실제 삽입된 patch
 * - skipped: 이미 같은 entryKey / from 이 있어 멱등 skip 된 patch
 */
export interface AstPatchResult {
  readonly applied: readonly AstPatchDecl[];
  readonly skipped: readonly AstPatchDecl[];
}

/**
 * 프로젝트 디렉토리 내 파일들에 AST 기반 patch 를 적용한다.
 *
 * 흐름:
 * 1. 각 patch 마다 대상 파일 존재 확인 (없으면 HarnessError)
 * 2. SourceFile 로드 (파일별 캐싱)
 * 3. selector type 별 분기:
 *    - arrayPush: 대상 배열에 요소 추가 (entryKey 영역 내 존재하면 skip)
 *    - objectKey: 대상 객체에 key-value 추가 (key 이미 있으면 skip)
 *    - importAdd: import declaration 추가 (from 일치하는 것 있으면 skip)
 * 4. 파일별로 변경됐으면 한 번에 writeFile
 */
export function applyAstPatches(
  projectDir: string,
  patches: readonly AstPatchDecl[],
  fs: FsAdapter = realFsAdapter,
): AstPatchResult {
  const applied: AstPatchDecl[] = [];
  const skipped: AstPatchDecl[] = [];

  // 파일별 SourceFile 캐싱 + dirty 플래그
  const cache = new Map<string, { sf: SourceFile; dirty: boolean }>();

  for (const patch of patches) {
    const filePath = resolve(projectDir, patch.file);

    if (!fs.exists(filePath)) {
      throw new HarnessError(
        `target file not found for astPatch: ${patch.file}`,
        ExitCode.ValidationFailure,
        "→ astPatch.file 경로가 올바른지 확인하거나 풀바디에 해당 파일을 추가하세요.",
      );
    }

    let entry = cache.get(filePath);
    if (entry === undefined) {
      const content = fs.readFile(filePath);
      const sf = parseSourceFile(content, filePath);
      entry = { sf, dirty: false };
      cache.set(filePath, entry);
    }

    const wasApplied = applySingleAstPatch(patch, entry.sf);
    if (wasApplied) {
      entry.dirty = true;
      applied.push(patch);
    } else {
      skipped.push(patch);
    }
  }

  // dirty 파일만 한 번에 기록
  for (const [filePath, { sf, dirty }] of cache) {
    if (dirty) {
      fs.writeFile(filePath, sf.getFullText());
    }
  }

  return { applied, skipped };
}

/**
 * 단일 AST patch 를 SourceFile 에 적용한다.
 *
 * @returns true 면 적용됨, false 면 멱등 skip
 * @throws HarnessError 대상 노드가 selector 가 기대한 형태가 아닐 때
 */
function applySingleAstPatch(patch: AstPatchDecl, sf: SourceFile): boolean {
  const sel = patch.selector;

  if (sel.type === "arrayPush") {
    const decl = findExportedVariable(sf, sel.target);
    if (decl === undefined) {
      throw new HarnessError(
        `astPatch target not found: exported variable '${sel.target}' in ${patch.file}`,
        ExitCode.ValidationFailure,
        `→ ${patch.file} 의 '${sel.target}' 식별자가 export 되는지 확인하세요.`,
      );
    }
    const init = decl.getInitializer();
    if (init === undefined || !Node.isArrayLiteralExpression(init)) {
      throw new HarnessError(
        `astPatch target not array: '${sel.target}' in ${patch.file} is not an array literal`,
        ExitCode.ValidationFailure,
        `→ ${patch.file} 의 '${sel.target}' 가 배열 리터럴인지 확인하세요.`,
      );
    }
    // entryKey 멱등 검사: 배열 요소들의 텍스트 중 entryKey 포함 여부
    for (const elem of init.getElements()) {
      if (elem.getText().includes(patch.entryKey)) {
        return false;
      }
    }
    init.addElement(patch.content);
    return true;
  }

  if (sel.type === "objectKey") {
    const decl = findExportedVariable(sf, sel.target);
    if (decl === undefined) {
      throw new HarnessError(
        `astPatch target not found: exported variable '${sel.target}' in ${patch.file}`,
        ExitCode.ValidationFailure,
        `→ ${patch.file} 의 '${sel.target}' 식별자가 export 되는지 확인하세요.`,
      );
    }
    const init = decl.getInitializer();
    if (init === undefined || !Node.isObjectLiteralExpression(init)) {
      throw new HarnessError(
        `astPatch target not object: '${sel.target}' in ${patch.file} is not an object literal`,
        ExitCode.ValidationFailure,
        `→ ${patch.file} 의 '${sel.target}' 가 객체 리터럴인지 확인하세요.`,
      );
    }
    // 유효한 식별자가 아닌 key (예: "/path", "kebab-key") 는 따옴표로 감싼다.
    const propertyName = isValidIdentifier(sel.key)
      ? sel.key
      : `"${sel.key.replace(/"/g, '\\"')}"`;
    // 멱등 검사: key 가 이미 있으면 skip.
    // ts-morph 는 string literal key 를 따옴표 포함 이름으로 저장하므로
    // 식별자가 아닌 key 는 propertyName (따옴표 포함) 으로 조회해야 한다.
    const existing = init.getProperty(propertyName);
    if (existing !== undefined) {
      return false;
    }
    // addPropertyAssignment 는 trailing comment 가 있는 객체에서 double-comma 를 낼 수 있으므로
    // insertPropertyAssignment(index) 로 실제 property 개수 기준 위치에 삽입한다.
    const insertIndex = init.getProperties().length;
    init.insertPropertyAssignment(insertIndex, {
      name: propertyName,
      initializer: patch.content,
    });
    return true;
  }

  if (sel.type === "importAdd") {
    // 멱등 검사: 동일 from 의 import 이미 있으면 skip (entryKey 미참조)
    const existing = findImportSpecifier(sf, sel.from);
    if (existing !== undefined) {
      return false;
    }
    // content 가 완전한 import declaration 문자열로 가정 → ts-morph 로 파싱
    addImportFromText(sf, patch.content, patch.file);
    return true;
  }

  // Exhaustiveness guard — never reached if selector type is well-typed
  const unknownSel: never = sel;
  throw new HarnessError(
    `unknown astPatch selector type: ${JSON.stringify(unknownSel)}`,
    ExitCode.GeneralError,
  );
}

/**
 * content 문자열 (예: `"import { Foo } from './foo';"`) 을 파싱해
 * SourceFile 에 import declaration 으로 추가한다.
 *
 * 임시 SourceFile 에서 import 노드의 structure 를 추출 후 본 SourceFile 에 addImportDeclaration.
 */
function addImportFromText(sf: SourceFile, importText: string, fileForError: string): void {
  const tempSf = parseSourceFile(importText, "__temp_import_only__.ts");
  const imports = tempSf.getImportDeclarations();
  if (imports.length === 0) {
    throw new HarnessError(
      `astPatch importAdd content must be a valid import declaration: '${importText}' in ${fileForError}`,
      ExitCode.ValidationFailure,
      "→ content 를 'import { Foo } from \"./foo\";' 형태로 작성하세요.",
    );
  }
  const structure = imports[0]!.getStructure();
  sf.addImportDeclaration(structure);
  // Drop the discriminator (SyntaxKind.ImportDeclaration was passed via structure — no manual fix-up needed)
  void SyntaxKind.ImportDeclaration;
}
