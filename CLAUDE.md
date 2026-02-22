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

## On-Demand Skill Loading

To keep the context window clean and avoid token bloat, **skills must be loaded dynamically only when needed**.
1. **Identify**: When starting a task, review `SKILLS.md` to see if a relevant skill exists for the technology you are working with (e.g., `vercel-react-best-practices` for dashboard UI work, `supabase-postgres-best-practices` for database queries/RLS).
2. **Fetch**: Use your file reading tools (like `list_dir` and `view_file`) to inspect the relevant skill folder in `.agents/skills/` or `.claude/skills/`.
3. **Read**: View the specific `.md` or `.mdc` files that apply to your exact task (e.g., `react.mdc` when writing React components).
4. **Apply**: Follow the best practices outlined in the skill document. Do not guess or assume the rules—read the file and apply them.


