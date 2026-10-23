# PageCast Language Pack — Delivery Design

Status: Approved pilot direction; implementation contract in progress  
Owner: PageCast product/content workflow  
Scope: Language-learning Casts for a learner's first language (L1) and target language (L2)

## 1. Product definition

A **Language Pack** is a PageCast Cast designed to help an Explorer learn and use a second language through a short, voiced, scene-based experience.

Examples:

- English → Arabic
- English → Chinese (Mandarin)
- Indonesian → English

The learner's source language is L1. The language being learned is L2. A pack may teach through a story, a practical situation, or a guided dialogue, but it must always produce usable language practice rather than only a translated story.

The existing PageCast terms remain in force:

- `Cast` = one complete learning experience.
- `Language Pack` = the learning product category and delivery contract.
- `Scene` = a situation or lesson segment.
- `Moment` = one learner interaction or content block.
- `Voice Mode` = listening and playback.
- `Page Mode` = reading and practice.

## 2. Core learning promise

Every Language Pack should help the learner complete one small communicative goal, such as:

> “By the end of this Cast, an Indonesian speaker can greet someone in English, ask their name, and respond politely.”

The pack is successful when the learner can:

1. understand the target phrases in context;
2. notice pronunciation and rhythm;
3. recall the meaning without looking at the translation;
4. produce the phrase in a short response;
5. reuse the phrase in a slightly changed situation.

## 3. Delivery layers

The base PageCast format remains the source of truth for import and playback. Language-learning fields are added as metadata and conventions around the existing blocks.

### 3.1 Pack metadata

The import header should carry, or be accompanied by, these fields:

```text
::PAGECAST_LANGUAGE_PACK
PackType: language_learning
L1: id
L2: en
Level: A1
LessonGoal: greet someone and ask their name
TranslationPolicy: inline_support
PronunciationPolicy: target_audio_first
Version: 0.1
::
```

For the first pilot, keep this metadata in a separate `language-pack.json` sidecar if changing the parser is not yet approved. The sidecar becomes the stable contract before database fields are introduced.

### 3.2 Language-isolated speech

Never place two languages in the same spoken block. A block is the unit of TTS routing and must contain one language only.

```text
[NARRATION: Narrator Indonesian | language=id]
Dengarkan dulu.

[NARRATION: Narrator English | language=en]
Listen first. You do not need to speak yet.
```

The pack must define a separate cast identity for each spoken language. TTS resolves block language first, then an explicit block voice, then a language-matched cast voice, and finally a pack fallback. Mixed-language blocks must be rejected or split; autonomous TTS must never infer language from a bilingual sentence.

### 3.3 Learning moment types

Use existing PageCast blocks wherever possible:

| Learning purpose | PageCast representation |
|---|---|
| Model phrase | `[DIALOGUE]` or `[NARRATION]` in L2 |
| L1 meaning | `[NARRATION]` or `[QUOTE]` with a meaning label |
| Pronunciation model | Audio on the L2 block, with `performanceTag=target` |
| Slow repeat | Duplicate L2 block with `performanceTag=slow` |
| Learner prompt | `[PAUSE]` after a prompt block |
| Conversation role | `[DIALOGUE: character]` plus `role=learner|partner` metadata |
| Vocabulary note | `[QUOTE]` with `style=default` and `note` metadata |
| Cultural/use note | `[NARRATION]` marked `note=culture` |
| Review checkpoint | Scene boundary and explicit review metadata |

The first implementation should not introduce new production block types. A later schema may add a first-class `languageMoment` object once the pilot proves which interactions are needed.

### 3.4 Learner-facing scene rhythm

Each lesson scene should follow this rhythm:

1. **Listen** — hear the target phrase in a natural situation.
2. **Understand** — reveal L1 meaning and a short usage note.
3. **Notice** — highlight one pronunciation or grammar feature.
4. **Repeat** — play the phrase slowly, then naturally.
5. **Respond** — give the learner a pause to speak.
6. **Transfer** — reuse the phrase with one changed detail.

The content file may encode these with existing tags and metadata; the reader can initially present them as ordered moments in Page Mode and Voice Mode.

## 4. Recommended pack structure

```text
.casts/<language-pack-slug>/
  pack.json
  script/
    01_welcome_pagecast.txt
    02_core_phrases_pagecast.txt
    03_guided_dialogue_pagecast.txt
    04_review_pagecast.txt
  glossary.csv
  pronunciation.md
  qa/
    content-review.md
    audio-review.md
```

`pack.json` is the contract for the pack, not a replacement for PageCast script files.

Suggested `pack.json` shape:

```json
{
  "schemaVersion": "0.1",
  "type": "language_pack",
  "slug": "id-en-greetings-a1",
  "title": "First English Greetings",
  "l1": "id",
  "l2": "en",
  "level": "A1",
  "lessonGoal": "greet someone and ask their name",
  "estimatedMinutes": 10,
  "chapters": [
    { "id": "welcome", "file": "script/01_welcome_pagecast.txt" },
    { "id": "core-phrases", "file": "script/02_core_phrases_pagecast.txt" },
    { "id": "guided-dialogue", "file": "script/03_guided_dialogue_pagecast.txt" },
    { "id": "review", "file": "script/04_review_pagecast.txt" }
  ],
  "assessment": {
    "successCriteria": [
      "understands three target phrases",
      "repeats the phrases aloud",
      "completes a four-turn dialogue"
    ]
  }
}
```

## 5. Translation and language rules

- L2 is the language of action: model phrases, dialogue, and learner prompts should use L2 as early as possible.
- L1 is support, not the main experience: use it for meaning, safety, instructions, and concise explanations.
- Never rely on translation alone. Every target phrase must appear in a situation and be heard.
- Keep one canonical translation per phrase in the pilot. Record alternatives only in the glossary.
- Mark register: `casual`, `polite`, `formal`, or `child-friendly`.
- Mark regional variation when it matters, for example Arabic dialect or Mandarin regional usage.
- Do not use phonetic spelling as the only pronunciation aid. Audio is primary; romanization is optional support.
- A human reviewer fluent in both L1 and L2 must approve the final script before audio generation.

## 6. Skill and pipeline design

The workflow should eventually be implemented as these reusable skills. The names are proposed so Codex and Claude Cowork can share the same mental model.

### `language-pack-planner`

Input: L1, L2, learner level, lesson goal, learner profile, pack length.  
Output: learning objectives, phrase inventory, scene sequence, assessment criteria, risk notes.

### `language-pack-writer`

Input: approved plan and phrase inventory.  
Output: PageCast-ready chapter files plus `pack.json` draft.  
Rules: preserve L1/L2 roles, tag every phrase, include controlled repetition and a learner pause.

### `language-pack-reviewer`

Input: plan, script, glossary.  
Output: findings grouped into linguistic accuracy, pedagogy, cultural appropriateness, PageCast validity, and ambiguity.

### `language-pack-audio-director`

Input: approved script and cast.  
Output: voice map, speaking-speed plan, audio generation queue, and pronunciation exceptions.

### `language-pack-qa`

Input: script, imported Cast, generated audio, and reader preview.  
Output: acceptance report covering phrase alignment, translations, voice assignment, pauses, replay order, and learner completion path.

### `language-pack-publisher`

Input: QA-approved pack.  
Output: stable `.casts/<slug>` package and, when supported, a Creator Studio import/publish package.

## 7. Codex and Claude Cowork handoff

The shared authoring skill source is now maintained at
`skills/language-pack-author/SKILL.md`, with the contract reference at
`skills/language-pack-author/references/contract.md`. Codex and Claude Cowork
should use the same source instructions so generated packs do not diverge by
agent. This skill is content-authoring guidance; it does not replace the
three-component runtime acceptance gate.

Both agents should use the same artifact sequence:

```text
brief → plan → phrase inventory → draft script → language review → import → audio QA → pilot approval → reusable skill
```

Codex responsibilities:

- inspect repository conventions and existing parser/block behavior;
- create or update repository documentation and scripts;
- validate file names, metadata, parser compatibility, and import results;
- run the relevant checks and record evidence.

Claude Cowork responsibilities:

- challenge the lesson design and learning progression;
- review linguistic and cultural risks;
- inspect the pack as a learner and identify confusing or unnecessary moments;
- propose revisions without silently changing the approved contract.

Handoff rule: an agent must leave a short `qa/` or review note describing what was checked, what remains uncertain, and whether the next stage is approved. No agent should generate a new language pair from an unapproved pilot contract.

## 8. Pilot recommendation

Recommended first pilot: **Indonesian → English, A1, “First English Greetings.”**

Why this pilot:

- the language pair is immediately useful and represented in the intended market;
- the lesson goal is narrow enough to evaluate in one short Cast;
- it tests both L1 support and L2 performance without requiring advanced grammar;
- it can expose the full pipeline: writing, import, cast assignment, TTS, pauses, review, and reader preview.

Pilot scope:

- 1 Cast;
- 4 short chapters/scenes;
- 8–12 target phrases;
- 10–15 minutes;
- 2 speakers: narrator and conversation partner;
- learner role performed through pause prompts;
- one final guided dialogue and recall check.

The pilot should now be drafted under this approved direction. Its approval gate is: a bilingual reviewer confirms the language, a learner can complete the journey without hidden instructions, and the imported Cast plays in the existing PageCast reader.

## 9. Implementation sequence after pilot approval

1. Create the pilot pack files under `.casts/id-en-greetings-a1/`.
2. Import the PageCast scripts into Creator Studio.
3. Verify which metadata survives import and which requires a sidecar.
4. Generate or assign audio and run reader QA.
5. Review the pilot with a bilingual learner.
6. Freeze the smallest useful `pack.json` schema.
7. Convert the proposed skills into repository skills/prompts.
8. Add automated validation for pack metadata, phrase pairing, missing translations, and invalid PageCast tags.
9. Only then generalize to Arabic, Mandarin, English, Malay, or other language pairs.

## 10. Open decisions for approval

1. Approve Indonesian → English as the first pilot pair, or select another pair.
2. Approve inline L1 support for the pilot, rather than a translation-only appendix.
3. Approve the four-stage pilot structure: welcome, core phrases, guided dialogue, review.
4. **Pilot decision: pause-and-speak.** The Cast presents a prompt, pauses, and the learner answers aloud independently. The first pilot does not record, transcribe, store, or grade the answer. Collected typed/recorded answers are a later interaction feature.
5. **Pilot decision: first-class content field.** Language-pack metadata should be represented in the PageCast content/database model immediately, while the pilot package may still retain `pack.json` as an export/import artifact for portability and review.
