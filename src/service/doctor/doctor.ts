import { resolve } from "node:path";
import { checkPatchMarkerPresence } from "./rules/patch-marker-presence.js";
import { checkPlaybookSync } from "./rules/playbook-sync.js";
import { checkRequiredFiles } from "./rules/required-files.js";
import type { DoctorReport, Finding } from "./types.js";

export function runDoctor(targetDir: string): DoctorReport {
  const absDir = resolve(targetDir);
  const findings: Finding[] = [
    ...checkRequiredFiles(absDir),
    ...checkPlaybookSync(absDir),
    ...checkPatchMarkerPresence(),
  ];
  return { targetDir: absDir, findings };
}
