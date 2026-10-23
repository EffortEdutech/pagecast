# Language Pack Content Contract

## Package

```text
<slug>/
├── pack.json
├── glossary.csv
└── script/
    ├── 01_welcome_pagecast.txt
    ├── 02_core_phrases_pagecast.txt
    ├── 03_guided_dialogue_pagecast.txt
    └── 04_review_pagecast.txt
```

`pack.json` is first-class content metadata. It must identify the content type, schema version, source and target languages, learner level, practice mode, ordered stages, and narrator mapping.

## Header

Each PageCast script begins with a `::PAGECAST_BOOK` block. A Language Pack declares:

```text
ContentType: language_pack
SourceLanguage: id
TargetLanguage: en
Level: A1
PracticeMode: pause_and_speak
```

The `::CAST` block declares one cast member per speech language, for example:

```text
Narrator Indonesian: narrator_id | role=narrator | language=id
Narrator English: narrator_en | role=narrator | language=en
```

## Spoken blocks

Use explicit language and target metadata:

```text
[NARRATION: narrator_id | language=id | learningRole=instruction | phraseId=welcome]
Dengarkan dulu. Anda tidak perlu bercakap lagi.

[NARRATION: narrator_en | language=en | learningRole=instruction | phraseId=welcome]
Listen first. You do not need to speak yet.
```

Supported learning roles are `model`, `translation`, `instruction`, `prompt`, `answer`, and `review`. Supported practice values are `listen`, `repeat`, `speak`, `learner_turn`, and `recall`.

## Authoring checks

- No spoken block is missing `language=`.
- No block is assigned to a cast member with a different language.
- Source and target text are separate blocks.
- Stage order is deterministic.
- Glossary phrase IDs are stable and match the script metadata where used.
- Pauses are explicit and learner turns do not contain a hidden answer.
