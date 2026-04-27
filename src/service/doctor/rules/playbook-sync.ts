import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Finding } from "../types.js";

interface PlaybookMetaShape {
  readonly id: string;
  readonly sourceMd: string;
  readonly sourceMdHash: string;
}

const META_SUFFIX = ".meta.json";

/**
 * For each `resources/playbooks/<id>.meta.json` in the target, look up the
 * referenced source MD (relative to the *parent* of targetDir, since the
 * convention is that harness-engineering sits as a sibling repo). If the MD
 * exists, hash it and compare. If not found, emit an info-level finding and
 * skip silently.
 */
export function checkPlaybookSync(targetDir: string): Finding[] {
  const findings: Finding[] = [];
  const playbooksDir = resolve(targetDir, "resources/playbooks");

  if (!existsSync(playbooksDir)) {
    return findings;
  }

  const metaFiles = readdirSync(playbooksDir).filter((f) =>
    f.endsWith(META_SUFFIX),
  );

  for (const file of metaFiles) {
    const metaPath = resolve(playbooksDir, file);
    let meta: PlaybookMetaShape;
    try {
      meta = JSON.parse(readFileSync(metaPath, "utf-8")) as PlaybookMetaShape;
    } catch (err) {
      findings.push({
        ruleId: "playbook-sync",
        severity: "error",
        message: `${file} 를 파싱할 수 없습니다: ${(err as Error).message}`,
      });
      continue;
    }

    const candidate = resolve(targetDir, "..", meta.sourceMd);
    if (!existsSync(candidate)) {
      findings.push({
        ruleId: "playbook-sync",
        severity: "info",
        message: `${meta.id}: 원본 MD 를 찾을 수 없어 해시 검사를 건너뜁니다 (${meta.sourceMd})`,
      });
      continue;
    }

    const actualHash = createHash("sha256")
      .update(readFileSync(candidate))
      .digest("hex");

    if (actualHash !== meta.sourceMdHash) {
      findings.push({
        ruleId: "playbook-sync",
        severity: "error",
        message: `${meta.id}: sourceMdHash 가 실제 MD 해시와 다릅니다`,
        hint: `${file} 의 sourceMdHash 를 ${actualHash} 로 갱신하거나, MD 변경이 의도가 아니라면 되돌리세요.`,
      });
    }
  }

  return findings;
}
