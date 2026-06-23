import { resolve } from "node:path";
import type { FsAdapter } from "../../../external/fs-adapter.js";
import { resolveResourcesDir } from "../../../external/resources-root.js";
import { realFsAdapter } from "../../../external/fs-adapter.js";
import { loadSpec } from "../../../external/spec-loader.js";
import type { Finding } from "../types.js";

/** 디렉토리 listing 실패 시 사용하는 하드코딩 fallback */
const FALLBACK_SUPPORTED_PLAYBOOKS = ["cli-tool", "b2b-saas", "ai-rag-platform"];

function getSupportedPlaybooks(fs: FsAdapter): readonly string[] {
  try {
    const templatesRoot = resolveResourcesDir("templates");

    if (!fs.exists(templatesRoot) || !fs.isDirectory(templatesRoot)) {
      return FALLBACK_SUPPORTED_PLAYBOOKS;
    }

    const entries = fs.listDir(templatesRoot);
    const dirs = entries.filter((entry) => {
      const fullPath = resolve(templatesRoot, entry);
      return fs.isDirectory(fullPath);
    });

    return dirs.length > 0 ? dirs : FALLBACK_SUPPORTED_PLAYBOOKS;
  } catch {
    return FALLBACK_SUPPORTED_PLAYBOOKS;
  }
}

/**
 * doctor 규칙: playbook-still-supported
 *
 * `.trellis/spec.json` 의 playbookId 가 현재 trellis 가 지원하는 playbook 목록에
 * 있는지 검사한다.
 *
 * - spec.json 없음 → no-op (다른 규칙이 처리)
 * - playbookId 가 지원 목록에 없음 → error finding
 */
export function checkPlaybookStillSupported(
  projectDir: string,
  fs: FsAdapter = realFsAdapter,
): Finding[] {
  const findings: Finding[] = [];

  let spec: Awaited<ReturnType<typeof loadSpec>>;
  try {
    spec = loadSpec(projectDir, fs);
  } catch {
    // loadSpec 이 throw 하는 경우는 spec.json 이 존재하지만 파싱 실패한 경우.
    // 해당 오류는 이 규칙의 범위 밖이므로 조용히 넘긴다.
    return findings;
  }

  // spec.json 이 없는 프로젝트 — 다른 규칙이 처리하므로 통과
  if (spec === undefined) {
    return findings;
  }

  const supported = getSupportedPlaybooks(fs);

  if (!supported.includes(spec.playbookId)) {
    findings.push({
      ruleId: "playbook-still-supported",
      severity: "error",
      message: `spec.json 의 playbookId "${spec.playbookId}" 는 현재 trellis 가 지원하지 않습니다.`,
      hint: `지원되는 playbook: ${supported.join(", ")}. trellis 를 업데이트하거나 spec.json 을 확인하세요.`,
    });
  }

  return findings;
}
