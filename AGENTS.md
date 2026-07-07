# AGENTS.md

## Project Identity

Project name: pageCast

pageCast storybook, creator studio, reader app, and publishing workflow project.

This repository is part of the Effort Studio AI development workspace.

Central Obsidian vault:

``text
C:\Users\user\Documents\00 AI agent\AI-Knowledge
``

## AI Assistant Operating Rules

Before making changes:

1. Read this AGENTS.md.
2. Read CLAUDE.md only if it adds relevant project-specific guidance.
3. Read $(System.Collections.Hashtable.DocsStart) if it exists.
4. Query graphify-out/graph.json if it exists.
5. Inspect source files directly before editing.
6. Preserve existing architecture, conventions, and security boundaries.
7. Prefer small, reviewable changes.
8. Do not introduce new production dependencies without approval.
9. Update docs when behavior, APIs, schemas, commands, or operating rules change.

## Graphify Rules

Use Graphify for code navigation and relationship discovery.

``powershell
.\scripts\graphify.ps1 query "question" --graph "graphify-out\graph.json"
.\scripts\graphify.ps1 explain "symbol-or-file" --graph "graphify-out\graph.json"
.\scripts\graphify.ps1 path "A" "B" --graph "graphify-out\graph.json"
``

After meaningful code structure changes, refresh the graph using the project workflow in this file or regenerate from the configured code folders.

## Obsidian Rules

Use Obsidian for architecture rationale, ADRs, cross-project standards, roadmap context, meeting notes, and research.

Do not duplicate project implementation docs into Obsidian. Link to repository docs instead.

## Commands

- `npm run creator-studio`
- `npm run reader-app`

Run only the checks relevant to the change.

## Done Criteria

A task is complete when:

- changes are implemented,
- relevant checks were run or blockers are explained,
- documentation is updated if needed,
- Graphify is refreshed after meaningful structural changes,
- the final response explains what changed and how it was verified.

<!-- AI-DEVELOPMENT-WORKSPACE-GRAPHIFY-OBSIDIAN -->

## AI Development Workspace: Graphify + Obsidian

This repository is part of the Effort Studio AI development workspace.

Central Obsidian vault:

``text
C:\Users\user\Documents\00 AI agent\AI-Knowledge
``

Use Graphify for code navigation:

``powershell
.\scripts\graphify.ps1 query "question" --graph "graphify-out\graph.json"
.\scripts\graphify.ps1 explain "symbol-or-file" --graph "graphify-out\graph.json"
.\scripts\graphify.ps1 path "A" "B" --graph "graphify-out\graph.json"
``

Use Obsidian only for architecture rationale, ADRs, roadmap context, research, meetings, and cross-project decisions. Project-specific implementation docs remain in this repository.

Before editing, read AGENTS.md, read $(System.Collections.Hashtable.DocsStart) if it exists, query Graphify if graphify-out/graph.json exists, then inspect source files directly.
