@AGENTS.md

## Claude Code Specific Instructions

Use Claude Code primarily for planning, architecture review, refactor strategy, risk analysis, code review, and documentation review.

Before broad edits:

1. Read AGENTS.md.
2. Query or inspect graphify-out/graph.json if available.
3. Explain the plan before structural changes.
4. Do not edit the same files that Codex is currently editing.

<!-- AI-DEVELOPMENT-WORKSPACE-GRAPHIFY-OBSIDIAN -->

## AI Development Workspace: Graphify + Obsidian

This repository is part of the Effort Studio AI development workspace.

Central Obsidian vault:

~~~text
C:\Users\user\Documents\00 AI agent\AI-Knowledge
~~~

Use Graphify for code navigation:

~~~powershell
.\scripts\graphify.ps1 query "question" --graph "graphify-out\graph.json"
.\scripts\graphify.ps1 explain "symbol-or-file" --graph "graphify-out\graph.json"
.\scripts\graphify.ps1 path "A" "B" --graph "graphify-out\graph.json"
~~~

Refresh Graphify after meaningful code structure changes:

~~~powershell
.\scripts\graphify.ps1 update .
~~~

~~~bash
./scripts/graphify.sh update .
~~~

The `.ps1` wrapper is for Windows. The `.sh` wrapper is for Linux/macOS and Claude sandboxes; it installs the PyPI package `graphifyy` on demand and then runs `graphify`.

Use Obsidian only for architecture rationale, ADRs, roadmap context, research, meetings, and cross-project decisions. Project-specific implementation docs remain in this repository.

Before editing, read AGENTS.md, read `docs/CHECKLIST.md` if it exists, query Graphify if graphify-out/graph.json exists, then inspect source files directly.

<!-- AI-WORKSPACE-CONTEXT-FALLBACK -->

## Obsidian Fallback Context

The central Obsidian vault lives at:

~~~text
C:\Users\user\Documents\00 AI agent\AI-Knowledge
~~~

Some Codex or Claude sessions mount only this project folder. If the live vault is outside the current sandbox, read this local bridge instead:

~~~text
docs\AI_WORKSPACE_CONTEXT.md
~~~

Use the bridge only for architecture rationale, ADRs, roadmap context, cross-project standards, and workspace operating context. Do not use it as a replacement for project docs, Graphify, or source inspection.
