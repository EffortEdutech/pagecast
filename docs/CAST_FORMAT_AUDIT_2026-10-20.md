# PageCast Cast Format Audit

Date: 2026-10-20  
Scope: Reader, Creator Studio, Media, database model, and `.casts/`

Status: Read-only audit; no product code changed

## Executive finding

PageCast does not yet have one canonical Cast contract shared by Reader, Studio, and Media.

The current system has a useful common spine:

```text
book/Cast → chapters → scenes → blocks → character/voice → audio asset
```

However, each component currently interprets the spine differently:

- Studio parses PageCast text into editable blocks and stores block details in JSONB.
- Reader consumes database-shaped blocks and plays stored audio, with Web Speech fallback.
- Media parses the text files independently and uses a separate `voice_config.json` plus generated files/manifests.
- Existing `.casts` folders contain several historical conventions, not one versioned format.

Therefore, a Language Pack should not be implemented as a Studio-only extension. The canonical format must be defined first, then implemented across all three components.

## 1. Existing `.casts` observations

The collection contains multiple production patterns:

- `.casts/<slug>/script/*_pagecast.txt` — chapter scripts.
- `.casts/<slug>/voice_config.json` — external character-to-provider voice mapping in some Casts.
- `.casts/<slug>/voice/manifest.json` — generated audio inventory in some Casts.
- `.casts/<slug>/voice/*.wav` — generated local voice assets.
- `.casts/<slug>/ambience`, `sfx`, `images`, `pdf` — media outputs and publishing artifacts.
- Some `::CAST` lines use `lang=en`; the current parser does not preserve this as a typed language field.
- Some files use `Language: en`; this is a single story language, not a multi-language pack model.
- Naming and folder conventions vary across older Casts, pilots, and production exports.

Representative files inspected:

- `.casts/the-last-firefly/script/TheLastFirefly_Ch1_pagecast.txt`
- `.casts/glitch/script/Glitch_Ch1_pagecast.txt`
- `.casts/algoritma-tuhan/script/AlgoritmaTuhanCh1_pagecast.txt`
- `.casts/the-last-firefly/voice_config.json`
- `.casts/the-last-firefly/voice/manifest.json`

## 2. Shared content structure that is stable enough to retain

These elements are already used across the system and should remain the foundation:

- `::PAGECAST_BOOK` metadata block;
- `::CAST` cast declaration block;
- chapter headings;
- scene headings;
- scene metadata: `Ambience`, `Music`, `Location`, `Time`;
- block types: narration, dialogue, thought, quote, pause, and SFX;
- character identity on dialogue/thought blocks;
- audio attached to individual blocks;
- scene ambience/music attached to scenes.

This is the compatibility base for ordinary Casts.

## 3. Creator Studio findings

### Importer

`apps/creator-studio/src/lib/textParser.ts` recognizes PageCast tags and captures basic book/cast metadata.

Current behavior:

- `::PAGECAST_BOOK` captures title, author, language, genre, and default narrator.
- `::CAST` captures display name, slug, role, voice descriptor, color, and appearance.
- `[DIALOGUE: character | emotion=...]` stores a character hint for later resolution.
- `[NARRATION: target | ...]` parses the target syntactically, but narration creation does not preserve it as a character assignment.
- Unknown metadata such as `::PAGECAST_LANGUAGE_PACK` is skipped.
- Arbitrary options such as `language=id` are parsed as text options but are not stored on blocks or cast members.

### Studio data model

Creator types currently define:

- `Story.language: string` — one story-level language;
- `Character.voiceId`, but no character language;
- `BaseBlock` with audio, duration, speed, and performance tag;
- `NarrationBlock.characterId`, but no block language;
- JSONB block content in Supabase.

This can represent a language pack only after adding language-pack metadata, block language, and cast-member language.

## 4. Reader findings

Reader types mirror Studio closely but currently have the same limitations:

- story language is one string;
- blocks have no language field;
- characters have no language field;
- stored block audio plays correctly when `audioUrl` exists;
- Web Speech fallback currently filters available browser voices to English (`lang.startsWith('en')`);
- fallback voice selection is positional rather than language-aware;
- Reader display can show blocks in order, but has no language-pack learning semantics yet.

Consequences for Language Packs:

- pre-generated audio can work if each block receives the correct audio asset;
- browser TTS fallback cannot safely pronounce Indonesian and English in one Cast today;
- the Reader needs language-aware fallback and optional learning presentation metadata;
- pauses already exist and can support the pilot's pause-and-speak behavior without recording.

## 5. Media findings

There are two relevant media paths:

### Creator Studio TTS

The Studio TTS route accepts a language value for local Qwen/Chatterbox paths, but the current editor queue passes the story language. It does not derive language from an individual block.

### Local media scripts

`skills/generate_voices.py` independently parses PageCast text. It:

- extracts cast slugs and labels;
- reads `voice_config.json` for provider and voice IDs;
- parses narration/dialogue/thought blocks;
- generates audio by character mapping;
- does not preserve or route block language;
- does not interpret `::PAGECAST_LANGUAGE_PACK`;
- does not use `lang=` from `::CAST` as a typed language constraint.

Other media tools such as image and ambience generation use their own lightweight PageCast parsing and primarily need scene/chapter/narration context. They should consume a shared normalized representation rather than each reparsing raw text indefinitely.

## 6. Database findings

The current Supabase schema stores:

- books;
- characters;
- chapters;
- scenes;
- blocks with JSONB `content`.

The schema has no dedicated language-pack table or language columns on characters/blocks. The existing book language appears in application types and UI assumptions but is not a complete multi-language content contract in the inspected base schema.

The JSONB block content gives us a safe compatibility path: ordinary Casts can keep their existing shape while Language Pack blocks gain versioned optional fields. A later migration can promote frequently queried fields to columns if needed.

## 7. Compatibility result for the current pilot files

The pilot files are PageCast-shaped and can be recognized by Studio, but they are not end-to-end executable as a Language Pack today.

| Capability | Studio | Reader | Media |
|---|---|---|---|
| Chapters/scenes | Works | Works after import | Works in independent parser |
| Basic narration/dialogue | Works | Works after import | Works |
| Separate language blocks | Language option lost | No language field | Language ignored |
| Language-specific narrator | Narration target not retained | No language voice routing | Character mapping only |
| Pause-and-speak | Pause imports | Pause playback exists | Can skip/generate no voice |
| Pack metadata | Ignored | No pack model | Ignored |
| Correct autonomous TTS | Not guaranteed | Browser fallback unsafe | Not guaranteed |

## 8. Required canonical contract before implementation

The next design artifact should define a versioned `PageCast Content Contract`, with at minimum:

```text
Pack identity:
  contentType: cast | language_pack
  schemaVersion
  languages: [{ code, role: l1 | l2, label }]

Cast identity:
  id/slug, name, role, voiceId, language

Block:
  type, text/content, characterId, language, performance/learning metadata

Audio asset:
  blockId, language, voiceId, provider, file/url, duration, status
```

The contract must specify which fields are:

- required in source files;
- preserved by Studio import/export;
- stored in Supabase;
- consumed by Reader;
- consumed by Media;
- optional and safely ignored by legacy Casts.

## 9. Recommended implementation order

1. Freeze the canonical content contract on paper.
2. Build one shared parser/normalizer or shared parsing rules for Studio and Media.
3. Add backward-compatible optional fields to shared TypeScript types and JSONB content.
4. Add database/content metadata for multi-language packs.
5. Update Studio import, editor, export, and TTS queue.
6. Update Media scripts and manifests to carry block language and voice language.
7. Update Reader display, audio playback, and Web Speech fallback.
8. Run the Indonesian → English pilot through all three components.
9. Only after end-to-end approval, formalize the reusable Language Pack skills.

## 10. Audit conclusion

The existing PageCast format is a strong draft for ordinary story Casts, but it is not yet a solid cross-component contract. Language Packs expose the current split clearly because pronunciation depends on language at block level, while the current system mostly assumes one language per Cast.

No upgrade should begin until the canonical contract is approved and the three-component compatibility matrix is turned into acceptance tests.
