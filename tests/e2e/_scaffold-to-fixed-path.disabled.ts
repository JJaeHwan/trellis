// One-time helper test (disabled — rename to .test.ts to use, then revert).
// Usage:
//   1. mv tests/e2e/_scaffold-to-fixed-path.disabled.ts tests/e2e/_scaffold-to-fixed-path.test.ts
//   2. SCAFFOLD_TARGET=/tmp/verify-saas npx vitest run tests/e2e/_scaffold-to-fixed-path.test.ts
//   3. cd /tmp/verify-saas && npm install && npx prisma generate && npx tsc --noEmit
//   4. revert the rename
import { mkdirSync, rmSync } from "node:fs";
import { describe, it } from "vitest";
import type { ProjectSpec } from "../../src/domain/index.js";
import { scaffold } from "../../src/service/scaffolder/index.js";

const TARGET = process.env.SCAFFOLD_TARGET ?? "/tmp/trellis-verify";
const PLAYBOOK = process.env.SCAFFOLD_PLAYBOOK ?? "b2b-saas";
const NAME = process.env.SCAFFOLD_NAME ?? "verify-app";

const spec: ProjectSpec = {
  projectName: NAME,
  rootPath: TARGET,
  playbookId: PLAYBOOK,
  matchMode: "exact",
  matchScore: 1,
  answers: [],
  placeholders: {},
  generatedAt: "2026-04-27T00:00:00.000Z",
  trellisVersion: "0.1.0-verify",
};

describe("manual verify — scaffold to fixed path", () => {
  it(`writes ${PLAYBOOK} to SCAFFOLD_TARGET`, () => {
    rmSync(TARGET, { recursive: true, force: true });
    mkdirSync(TARGET, { recursive: true });
    scaffold(spec);
  });
});
