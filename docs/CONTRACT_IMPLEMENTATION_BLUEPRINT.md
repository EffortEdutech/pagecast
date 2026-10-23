# Content Contract v1 — Implementation Blueprint

Status: Design only; production implementation not started

## Shared TypeScript model delta

The implementation should add optional fields first so ordinary Casts remain compatible.

```ts
export type ContentType = 'cast' | 'language_pack'

export interface ContentLanguages {
  source?: { code: string; label?: string }
  target?: { code: string; label?: string }
}

export interface LanguagePackLearning {
  role?: 'model' | 'translation' | 'instruction' | 'prompt' | 'answer' | 'review'
  pairedBlockId?: string
  practice?: 'listen' | 'repeat' | 'speak' | 'learner_turn' | 'recall'
  register?: 'casual' | 'neutral' | 'polite' | 'formal'
  phraseId?: string
}
```

Add to `Story`:

```ts
contentType?: ContentType
schemaVersion?: string
languages?: ContentLanguages
level?: string
practiceMode?: 'pause_and_speak'
```

Add to `Character`:

```ts
language?: string | 'multi'
```

Add to `BaseBlock`:

```ts
language?: string
learning?: LanguagePackLearning
```

## Persistence strategy

Use the existing JSONB `blocks.content` for block-level fields during the first migration. Add book-level metadata in a backward-compatible book metadata/content field or explicitly approved columns. Do not split Language Packs into a parallel block table.

Required persistence invariants:

- import → database → Reader preserves `language`;
- import → database → Media preserves `characterId` and `language`;
- export preserves language and learning metadata;
- legacy blocks without `language` continue using the story language fallback.

## Component implementation order

1. Shared types and parser result types.
2. Studio parser and import pipeline.
3. Studio editor and TTS queue.
4. Media parser, voice config, and manifests.
5. Reader runtime types, audio selection, and browser TTS fallback.
6. Database migration and persistence verification.
7. End-to-end pilot test.

## Contract tests to add before code changes

- ordinary Cast fixture remains importable;
- Language Pack fixture is recognized;
- language metadata survives parsing;
- cast language survives parsing;
- narration target survives parsing;
- block language survives parsing;
- learning metadata survives parsing;
- mixed-language block validation fails;
- language-mismatched cast assignment fails;
- legacy Cast without language fields still imports.

The first two structural compatibility tests are now present in `textParser.test.ts`. The remaining tests should become active as each implementation phase lands.
