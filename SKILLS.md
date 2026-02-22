# SKILLS.md — Skill Registry

> All custom skills for this project. Update this file whenever a skill is added, modified, or removed.
> 
> **AI INSTRUCTION:** Do NOT load all these skills into context at once. When working on a task, identify the relevant skill from this table, list the files in its directory, and strictly read only the `.md` or `.mdc` files necessary for your immediate task.
## Skills

| # | Skill Name | File | Purpose | Status |
|---|-----------|------|---------|--------|
| 1 | prompt-engineering-patterns | `.agents/skills/wshobson-prompt-engineering-patterns/` | Advanced prompt engineering techniques for optimizing LLM performance, reliability, and controllability | Active |
| 2 | superpowers | `.agents/skills/superpowers/` | Collection of skills and abilities downloaded from obra/superpowers | Active |
| 3 | nextjs-pro | `.agents/skills/nextjs-pro/` | Next.js Professional Setup (installed via prpm) | Active |
| 4 | startup-mvp | `.agents/skills/startup-mvp/` | Startup MVP Essentials (installed via prpm) | Active |
| 5 | vercel-composition-patterns | `.agents/skills/composition-patterns/` | React composition patterns that scale. Use when refactoring components, building flexible component libraries, or designing reusable APIs. | Active |
| 6 | vercel-react-best-practices | `.agents/skills/react-best-practices/` | React and Next.js performance optimization guidelines from Vercel Engineering. Use when writing, reviewing, or refactoring React/Next.js code. | Active |
| 7 | vercel-react-native-skills | `.agents/skills/react-native-skills/` | React Native and Expo best practices for building performant mobile apps. Use when building React Native components and mobile interfaces. | Active |
| 8 | web-design-guidelines | `.agents/skills/web-design-guidelines/` | Review UI code for Web Interface Guidelines compliance. Use when asked to check accessibility, audit design, or review UX. | Active |
| 9 | supabase-postgres-best-practices | `.agents/skills/supabase-postgres-best-practices/` | Postgres performance optimization and best practices from Supabase. Use when writing, reviewing, or optimizing Postgres queries, schema designs, or database configurations. | Active |

<!-- TEMPLATE — copy this row when adding a new skill:
| 1 | skill-name | `skills/skill-name.md` | Brief description of what it does | Active |
-->

## How to Add a New Skill

1. Create the skill file in `skills/` (e.g. `skills/my-skill.md`)
2. Add a row to the table above with: name, file path, purpose, status
3. Update the file structure in ACTION_PLAN.md §4 if the `skills/` tree changes
