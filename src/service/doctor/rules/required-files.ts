import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Finding, Severity } from "../types.js";

interface RequiredEntry {
  readonly path: string;
  readonly severity: Severity;
}

const REQUIRED: ReadonlyArray<RequiredEntry> = [
  { path: "package.json", severity: "error" },
  { path: "README.md", severity: "warn" },
  { path: "CLAUDE.md", severity: "warn" },
  { path: "docs/architecture.md", severity: "warn" },
  { path: "docs/plans", severity: "warn" },
];

export function checkRequiredFiles(targetDir: string): Finding[] {
  const findings: Finding[] = [];
  for (const entry of REQUIRED) {
    const full = resolve(targetDir, entry.path);
    if (!existsSync(full)) {
      findings.push({
        ruleId: "required-files",
        severity: entry.severity,
        message: `필수 파일/디렉토리 누락: ${entry.path}`,
        hint: `프로젝트에 ${entry.path} 를 추가하세요.`,
      });
    }
  }
  return findings;
}
