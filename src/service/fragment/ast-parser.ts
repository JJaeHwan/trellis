import {
  IndentationText,
  NewLineKind,
  Project,
  QuoteKind,
  type ImportDeclaration,
  type SourceFile,
  type VariableDeclaration,
} from "ts-morph";

/**
 * 가상 파일 시스템 모드의 ts-morph Project 를 생성하고
 * 단일 파일을 로드해 SourceFile 을 반환한다.
 *
 * - 디스크 I/O 없음 (useInMemoryFileSystem)
 * - tsconfig 자동 로드 차단 (skipAddingFilesFromTsConfig + skipLoadingLibFiles)
 * - 포맷 일관성: 2-space indent, LF, single-quote (기존 풀바디 스타일)
 *
 * 파일 I/O 는 호출부 책임. 이 함수는 (content, filePath) 만 받아
 * 메모리 안에 가상 파일을 생성한다.
 */
export function parseSourceFile(content: string, filePath: string): SourceFile {
  const project = new Project({
    useInMemoryFileSystem: true,
    skipAddingFilesFromTsConfig: true,
    skipLoadingLibFiles: true,
    skipFileDependencyResolution: true,
    compilerOptions: {
      allowJs: true,
      noResolve: true,
    },
    manipulationSettings: {
      indentationText: IndentationText.TwoSpaces,
      newLineKind: NewLineKind.LineFeed,
      quoteKind: QuoteKind.Single,
      usePrefixAndSuffixTextForRename: false,
    },
  });

  return project.createSourceFile(filePath, content, { overwrite: true });
}

/**
 * SourceFile 에서 주어진 이름의 export 된 변수 선언을 찾는다.
 * `export const x = ...` / `export let x = ...` / `export var x = ...` 모두 지원.
 *
 * @returns VariableDeclaration | undefined
 */
export function findExportedVariable(
  sf: SourceFile,
  name: string,
): VariableDeclaration | undefined {
  for (const stmt of sf.getVariableStatements()) {
    if (!stmt.isExported()) continue;
    for (const decl of stmt.getDeclarations()) {
      if (decl.getName() === name) return decl;
    }
  }
  return undefined;
}

/**
 * SourceFile 에서 주어진 module specifier 와 일치하는 import declaration 을 찾는다.
 * (`import ... from '<from>'` 의 `<from>` 비교)
 *
 * @returns ImportDeclaration | undefined
 */
export function findImportSpecifier(
  sf: SourceFile,
  from: string,
): ImportDeclaration | undefined {
  for (const decl of sf.getImportDeclarations()) {
    if (decl.getModuleSpecifierValue() === from) return decl;
  }
  return undefined;
}
