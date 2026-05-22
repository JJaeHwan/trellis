import { resolve } from "node:path";
import { realFsAdapter, type FsAdapter } from "../../external/fs-adapter.js";
import type { PatchDecl } from "./types.js";

/**
 * removePatches 의 결과.
 *
 * - removed: 실제 제거된 patch
 * - notFound: 대상 파일 없음 / slot 없음 / content 매칭 없음 으로 skip 된 patch
 */
export interface UnPatchResult {
  readonly removed: readonly PatchDecl[];
  readonly notFound: readonly PatchDecl[];
}

/**
 * slot 이름을 정규식 안에서 안전하게 사용하기 위해 이스케이프.
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * end marker 라인의 들여쓰기(앞 공백/탭)를 추출한다.
 */
function extractIndent(line: string): string {
  const match = /^(\s*)/.exec(line);
  return match?.[1] ?? "";
}

/**
 * content 의 각 줄 앞에 indent 를 붙인 문자열을 반환한다.
 * patcher.ts 의 indentContent 와 동일한 로직 — 같은 출력을 내야 매칭 가능.
 */
function indentContent(content: string, indent: string): string {
  const lines = content.split("\n");
  const indented = lines
    .map((line, i) => {
      if (i === lines.length - 1 && line === "") return "";
      return line.length > 0 ? indent + line : line;
    })
    .join("\n");
  return indented.endsWith("\n") ? indented : indented + "\n";
}

/**
 * 프로젝트 디렉토리 내 파일들에서 patch 를 제거한다 (applyPatches 의 역연산).
 *
 * 흐름:
 * 1. 각 patch 마다 대상 파일 존재 확인 (없으면 notFound, continue)
 * 2. slot start/end marker 를 찾는다 (없으면 notFound, continue — 멱등)
 * 3. block 안에서 patch.content (indent 정규화 후) 를 탐지
 *    매칭 없으면 notFound, continue (이미 제거됐다고 간주)
 * 4. 매칭된 라인 블록을 splice 로 삭제, 파일 재기록, removed push
 *
 * 파일별 버퍼링 후 한 번에 쓴다 (patcher.ts 동일 패턴).
 */
export function removePatches(
  projectDir: string,
  patches: readonly PatchDecl[],
  fs: FsAdapter = realFsAdapter,
): UnPatchResult {
  const removed: PatchDecl[] = [];
  const notFound: PatchDecl[] = [];

  // 파일 별로 내용을 버퍼에 모아 한 번에 쓴다
  const buffers = new Map<string, string>();

  for (const patch of patches) {
    const filePath = resolve(projectDir, patch.file);

    // 1. 대상 파일 존재 확인
    if (!fs.exists(filePath)) {
      notFound.push(patch);
      continue;
    }

    // 파일 내용 (이미 버퍼에 있으면 버퍼 사용)
    const content = buffers.get(filePath) ?? fs.readFile(filePath);

    const escapedSlot = escapeRegExp(patch.slot);
    const startPattern = new RegExp(`\\/\\/\\s*trellis:slot:${escapedSlot}:start`);
    const endPattern = new RegExp(`\\/\\/\\s*trellis:slot:${escapedSlot}:end`);

    const lines = content.split("\n");

    // 2. start / end 라인 인덱스 탐색 (첫 번째 쌍 사용)
    let startIndex = -1;
    let endIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      if (startIndex === -1 && startPattern.test(lines[i] ?? "")) {
        startIndex = i;
      } else if (startIndex !== -1 && endIndex === -1 && endPattern.test(lines[i] ?? "")) {
        endIndex = i;
        break;
      }
    }

    // slot 없음 → notFound (throw 하지 않음 — 멱등이 핵심)
    if (startIndex === -1 || endIndex === -1) {
      notFound.push(patch);
      continue;
    }

    // 3. end marker 의 들여쓰기를 사용해 patch.content indent 정규화
    const endLine = lines[endIndex] ?? "";
    const indent = extractIndent(endLine);

    const indentedContent = indentContent(patch.content, indent);
    // trailing newline 을 제거해 lines 배열과 동형으로 만든다
    const normalizedContent = indentedContent.endsWith("\n")
      ? indentedContent.slice(0, -1)
      : indentedContent;
    const contentLines = normalizedContent.split("\n");
    const contentLineCount = contentLines.length;

    // slot 안 (startIndex+1 ~ endIndex-1) 에서 contentLines 블록 탐색
    const slotLines = lines.slice(startIndex + 1, endIndex);
    let matchStart = -1;

    outer: for (let i = 0; i <= slotLines.length - contentLineCount; i++) {
      for (let j = 0; j < contentLineCount; j++) {
        if (slotLines[i + j] !== contentLines[j]) {
          continue outer;
        }
      }
      matchStart = i;
      break;
    }

    // 4. 매칭 없으면 notFound (이미 제거됐다고 간주)
    if (matchStart === -1) {
      notFound.push(patch);
      buffers.set(filePath, content);
      continue;
    }

    // 매칭된 라인들을 제거
    // lines 배열 내 절대 위치 = startIndex + 1 + matchStart
    const absStart = startIndex + 1 + matchStart;
    const newLines = [
      ...lines.slice(0, absStart),
      ...lines.slice(absStart + contentLineCount),
    ];

    const newContent = newLines.join("\n");
    buffers.set(filePath, newContent);
    removed.push(patch);
  }

  // 변경된 파일만 기록 (removed 가 있는 파일만 실제 변경됨)
  const removedPaths = new Set(removed.map((p) => resolve(projectDir, p.file)));
  for (const [filePath, newContent] of buffers) {
    if (removedPaths.has(filePath)) {
      fs.writeFile(filePath, newContent);
    }
  }

  return { removed, notFound };
}
