# AI Workspace Context

This file is a project-local bridge to the Effort Studio central Obsidian vault.

It exists because some Codex or Claude sessions mount only the project folder. In those sessions, the central vault may be outside the sandbox even though it exists on the machine.

## Central Vault

~~~text
C:\Users\user\Documents\00 AI agent\AI-Knowledge
~~~

## How To Use This File

- Read this file only for architecture rationale, ADR, roadmap, cross-project context, and workspace operating rules.
- Do not use this file as a replacement for project docs or source files.
- If the central vault is accessible, prefer the live vault note listed below.
- If the central vault is not accessible, use this local bridge as the fallback context and mention that the live vault was outside the current sandbox.

## Live Vault Note

~~~text
C:\Users\user\Documents\00 AI agent\AI-Knowledge\Projects\pageCast\Overview.md
~~~

## Synced Project Overview

# pageCast Overview

## Purpose

pageCast storybook, creator studio, reader app, and publishing workflow project.

## Repository

``text
C:\Users\user\Documents\00 StoryBook\pageCast
``

## Project Docs

Start with:

``text
docs\CHECKLIST.md
``

## AI Setup

Project-local assistant files:

``text
C:\Users\user\Documents\00 StoryBook\pageCast\AGENTS.md
C:\Users\user\Documents\00 StoryBook\pageCast\CLAUDE.md
``

Project-local Graphify wrapper:

``text
C:\Users\user\Documents\00 StoryBook\pageCast\scripts\graphify.ps1
``

## Current Graphify Scope

Initial code graph folders:

- `apps\creator-studio\src`
- `apps\creator-studio\app`
- `apps\reader-app\src`
- `apps\reader-app\app`
- `packages\types\src`
- `skills` with Graphify excludes for `node_modules`, caches, `.skill` docs, workflow assets, and prompt/test artifact folders.

Full semantic extraction may require an LLM API key if the repository contains Markdown, office documents, PDFs, images, or other non-code files.

## Related Notes

- [[Architecture/AI Development Workspace]]
- [[Architecture/Graphify + Obsidian Workflow]]
- [[Architecture/Codex + Claude Code Workflow]]

