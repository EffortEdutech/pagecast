---
name: elevenlabs-sfx-producer
description: >
  Generates SFX and Ambience audio for pageCast stories using the ElevenLabs
  Sound Effects API (AI-generated, no library needed). Reads every [SFX: label]
  tag (7 seconds) and Ambience: field (12 seconds) from a pageCast .txt file or
  an entire .casts/BOOKNAME/ folder, generates each as an MP3, and saves them to
  /sfx/ and /ambience/ subfolders ready for the Beat. Skips files that already
  exist (idempotent). ALWAYS use this skill when the user says "generate SFX",
  "generate ambience", "make audio for the cast", "ElevenLabs SFX", "create sound
  effects", or "produce audio" for a pageCast story.
---

# ElevenLabs SFX & Ambience Producer

Generates AI sound effects and ambience audio for pageCast stories via the
ElevenLabs Sound Effects API and saves them ready for the Beat.

---

## What this skill does

1. Parses a pageCast `.txt` file (or all files in a `.casts/BOOKNAME/` folder)
2. Extracts every unique `[SFX: label]` tag → generates **7-second** MP3 → saves to `/sfx/label.mp3`
3. Extracts every unique `Ambience: label` line → generates **12-second** MP3 → saves to `/ambience/label.mp3`
4. Skips labels whose file already exists (safe to re-run after adding chapters)

---

## Setup (one-time)

The user's ElevenLabs API key must have **Sound Effects → Access** enabled.
It can be passed via `--api-key` or set as an environment variable:

    export ELEVENLABS_API_KEY=sk_xxx

---

## How to run

### Entire collection (recommended)
    python scripts/generate_elevenlabs_audio.py \
      --folder ".casts/glitch" \
      --api-key "sk_xxx"

### Single chapter file
    python scripts/generate_elevenlabs_audio.py \
      --file ".casts/glitch/Glitch_Ch1_pagecast.txt" \
      --api-key "sk_xxx"

Run from the pageCast root folder (where the .casts/ directory lives).

---

## Output structure

    .casts/glitch/
    ├── Glitch_Ch1_pagecast.txt
    ├── sfx/
    │   ├── tyre_screech.mp3       ← 7 seconds
    │   ├── freeze_whoosh.mp3
    │   └── ...
    └── ambience/
        ├── city_traffic.mp3       ← 12 seconds
        ├── indoor_quiet.mp3
        └── ...

---

## Prompt enrichment

The script has a built-in label → descriptive prompt map for common pageCast labels.
Unknown labels are auto-converted from snake_case to natural language.

To add a custom prompt for a new label, edit SFX_PROMPT_MAP or AMBIENCE_PROMPT_MAP
in scripts/generate_elevenlabs_audio.py.

---

## After running

Tell the user:
- How many SFX and ambience files were generated
- How many were skipped (already existed)
- How many failed, with the error message
- The path to the /sfx/ and /ambience/ folders
