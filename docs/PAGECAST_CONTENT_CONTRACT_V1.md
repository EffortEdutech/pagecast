# PageCast Content Contract v1

Status: Draft for approval  
Date: 2026-10-21  
Scope: Reader, Creator Studio, Media, import/export, and Supabase content

## 1. Purpose

This document defines the shared content contract for PageCast Casts and Language Packs.

The contract is designed around one rule:

> One normalized content model must drive import, editing, media generation, storage, and playback.

The source text format, database JSON, media manifests, and Reader objects may have different representations, but they must preserve the same semantic fields.

## 2. Content kinds

Every Cast declares one content kind:

```text
contentType: cast
contentType: language_pack
```

`cast` is the existing story/audiobook format.  
`language_pack` is a learning experience built on the same chapters, scenes, blocks, characters, and assets.

Legacy Casts without `contentType` are treated as `cast`.

## 3. Pack-level contract

### Required fields

```json
{
  "schemaVersion": "1.0",
  "contentType": "language_pack",
  "slug": "id-en-greetings-a1",
  "title": "First English Greetings",
  "languages": {
    "source": { "code": "id", "label": "Indonesian" },
    "target": { "code": "en", "label": "English" }
  },
  "level": "A1",
  "practiceMode": "pause_and_speak",
  "chapters": []
}
```

### Content-kind rules

| Field | Ordinary Cast | Language Pack |
|---|---|---|
| `contentType` | `cast` | `language_pack` |
| `language` | one language code | deprecated as sole language field |
| `languages` | optional | required |
| `level` | optional | required |
| `practiceMode` | absent | required |
| `source`/`target` | absent | required |

`pack.json` remains a portable package manifest. The same semantic metadata must also be stored in the book/content record when imported.

## 4. Language model

Language codes use BCP-47 where practical:

```text
en       English
id       Indonesian
ar       Arabic
zh-CN    Mandarin Chinese, Simplified
ms       Malay
```

The pack's `source` language is the learner-support language. The `target` language is the language being learned.

For ordinary Casts, `language` may remain as the backward-compatible single-language field.

## 5. Cast member contract

Every cast member has one primary spoken language for a Language Pack.

```json
{
  "id": "narrator_id",
  "name": "Narrator Indonesian",
  "role": "narrator",
  "language": "id",
  "voiceId": "ai_female_warm",
  "voiceSource": "ai",
  "defaultVolume": 1.0
}
```

Rules:

- A language-specific narrator is a distinct cast member.
- A voice must not be selected solely by display name.
- `voiceId` identifies the provider voice or local voice.
- `language` is a routing constraint, not merely a label.
- A multi-language voice may explicitly declare `language: multi`, but it must not silently replace a language-specific voice.

## 6. Block contract

All spoken blocks carry an explicit language in a Language Pack.

```json
{
  "id": "block-001",
  "type": "narration",
  "text": "Dengarkan dulu. Anda tidak perlu bercakap lagi.",
  "characterId": "narrator_id",
  "language": "id",
  "learning": {
    "role": "instruction",
    "pairedBlockId": "block-002"
  }
}
```

### Spoken block rules

- A spoken block contains one language only.
- `language` is required for `narration`, `dialogue`, `thought`, and `quote` in a Language Pack.
- `characterId` is required for dialogue and thought; recommended for narration and quote.
- `characterId.language` must match `block.language`, unless the cast member explicitly declares `multi`.
- A mixed-language block is invalid and must be rejected by validation.
- Translation or explanation is represented as a separate block, not embedded in the same spoken text.

### Non-spoken block rules

Pause and SFX blocks do not require a language. Their optional learning metadata may reference a language or paired block.

## 7. Learning metadata

Learning metadata is optional on ordinary Casts and required where relevant in a Language Pack.

```json
{
  "learning": {
    "role": "model | translation | instruction | prompt | answer | review",
    "pairedBlockId": "block-id",
    "practice": "listen | repeat | speak | learner_turn | recall",
    "register": "casual | neutral | polite | formal",
    "phraseId": "greeting-hello-01"
  }
}
```

The first pilot uses:

```text
practiceMode: pause_and_speak
```

This means the Reader plays the prompt and pause but does not record, transcribe, store, or grade the learner's response.

## 8. Source text format

The canonical PageCast text form remains human-readable.

```text
::PAGECAST_BOOK
Title: First English Greetings
ContentType: language_pack
SchemaVersion: 1.0
Languages: id,en
SourceLanguage: id
TargetLanguage: en
Level: A1
PracticeMode: pause_and_speak
Default Narrator: narrator_id
::

::CAST
Narrator Indonesian: narrator_id | role=narrator | language=id | voice=ai_female_warm
Narrator English: narrator_en | role=narrator | language=en | voice=ai_male_calm
::

## SCENE 1: Welcome
Ambience: quiet_room
Music: warm_acoustic

[NARRATION: narrator_id | language=id | learningRole=instruction | pair=welcome-en]
Dengarkan dulu. Anda tidak perlu bercakap lagi.

[NARRATION: narrator_en | language=en | learningRole=instruction | pair=welcome-id]
Listen first. You do not need to speak yet.
```

The parser must preserve the explicit target, options, language, and learning metadata. It must not infer language from the text.

## 9. Normalized runtime model

Reader, Studio, and Media should converge on these normalized concepts:

```text
ContentPackage
  metadata
  languages
  cast[]
  chapters[]
    scenes[]
      blocks[]
  assets[]
```

The normalized model may be represented in TypeScript, JSONB, or Python dictionaries, but field names and semantics must remain equivalent.

## 10. Audio asset contract

Each generated or uploaded spoken asset is tied to a block and language.

```json
{
  "assetId": "audio-block-001-v1",
  "blockId": "block-001",
  "language": "id",
  "voiceId": "ai_female_warm",
  "provider": "openai",
  "url": "https://...",
  "durationMs": 2100,
  "status": "ready"
}
```

Media must not generate audio from a text block without knowing its language and resolved voice.

Audio filename convention:

```text
<pack-slug>__<chapter>__<scene>__<block-order>__<language>__<voice-id>.<ext>
```

Example:

```text
id-en-greetings-a1__ch01__sc01__b003__id__ai_female_warm.wav
```

## 11. Component responsibilities

### Creator Studio

- Import source files into the normalized model.
- Preserve all pack, language, cast, block, and learning metadata.
- Allow editing without collapsing language-separated blocks.
- Show language and voice on each spoken block.
- Send block language and resolved voice to TTS.
- Export a lossless PageCast package.

### Media

- Read the normalized model or a contract-compliant source file.
- Resolve one voice for each spoken block.
- Generate language-correct audio.
- Write block-linked manifests and deterministic asset names.
- Report missing language, voice, or pronunciation configuration as errors.

### Reader

- Render the ordered blocks without changing their text.
- Play stored block audio first.
- Use block language for Web Speech fallback.
- Use the block's cast member and language when selecting a fallback voice.
- Render pause-and-speak moments as timed pauses.
- Keep learning metadata available for future practice UI without requiring it in the first pilot.

## 12. Backward compatibility

Existing Casts must continue to work:

- missing `contentType` means `cast`;
- missing block `language` falls back to book language;
- missing cast language remains unrestricted for legacy content;
- existing audio URLs remain valid;
- existing `voice_config.json` remains supported during migration;
- old PageCast tags remain valid;
- new language-pack fields are ignored only by legacy readers after an explicit compatibility warning, never silently during publishing.

## 13. Validation gates

### Source validation

- valid schema version;
- valid source and target languages;
- every spoken block has one language;
- every spoken block resolves to a cast member;
- cast member language matches block language;
- no mixed-language spoken blocks;
- every pair reference points to an existing block when used.

### Media validation

- every spoken block has a resolved voice;
- provider supports the requested language;
- generated asset language equals block language;
- asset manifest points to the correct block;
- no duplicate asset identity for different text or language.

### Reader validation

- imported content preserves block order;
- stored audio plays against the correct block;
- fallback speech uses the block language;
- pauses advance correctly;
- ordinary Cast playback remains unchanged.

## 14. Implementation phases

### Phase 1 — Contract fixtures

Create a minimal ordinary Cast fixture and Indonesian → English Language Pack fixture. Validate both against the contract without changing production behavior.

### Phase 2 — Shared types and persistence

Add optional backward-compatible fields to shared types and JSONB content. Add book/package metadata for content type and languages.

### Phase 3 — Studio

Update parser, import pipeline, editor state, export, and TTS queue.

### Phase 4 — Media

Update local generators, manifests, voice configuration, and asset naming.

### Phase 5 — Reader

Update rendering metadata, stored audio selection, and browser TTS language selection.

### Phase 6 — End-to-end pilot

Import, generate, preview, publish, and play the pilot across all three components.

### Phase 7 — Reusable skills

Only after the pilot passes the three-component acceptance gate, build the reusable Language Pack skills.

## 15. Approval decisions required

1. Approve `Content Contract v1` as the shared design baseline.
2. Approve explicit block-level language as mandatory for Language Packs.
3. Approve separate language-specific cast members and voices.
4. Approve `pause_and_speak` as the first practice mode.
5. Approve backward compatibility for ordinary Casts.
6. Approve the phased implementation order across Studio, Media, and Reader.
