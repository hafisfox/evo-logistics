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
| 10 | prompt-engineer | `.agents/skills/prompt-engineer/` | Prompt optimization playbook with practical frameworks and reusable patterns for higher-quality model outputs. | Active |
| 11 | prompt-engineering | `.agents/skills/prompt-engineering/` | Core prompt-engineering foundations for structuring instructions, constraints, and examples effectively. | Active |
| 12 | prompt-engineering-patterns | `.agents/skills/prompt-engineering-patterns/` | Pattern catalog for prompt design (in addition to `wshobson-prompt-engineering-patterns`) with production-oriented templates. | Active |
| 13 | prompt-library | `.agents/skills/prompt-library/` | Reusable prompt snippets and starter templates for common tasks. | Active |
| 14 | prompt-caching | `.agents/skills/prompt-caching/` | Techniques to improve latency/cost through prompt reuse and cache-aware prompt design. | Active |
| 15 | llm-application-dev-prompt-optimize | `.agents/skills/llm-application-dev-prompt-optimize/` | Prompt optimization guidance specifically for LLM application workflows and iteration loops. | Active |
| 16 | llm-evaluation | `.agents/skills/llm-evaluation/` | Evaluation frameworks for measuring prompt/model quality, regressions, and reliability. | Active |
| 17 | context-fundamentals | `.agents/skills/context-fundamentals/` | Context-engineering fundamentals for managing token budgets and information hierarchy. | Active |
| 18 | context-compression | `.agents/skills/context-compression/` | Compression strategies for preserving critical information in constrained context windows. | Active |
| 19 | context-optimization | `.agents/skills/context-optimization/` | End-to-end context optimization methods for long-running agent sessions and multi-step tasks. | Active |
| 20 | ui-ux-pro-max | `.agents/skills/ui-ux-pro-max/` | Comprehensive UI/UX design intelligence skill with searchable guidance, data palettes, and implementation templates across multiple stacks. | Active |

<!-- TEMPLATE — copy this row when adding a new skill:
| 1 | skill-name | `.agents/skills/skill-name/` | Brief description of what it does | Active |
-->

## Sync Note

- Local project skills are stored in both `.agents/skills/` and `.claude/skills/` for tool compatibility in this repository.
- Any new skill added for project use should be mirrored to both locations.

## How to Add a New Skill

1. Add the skill directory under `.agents/skills/` (e.g. `.agents/skills/my-skill/`) and mirror it to `.claude/skills/my-skill/`.
2. Add a row to the table above with: name, file path, purpose, status.
3. Update `CLAUDE.md` guidance if skill-loading rules or locations change.
