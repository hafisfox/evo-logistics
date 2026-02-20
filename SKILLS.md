# SKILLS.md — Skill Registry

> All custom skills for this project. Update this file whenever a skill is added, modified, or removed.

## Skills

| # | Skill Name | File | Purpose | Status |
|---|-----------|------|---------|--------|
| 1 | prompt-engineering-patterns | `.agents/skills/wshobson-prompt-engineering-patterns/` | Advanced prompt engineering techniques for optimizing LLM performance, reliability, and controllability | Active |
| 2 | n8n-code-javascript | `.agents/skills/n8n-code-javascript/` | Write JavaScript code in n8n Code nodes | Active |
| 3 | n8n-code-python | `.agents/skills/n8n-code-python/` | Write Python code in n8n Code nodes | Active |
| 4 | n8n-expression-syntax | `.agents/skills/n8n-expression-syntax/` | Validate n8n expression syntax and fix common errors | Active |
| 5 | n8n-mcp-tools-expert | `.agents/skills/n8n-mcp-tools-expert/` | Expert guide for using n8n-mcp MCP tools effectively | Active |
| 6 | n8n-node-configuration | `.agents/skills/n8n-node-configuration/` | Operation-aware node configuration guidance | Active |
| 7 | n8n-validation-expert | `.agents/skills/n8n-validation-expert/` | Interpret validation errors and guide fixing them | Active |
| 8 | n8n-workflow-patterns | `.agents/skills/n8n-workflow-patterns/` | Proven workflow architectural patterns from real n8n workflows | Active |

<!-- TEMPLATE — copy this row when adding a new skill:
| 1 | skill-name | `skills/skill-name.md` | Brief description of what it does | Active |
-->

## How to Add a New Skill

1. Create the skill file in `skills/` (e.g. `skills/my-skill.md`)
2. Add a row to the table above with: name, file path, purpose, status
3. Update the file structure in ACTION_PLAN.md §4 if the `skills/` tree changes
