# PageCast — Creator Workflow: From Story to Published PBF

> Complete step-by-step guide for producing a finished PageCast audio storybook.
> Two paths are documented: **Import** (write elsewhere, bring in) and **Direct Craft** (write inside the studio).

---

## Overview

```
CREATE BOOK → SETUP CAST → WRITE CONTENT → ASSIGN VOICES → GENERATE AUDIO → ATMOSPHERE → PREVIEW → PUBLISH
```

---

## Step 1 — Create a New Book

1. Open **Creator Studio** → **Dashboard**
2. Click **New Book**
3. Fill in: Title, description, cover emoji, price (0 = free)
4. Click **Create** — the book is saved to Supabase and a default **Narrator** character is seeded automatically

> The book opens directly in the Story Editor.

---

## Step 2 — Set Up Characters & Voices

Before writing, define who speaks. This is the step most writers miss — voices must exist *before* audio can be generated.

1. Click **Characters & Voices** in the sidebar
2. Select your book from the Story dropdown
3. You will see the auto-created **Narrator** character — click it to assign a voice
4. Click **Add Cast Member** for each speaking character:
   - **Name** — e.g. "Maya", "David", "Sarah"
   - **Role** — `narrator` (for the storytelling voice) or `character` (for dialogue)
   - **Colour** — used to visually tag dialogue blocks in the editor
   - **Default Voice** — pick from the 14 AI voice profiles (Aria, Nova, Atlas, Echo, etc.)
5. Click **Add to Cast** — the character is saved to Supabase immediately

> **Voice assignment is saved per character in the database.** Changes survive page refresh.
>
> You can also assign voices by clicking a character card and selecting from the inline list,
> or by clicking a voice card on the right panel while a character is selected on the left.

### Voice Reference

| Voice ID | Label | Best for |
|---|---|---|
| ai_female_soft | Aria — Female Soft | Narrator, adult female |
| ai_female_warm | Nova — Female Warm | Warm adult female |
| ai_male_deep | Atlas — Male Deep | Adult male, authority |
| ai_male_calm | Echo — Male Calm | Narrator, calm male |
| ai_child_female | Lily — Child Female | Young girl character |
| ai_child_male | Finn — Child Male | Young boy character |
| ai_elder_female | Sage — Elder Female | Grandmotherly |
| ai_elder_male | Croft — Elder Male | Elderly male |
| ai_villain | Void — Villain | Antagonist |
| ai_whisper | Hush — Whisper | Secrets, inner voice |
| ai_dramatic | Rex — Dramatic | Intense scenes |
| ai_fantasy | Elara — Fantasy | Magical narration |
| ai_cartoon | Pip — Cartoon | Comic relief |
| ai_robot | Core — Robot | AI / mechanical character |

---

## Step 3A — Write Content Directly in the Studio Editor

1. From the **Dashboard**, click **Open** on your book (or you are already in the editor)
2. In the left panel, the **Chapter / Scene tree** shows your structure
3. Add chapters and scenes using the **+** buttons in the tree
4. In the center canvas, click **+ Add Block** and choose a block type:

### Block Types

| Block | Use for | Notes |
|---|---|---|
| **Narration** | Story description, setting the scene | Read by the Narrator character |
| **Dialogue** | A character speaking | Assign a character — their voice is used for TTS |
| **Thought** | Internal monologue | Assign a character — shown in italics |
| **Quote / Poem** | Epigraphs, letters, Quran verse | 4 style variants: default, poem, letter, quran |
| **SFX Trigger** | Sound effects | Pick from 26 library presets or type custom |
| **Pause** | Silent beat between blocks | Duration in seconds |

5. Type the text directly in each block
6. For **Dialogue** blocks: select the speaking character from the dropdown
7. For **Thought** blocks: select whose thought it is

> The editor auto-saves every mutation to Supabase. There is no manual save button.

---

## Step 3B — Import from a Text or PDF File

If you wrote your story in Word, Google Docs, Scrivener, or a plain text editor:

1. In the Studio Editor, click **Import Text** in the top header bar (file icon)
2. The Import modal opens — two panels: input (left) and preview (right)

### Supported input formats

| Format | How to prepare |
|---|---|
| **.txt** | Export/save as plain text. Both single-newline (PDF export) and double-newline (standard) are handled |
| **.md** | Markdown with `#` chapter headers and `##` scene headers |
| **.pdf** | Upload directly — text is extracted server-side via pdf-parse. Scanned/image PDFs will not work |
| **Paste** | Copy text from any app and paste into the textarea |

### What the parser detects automatically

- `Chapter 1:` / `# Chapter` → new chapter
- `Scene 2` / `## Scene` → new scene
- Lines inside `"quotes"` or `"curly quotes"` → **Dialogue** block
- Lines wrapped in `*asterisks*` or `(parentheses)` → **Thought** block
- Lines starting with `>` → **Quote** block
- `[SFX: door creak]` → **SFX** block
- `[pause: 2s]` → **Pause** block
- Everything else → **Narration** block

### Import steps

1. Paste text OR click **Upload file** and select `.txt`, `.md`, or `.pdf`
2. The parser runs automatically (for PDF, extraction happens server-side first)
3. The right panel shows a live preview: chapters → scenes → first 5 blocks each
4. Check the stats bar: chapters / scenes / blocks detected
5. If the format looks wrong, change the **Format** dropdown (Auto / Prose / Script / Markdown)
6. Click **Import into book** — all chapters, scenes, and blocks are created in your book

> **After import:** Dialogue blocks have `characterId: ''` (unassigned). You will see an
> "[assign character]" label on each one. Go through your dialogue blocks and select the
> correct character from the dropdown. This is the main post-import task.

---

## Step 4 — Assign TTS API Key (one-time setup)

Before generating audio, add your API key:

1. **Settings** (sidebar) → **AI Voice (TTS) Provider**
2. Choose **OpenAI TTS** or **ElevenLabs**
3. Paste your API key (stored locally in your browser — never in the database)
4. Click **Save Settings**

> OpenAI TTS is cheaper and faster. ElevenLabs produces more natural voices.
> Get an OpenAI key at platform.openai.com → API keys.

---

## Step 5 — Generate Audio for Blocks

Once characters have voices assigned and your API key is saved:

1. Open the **Story Editor** and navigate to any chapter/scene
2. Each block shows an audio row at the bottom:
   - Click **Upload** to use a recorded `.mp3` / `.wav` file
   - Click **Generate** (wand icon) to create AI voice from the block text
3. The correct voice is used automatically:
   - **Narration / Quote / Thought** → uses the Narrator character's voice
   - **Dialogue / Thought** → uses the assigned character's voice
4. Generated audio uploads to Supabase Storage and appears as a mini player
5. Use the **Re-gen** button to regenerate if the result is unsatisfactory

> Generate blocks in order — chapter by chapter — for the smoothest workflow.
> You can skip audio on SFX and Pause blocks (they have no text).

---

## Step 6 — Add Scene Atmosphere

Each scene can have a background ambience layer and a music layer:

1. In the editor, click the **🎵** atmosphere button next to any scene in the left tree
2. The **Scene Atmosphere Panel** slides open on the right
3. For **Ambience** (rain, cafe, forest, etc.):
   - Click **Upload** and choose an audio file
   - Set the volume with the slider (default 40%)
4. For **Music** (background score):
   - Click **Upload** and choose an audio file
   - Set the volume with the slider (default 30%)
5. Both layers save to Supabase automatically on volume change
6. In the **Reader**, these layers fade in when the scene is entered and fade out on scene change

> Keep ambience and music subtle — 20–40% volume is usually right so they don't compete
> with the narration and dialogue audio.

---

## Step 7 — Preview in the Reader

1. In the editor header, click **Preview** (opens the reader app in a new tab)
2. The reader loads your book from Supabase
3. Test all three reading modes:
   - **Reading Mode** — manual scroll, click blocks to play audio
   - **Audiobook Mode** — auto-plays blocks in sequence with highlight
   - **Cinematic Mode** — fullscreen, one block at a time
4. Check:
   - Each block plays the correct voice
   - Scene atmosphere fades in/out on scene change
   - SFX labels appear correctly
   - Dialogue shows the right character name and color

---

## Step 8 — Publish

> **Current state:** The publish toggle writes `status = 'published'` to the database.
> Full store listing (so readers can discover the book) requires the publish pipeline (Sprint P.2+).

1. From the **Dashboard**, find your book card
2. Click the **Publish** toggle — status changes from `Draft` to `Published`
3. Share the direct reader link: `https://pagecast-nine.vercel.app/book/[book-id]`

### What "published" currently does
- Sets `status = 'published'` in Supabase
- The book is accessible via its direct URL
- The book does NOT yet appear in the public store (requires PBF packaging — Sprint P.2)

---

## Quick Reference — Common Tasks

| Task | Where |
|---|---|
| Add a character | Sidebar → Characters & Voices → Add Cast Member |
| Assign a voice to a character | Characters & Voices → click character → select voice |
| Import a .txt / .pdf story | Studio Editor → Import Text (header) |
| Assign character to a dialogue block | Editor canvas → Dialogue block → character dropdown |
| Generate AI voice for a block | Editor canvas → any block → Generate button |
| Upload recorded audio | Editor canvas → any block → Upload button |
| Add background music to a scene | Editor → scene in tree → atmosphere (🎵) button |
| Add SFX to a scene | Editor canvas → + Add Block → SFX → choose from library |
| Preview the book | Studio Editor → Preview button |
| Publish | Dashboard → book card → Publish toggle |

---

## DB Migration Required (run once in Supabase SQL Editor)

If you haven't run these yet, characters and scene atmosphere won't persist correctly:

```sql
-- Migration 004: scene atmosphere columns
alter table public.scenes
  add column if not exists ambience_url    text,
  add column if not exists music_url       text,
  add column if not exists ambience_volume real not null default 0.4,
  add column if not exists music_volume    real not null default 0.3;

-- Migration 005: character voice_id column
alter table public.characters
  add column if not exists voice_id text not null default 'ai_female_soft';
```

---

*Last updated: 2026-05-04*
