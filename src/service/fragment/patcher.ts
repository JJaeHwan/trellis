import { resolve } from "node:path";
import { ExitCode, HarnessError } from "../../common/errors/index.js";
import { realFsAdapter, type FsAdapter } from "../../external/fs-adapter.js";
import { entryKeyPresent } from "./entry-key.js";
import type { PatchDecl } from "./types.js";

/**
 * applyPatches 의 결과.
 *
 * - applied: 실제 삽입된 patch
 * - skipped: 이미 같은 entryKey 가 슬롯에 있어 멱등 skip 된 patch
 */
export interface PatchResult {
  readonly applied: readonly PatchDecl[];
  readonly skipped: readonly PatchDecl[];
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
 * content 끝에 newline 을 보장한다.
 */
function indentContent(content: string, indent: string): string {
  const lines = content.split("\n");
  // content 끝에 빈 줄이 있으면 마지막 빈 줄은 들여쓰기 없이 처리
  const indented = lines
    .map((line, i) => {
      // 마지막 빈 줄은 그대로 (trailing newline 처리용)
      if (i === lines.length - 1 && line === "") return "";
      return line.length > 0 ? indent + line : line;
    })
    .join("\n");
  // content 끝 newline 보장
  return indented.endsWith("\n") ? indented : indented + "\n";
}

/**
 * 프로젝트 디렉토리 내 파일들에 patch 를 적용한다.
 *
 * 흐름:
 * 1. 각 patch 마다 대상 파일 존재 확인 (없으면 HarnessError)
 * 2. slot start/end marker 를 찾아 유효성 검사 (없으면 HarnessError)
 * 3. start..end 사이에 entryKey 가 이미 있으면 silent skip
 * 4. 없으면 end marker 직전(들여쓰기 보존)에 content 삽입
 * 5. 변경된 파일만 writeFile (파일 당 한 번)
 */
export function applyPatches(
  projectDir: string,
  patches: readonly PatchDecl[],
  fs: FsAdapter = realFsAdapter,
): PatchResult {
  const applied: PatchDecl[] = [];
  const skipped: PatchDecl[] = [];

  // 파일 별로 내용을 버퍼에 모아 한 번에 쓴다
  const buffers = new Map<string, string>();

  for (const patch of patches) {
    const filePath = resolve(projectDir, patch.file);

    // 대상 파일 존재 확인
    if (!fs.exists(filePath)) {
      throw new HarnessError(
        `target file not found for patch: ${patch.file}`,
        ExitCode.ValidationFailure,
      );
    }

    // 파일 내용 (이미 버퍼에 있으면 버퍼 사용)
    const content = buffers.get(filePath) ?? fs.readFile(filePath);

    const escapedSlot = escapeRegExp(patch.slot);
    const startPattern = new RegExp(`\\/\\/\\s*trellis:slot:${escapedSlot}:start`);
    const endPattern = new RegExp(`\\/\\/\\s*trellis:slot:${escapedSlot}:end`);

    const lines = content.split("\n");

    // start / end 라인 인덱스 탐색 (첫 번째 쌍 사용)
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

    // 슬롯 누락 검사
    if (startIndex === -1) {
      throw new HarnessError(
        `missing slot '${patch.slot}' in ${patch.file}`,
        ExitCode.ValidationFailure,
        "trellis doctor . 로 풀바디 marker 무결성을 확인하세요.",
      );
    }
    if (endIndex === -1) {
      throw new HarnessError(
        `missing slot '${patch.slot}' in ${patch.file}`,
        ExitCode.ValidationFailure,
        "trellis doctor . 로 풀바디 marker 무결성을 확인하세요.",
      );
    }
    // end 가 start 보다 앞에 있는 경우는 위 로직에서 이미 처리됨
    // (endIndex 탐색을 startIndex 이후부터 시작하므로)

    // start..end 사이 텍스트 추출
    const slotLines = lines.slice(startIndex + 1, endIndex);
    const slotText = slotLines.join("\n");

    // entryKey 멱등 검사 (토큰 경계 — prefix 충돌 방지)
    if (entryKeyPresent(slotText, patch.entryKey)) {
      skipped.push(patch);
      // 버퍼 유지 (변경 없음)
      buffers.set(filePath, content);
      continue;
    }

    // end marker 의 들여쓰기 추출
    const endLine = lines[endIndex] ?? "";
    const indent = extractIndent(endLine);

    // patch.content 에 들여쓰기 적용
    const indentedContent = indentContent(patch.content, indent);

    // end marker 직전에 삽입
    // end marker 앞에 newline 1개 보장: indentedContent 가 이미 \n 로 끝나므로
    // 그냥 splice 로 삽입
    const contentLines = indentedContent.split("\n");
    // indentedContent 가 \n 로 끝나므로 마지막 원소는 빈 문자열 — 제거
    if (contentLines[contentLines.length - 1] === "") {
      contentLines.pop();
    }

    const newLines = [
      ...lines.slice(0, endIndex),
      ...contentLines,
      ...lines.slice(endIndex),
    ];

    const newContent = newLines.join("\n");
    buffers.set(filePath, newContent);
    applied.push(patch);
  }

  // 변경된 파일 기록 (applied 가 있는 파일만 실제 변경됨)
  // buffers 에는 skipped 파일도 들어있을 수 있으므로 applied 파일 경로 집합으로 필터링
  const appliedPaths = new Set(applied.map((p) => resolve(projectDir, p.file)));
  for (const [filePath, newContent] of buffers) {
    if (appliedPaths.has(filePath)) {
      fs.writeFile(filePath, newContent);
    }
  }

  return { applied, skipped };
}
