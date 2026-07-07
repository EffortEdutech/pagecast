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
