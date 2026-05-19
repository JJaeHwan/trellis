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
trellis list [type]         # Browse available fragments (--json for scripting)
trellis check <dir>         # Detect layered-architecture violations
trellis doctor <dir>        # Check doc / code / playbook consistency
```

All commands support `--json` for AI / script consumption.

## Why

Predictable quality matters most when you code with AI agents. Instead of asking humans and agents to re-interpret methodology documents every time, trellis makes the rules executable:

- One CLI command reproduces the same structure every time
- Architecture violations are caught automatically (`trellis check .` passes on this repo itself)
- Methodology becomes self-validating, not just documented

## Status

**v0.10.0** — daily-driver maturity (L4 graduated)

P0–P12 complete: scaffolding, interview, generator, validator, doctor, `trellis add` (fragment + multi-slot patch), `trellis list` (list / detail / `--json`), cli-tool dogfooding fragments (`command` + `service-module`). All commands include `--json`, actionable error hints, and doctor 5-rules.

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
