import { resolve } from "node:path";
import { checkHandlebarsTokenValid } from "./rules/handlebars-token-valid.js";
import { checkPatchMarkerPresence } from "./rules/patch-marker-presence.js";
import { checkPlaybookStillSupported } from "./rules/playbook-still-supported.js";
import { checkPlaybookSync } from "./rules/playbook-sync.js";
import { checkRequiredFiles } from "./rules/required-files.js";
import { checkTrellisVersionCompat } from "./rules/trellis-version-compat.js";
import { checkUpgradePending } from "./rules/upgrade-pending.js";
import type { DoctorReport, Finding } from "./types.js";

export function runDoctor(targetDir: string): DoctorReport {
  const absDir = resolve(targetDir);
  const findings: Finding[] = [
    ...checkRequiredFiles(absDir),
    ...checkPlaybookSync(absDir),
    ...checkPatchMarkerPresence(),
    ...checkTrellisVersionCompat(absDir),
    ...checkPlaybookStillSupported(absDir),
    ...checkUpgradePending(absDir),
    ...checkHandlebarsTokenValid(),
  ];
  return { targetDir: absDir, findings };
}
