import { resolve } from "node:path";
import { ExitCode, HarnessError } from "../../common/errors/index.js";
import type { FsAdapter } from "../../external/fs-adapter.js";
import type { MigrationManifest, AddSlotAction, AddFileAction } from "./types.js";

export interface ApplyResult {
  readonly slotsAdded: readonly { file: string; slot: string }[];
  readonly slotsSkipped: readonly { file: string; slot: string }[];
  readonly filesAdded: readonly string[];
  readonly filesSkipped: readonly string[];
}

/**
 * manifest 의 변경 사항을 projectDir 에 적용.
 *
 * @param dryRun true 시 fs.writeFile 호출 안 함 — 변경 시뮬레이션
 */
export function applyManifest(
  manifest: MigrationManifest,
  playbookId: string,
  projectDir: string,
  fs: FsAdapter,
  dryRun: boolean,
): ApplyResult {
  const playbookMig = manifest.playbooks[playbookId];
  if (playbookMig === undefined) {
    return { slotsAdded: [], slotsSkipped: [], filesAdded: [], filesSkipped: [] };
  }

  const slotsAdded: { file: string; slot: string }[] = [];
  const slotsSkipped: { file: string; slot: string }[] = [];
  const filesAdded: string[] = [];
  const filesSkipped: string[] = [];

  // slot 삽입
  for (const action of playbookMig.addSlots ?? []) {
    const filePath = resolve(projectDir, action.file);
    if (!fs.exists(filePath)) {
      throw new HarnessError(
        `migration target file not found: ${action.file}`,
        ExitCode.ValidationFailure,
        "프로젝트가 손상됐거나 풀바디 구조가 변경됐을 수 있습니다. trellis doctor 로 확인하세요.",
      );
    }
    const content = fs.readFile(filePath);

    // 멱등: 이미 marker 가 있으면 skip
    const startMarker = `// trellis:slot:${action.slot}:start`;
    if (content.includes(startMarker)) {
      slotsSkipped.push({ file: action.file, slot: action.slot });
      continue;
    }

    // anchor 라인 찾기
    const lines = content.split("\n");
    let anchorIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i] === action.afterLine) {
        anchorIdx = i;
        break;
      }
    }
    if (anchorIdx === -1) {
      throw new HarnessError(
        `migration anchor not found in ${action.file}: "${action.afterLine}"`,
        ExitCode.ValidationFailure,
        "사용자가 풀바디를 수정했을 수 있습니다. 수동으로 슬롯을 추가하거나 anchor 위치를 복원하세요.",
      );
    }

    const indent = action.indent ?? "";
    const newLines = [
      ...lines.slice(0, anchorIdx + 1),
      `${indent}${startMarker}`,
      `${indent}// trellis:slot:${action.slot}:end`,
      ...lines.slice(anchorIdx + 1),
    ];
    if (!dryRun) {
      fs.writeFile(filePath, newLines.join("\n"));
    }
    slotsAdded.push({ file: action.file, slot: action.slot });
  }

  // 파일 추가
  for (const action of playbookMig.addFiles ?? []) {
    const filePath = resolve(projectDir, action.path);
    if (fs.exists(filePath)) {
      filesSkipped.push(action.path);
      continue;
    }
    if (!dryRun) {
      const lastSlash = filePath.lastIndexOf("/");
      if (lastSlash > 0) {
        fs.ensureDir(filePath.slice(0, lastSlash));
      }
      fs.writeFile(filePath, action.content);
    }
    filesAdded.push(action.path);
  }

  return { slotsAdded, slotsSkipped, filesAdded, filesSkipped };
}

// Re-export types used by tests / consumers
export type { AddSlotAction, AddFileAction };
