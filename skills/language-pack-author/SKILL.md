---
name: language-pack-author
description: Create or revise PageCast Language Packs for a source-language and target-language pair, including bilingual scripts, metadata, glossary, and validation-ready files.
---

# PageCast Language Pack Author

Use this skill when the requested output is a PageCast Language Pack, not an ordinary Cast. Read [references/contract.md](references/contract.md) before authoring or revising content.

## Required workflow

1. Confirm the source language, target language, learner level, topic, and practice mode. The initial supported practice mode is `pause_and_speak`.
2. Create or preserve the package layout: `pack.json`, `glossary.csv`, and one `*_pagecast.txt` file per ordered stage/chapter.
3. Use the four pilot stages unless the user explicitly requests another curriculum: welcome, core phrases, guided dialogue, and review.
4. Keep every spoken block monolingual. Put source-language and target-language speech in separate tagged blocks; never mix both languages inside one narration or dialogue block.
5. Assign a language-specific narrator/character to every spoken block. The block language must match the assigned cast member unless that member is explicitly `language=multi`.
6. Keep learner support inline through paired blocks and learning metadata. Do not replace inline support with a translation-only appendix.
7. Treat learner practice as pause-and-speak: provide a pause and a prompt, but do not require typed answers, recording, grading, or speech recognition unless the product contract is explicitly expanded.
8. Run the repository validators before delivery:

   - `npm run check:contract`
   - `npm run check:language-pack-pilot` when validating the approved pilot

9. Report the generated files, language pair, stage count, validation results, and any unresolved pronunciation/TTS dependency.

## TTS and pronunciation invariant

Do not rely on autonomous TTS to infer a language from mixed text. Preserve explicit `language=` on each spoken block and explicit language-specific narrator/cast assignments. Media and Reader may use that metadata to select voices or browser speech fallback, but generated audio remains the authoritative pronunciation asset.

## Boundaries

- Do not change Reader, Studio, Media, or database code from this skill; implementation changes belong to the platform upgrade workflow.
- Do not silently add a new learning mode, answer collection, or schema field. Record a contract change first.
- Do not claim runtime/database readiness from text validation alone; distinguish content validation from platform verification.
