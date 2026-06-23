import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { listManifests, loadManifest } from "./manifest-loader.js";

// ---------------------------------------------------------------------------
// Guard: the migration manifest chain must stay contiguous up to the current
// package version. This is the regression net for the gap where the package
// shipped 0.12.x while only the 0.9.0-to-0.10.0 manifest existed, so
// `trellis upgrade` hard-threw for any project a minor or more behind.
//
// The chain is validated against package.json (the release source of truth,
// bumped by release-please) — NOT a hardcoded constant — so the next minor
// release fails this test until its migration manifest is added.
// ---------------------------------------------------------------------------

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");

function readCurrentVersion(): string {
  const pkg = JSON.parse(
    readFileSync(resolve(repoRoot, "package.json"), "utf-8"),
  ) as { version: string };
  return pkg.version;
}

function majorOf(version: string): number {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!m) throw new Error(`malformed version: ${version}`);
  return parseInt(m[1]!, 10);
}

function minorOf(version: string): number {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!m) throw new Error(`malformed version: ${version}`);
  return parseInt(m[2]!, 10);
}

describe("migration manifest chain", () => {
  const manifests = listManifests();
  const current = readCurrentVersion();
  const curMajor = majorOf(current);
  const curMinor = minorOf(current);

  it("listManifests_returnsAtLeastOneManifest", () => {
    expect(manifests.length).toBeGreaterThan(0);
  });

  it("everyManifest_isAdjacentSameMajorMinorBump_x.N.0_to_x.N+1.0", () => {
    for (const { from, to } of manifests) {
      expect(majorOf(from)).toBe(majorOf(to));
      expect(minorOf(to)).toBe(minorOf(from) + 1);
      expect(from.endsWith(".0")).toBe(true);
      expect(to.endsWith(".0")).toBe(true);
    }
  });

  it("everyManifest_loadsAndValidates_withoutThrowing", () => {
    for (const { from, to } of manifests) {
      expect(() => loadManifest(from, to)).not.toThrow();
    }
  });

  it("chain_isContiguous_fromEarliestManifestUpToCurrentPackageMinor", () => {
    // Map fromMinor -> toMinor for same-major steps.
    const steps = new Map<number, number>();
    for (const { from, to } of manifests) {
      if (majorOf(from) !== curMajor) continue;
      steps.set(minorOf(from), minorOf(to));
    }
    expect(steps.size).toBeGreaterThan(0);

    const earliestMinor = Math.min(...steps.keys());
    const missing: string[] = [];
    for (let m = earliestMinor; m < curMinor; m++) {
      if (steps.get(m) !== m + 1) {
        missing.push(`${curMajor}.${m}.0-to-${curMajor}.${m + 1}.0.json`);
      }
    }

    expect(
      missing,
      `Missing migration manifest(s): ${missing.join(", ")}. ` +
        `Run 'npm run manifests:ensure' to generate no-op manifest(s), or add ` +
        `resources/migrations/<from>-to-<to>.json manually so 'trellis upgrade' ` +
        `can step a project up to ${current}. (A no-op manifest is correct when ` +
        `the release introduced no scaffolded structural change.)`,
    ).toEqual([]);
  });
});
