#!/usr/bin/env node
// Ensures a contiguous chain of migration manifests up to the current
// package.json version. For every missing adjacent-minor step it writes a
// no-op manifest (`{"playbooks": {}}`). Idempotent: existing manifests are
// never modified. Run this whenever a release-please PR bumps the minor and
// the migration-chain guard test goes red:
//
//   npm run manifests:ensure && git add resources/migrations
//
// If a release actually adds slots/files, replace the generated no-op with a
// real manifest instead.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const migrationsDir = resolve(repoRoot, "resources/migrations");

function parseSemver(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v);
  if (!m) throw new Error(`malformed version: ${v}`);
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

/** @returns {Array<{from:string,to:string}>} missing adjacent-minor steps up to the target minor. */
export function planMissingSteps(version, existingSteps) {
  const cur = parseSemver(version);
  const fromMinors = existingSteps
    .map((s) => parseSemver(s.from))
    .filter((s) => s.major === cur.major)
    .map((s) => s.minor);
  if (fromMinors.length === 0) {
    throw new Error("no existing migration manifests for the current major; refusing to guess the chain start");
  }
  const earliest = Math.min(...fromMinors);
  const haveStepFrom = new Set(fromMinors);
  const missing = [];
  for (let m = earliest; m < cur.minor; m++) {
    if (!haveStepFrom.has(m)) {
      missing.push({ from: `${cur.major}.${m}.0`, to: `${cur.major}.${m + 1}.0` });
    }
  }
  return missing;
}

export function noopManifest(from, to) {
  return {
    from,
    to,
    note:
      `Auto-generated no-op migration (npm run manifests:ensure). No scaffolded fullbody ` +
      `change across this minor; exists to keep the upgrade chain contiguous so ` +
      `'trellis upgrade' can step a project across ${from} -> ${to}. If this release ` +
      `actually added slots/files, replace this with a real manifest.`,
    playbooks: {},
  };
}

function listSteps() {
  return readdirSync(migrationsDir)
    .map((f) => /^(\d+\.\d+\.\d+)-to-(\d+\.\d+\.\d+)\.json$/.exec(f))
    .filter(Boolean)
    .map((m) => ({ from: m[1], to: m[2] }));
}

function main() {
  const pkg = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf-8"));
  const missing = planMissingSteps(pkg.version, listSteps());
  const created = [];
  for (const { from, to } of missing) {
    const file = resolve(migrationsDir, `${from}-to-${to}.json`);
    if (existsSync(file)) continue;
    writeFileSync(file, JSON.stringify(noopManifest(from, to), null, 2) + "\n");
    created.push(`${from}-to-${to}.json`);
  }
  if (created.length === 0) {
    console.log(`migration chain already complete up to ${pkg.version}`);
  } else {
    console.log(`created no-op manifest(s): ${created.join(", ")}`);
  }
}

if (resolve(process.argv[1] ?? "") === resolve(fileURLToPath(import.meta.url))) {
  main();
}
