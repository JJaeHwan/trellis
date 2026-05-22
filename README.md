# trellis

> Opinionated project scaffolder and validator for the AI-coding era.

[![npm](https://img.shields.io/npm/v/@woghks096/trellis.svg)](https://www.npmjs.com/package/@woghks096/trellis)
[![license](https://img.shields.io/npm/l/@woghks096/trellis.svg)](LICENSE)

## What is trellis?

trellis turns your methodology into an executable CLI. You and your AI agents scaffold, extend, and validate projects from the same opinionated playbooks — so structure stays consistent whether a human or an agent writes the code.

- Three built-in playbooks: `cli-tool` / `b2b-saas` / `ai-rag-platform`
- `trellis new` bootstraps a new project through a short interview
- `trellis add` extends an existing project with idempotent fragments
- `trellis check` / `trellis doctor` enforce architecture rules and doc–code consistency

## Quick start

```bash
npm i -g @woghks096/trellis
trellis new my-project
```

One-off (no global install):

```bash
npx @woghks096/trellis new my-project
```

## Commands

```bash
trellis new <dir>           # Interview → match playbook → scaffold + .trellis/spec.json
trellis add <type> <name>   # Add a fragment (idempotent, multi-slot patch)
trellis remove <type> <name> # Remove a fragment (reverse of add, idempotent)
trellis list [type]         # Browse available fragments (--json for scripting)
trellis upgrade [dir]       # Migrate project to the latest trellis (slot inserts + spec.json bump)
trellis check <dir>         # Detect layered-architecture violations
trellis doctor <dir>        # Check doc / code / playbook consistency
```

All commands support `--json` for AI / script consumption.

## Fragment Patches

Fragments extend your project in two ways:

- **Block-style markers** — Templates declare `// trellis:slot:<name>:start/end` blocks where fragment entries are inserted (idempotent by `entryKey`).
- **AST patches** (P15) — Fragments with `astPatches` use ts-morph selectors (`arrayPush`, `objectKey`, `importAdd`) to update exports without markers. Enables external fragment catalogs without modifying base templates.

Both mechanisms coexist — a single fragment can use markers + AST patches together.

## Why

Predictable quality matters most when you code with AI agents. Instead of asking humans and agents to re-interpret methodology documents every time, trellis makes the rules executable:

- One CLI command reproduces the same structure every time
- Architecture violations are caught automatically (`trellis check .` passes on this repo itself)
- Methodology becomes self-validating, not just documented

## Status

**v0.10.0** on npm — daily-driver maturity (L4 graduated)

> v0.11.0 was tagged on GitHub but never reached npm — npm rotated
> granular write tokens in response to the "Mini Shai-Hulud" supply-chain
> pattern at the same moment the publish workflow tried to run. The
> pipeline is now wired to Trusted Publishing (OIDC + provenance), and
> all P13 work ships on the next release.

P0–P13 complete: scaffolding, interview, generator, validator, doctor, `trellis add` (fragment + multi-slot patch), `trellis list` (list / detail / `--json`), cli-tool dogfooding fragments (`command` + `service-module`), `trellis upgrade` (migration manifest, idempotent slot inserts, `--dry-run`/`--force`). All commands include `--json`, actionable error hints, and doctor 6-rules.

`release-please` automates version bumps on `feat:`/`fix:` commits, including version-constant sync via `extra-files`.

Roadmap: [`docs/plans/`](docs/plans/)

## Supported playbooks

| Playbook | Description |
|---|---|
| `cli-tool` | Single-binary CLI — this repo follows it |
| `b2b-saas` | Auth + multi-tenant SaaS (sidebar + authed route group) |
| `ai-rag-platform` | Document upload + RAG + LLM pipeline (sidebar included) |

## Development

```bash
npm install
npm run build
npm run test
npm run lint
```

## Korean version

[한국어 README →](README.ko.md)

## License

MIT — see [LICENSE](LICENSE).
