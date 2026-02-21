# CLAUDE.md — Evo Logistics

> For business logic, process flows, data standards, and tech stack → see [ACTION_PLAN.md](ACTION_PLAN.md)

## Development Guidelines

- **Reference ACTION_PLAN.md** — all business rules, constants, workflows, and data standards live there; update it when they change
- **Reference AUTOMATIONS.md** — all running automation code is now in `automations/AUTOMATIONS.md` (Serverless Python via Modal).
- **Remove stale data** — delete entries that no longer apply rather than commenting them out
- **Compact format** — use tables and bullets; no prose paragraphs; every line must be actionable
- **Workflow changes** — after modifying python code in `automations/`, reflect logical changes in ACTION_PLAN.md
- **New phases** — add new python scripts to the `automations/` directory
- **New skills** — when adding a skill, register it in `SKILLS.md` and place the file in `skills/`
- **Credentials** — never store secrets in any markdown file; reference the `.env` file and `token.json` only


