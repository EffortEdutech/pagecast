# PageCast Media Platform — Redesign Plan (v0.3, DRAFT for review)

> Status: plan only. No code, skill, schema or `.casts/` changes are made by this document.
> Date: 2026-10-12 · Owner: eff · Scope: book/cast writing pipeline, file system, character + scene consistency (MiniMax H3), clean publish package.

## 1. Why redesign

What exists today (read from the repo, 2026-10-12):

| Area | Today | Problem |
|---|---|---|
| `.casts/<slug>/` | `glitch` has `script/ images/ CHARACTER_REFS/ ambience/ sfx/ cover.jpg`; older books (`the-perfect-daughter`) are flat | No single layout; tools guess paths |
| Character | one `::CAST` line, `appearance=` one-liner | No full character record, no reference images tied to a character, no private/public split |
| Writing skills | `castlet-writer`, `storybook-writer`, `comic-castlet-writer`, `hidden-heroes-writer` | Start from a premise; no bible layer, no preflight, no continuity gate |
| Image skills | `storybook-image-prompt`, `scene-image-producer` (Pollinations), `danu-character` (one bespoke character), ComfyUI workflows | Consistency only for Danu; prompts not linked to reference images; no job record |
| Storybook folder | Blue Silence: numbered bibles 01–06 + Development Docs 1–4 + 40 chapters. After Igari: `00` index, `01–08` md set, `Gate/`, `Manuscript/` | pageCast pipeline does not consume or mirror any of this |

The storybook folder already has the mature process. The redesign makes pageCast **follow it**, rather than inventing a second one.

## 2. Principle: three layers, one direction of flow

```
SOURCE BIBLE (storybook folder, author-owned)
        │  read-only input, versioned (V1.0 …)
        ▼
CAST PACKAGE (.casts/<slug>/, pageCast-owned production state)
        │  explicit "publish" step copies only public-safe files
        ▼
PUBLISH PACKAGE (.casts/<slug>/publish/, what Studio imports and Reader serves)
```

Rules:
1. Bible → Cast is a one-way sync. The pageCast side never edits the bible.
2. Anything marked **author-secret** (e.g. Blue Silence *Character Secrets & Knowledge Matrix*, Rahim Nasir's status) never leaves the Cast layer. The publish step uses an allow-list, not a deny-list.
3. Every generated asset records the exact inputs that produced it (prompt, reference files, model, seed) so it can be regenerated or audited.

## 3. Target folder spec — `.casts/<slug>/`

```
<slug>/
  00_INDEX.md                  book manifest: slug, title, status, current phase, bible source path+version
  bible/                       synced copies of the source bible, numbered like the storybook folder
    01_foundation.md
    02_characters.md           (summary; full records live in cast/)
    03_narrative_architecture.md
    04_voice_style_rules.md
    05_world_research_ledger.md
    06_continuity_control.md
  script/                      ch01_pagecast.txt … (unchanged: Studio folder import already reads these)
  cast/                        FULL character records (private)
    cast-registry.json         one file listing every character, approved identity image + approved outfits (same idea as ai-economy-cast.json)
    <char-id>/
      character.json           id, name, role, tier, ages, voice_id, color, status
      profile.md               desire, fear, flaw, arc, speech pattern (from Character Bible)
      knowledge.md             what they know/believe/hide, by chapter  (AUTHOR-SECRET)
      appearance.lock.md       the single locked visual description (authoritative)
      refs/
        portrait.png           plain background, neutral expression  (H3 ref #1)
        fullbody.png           plain background, standing             (H3 ref #2)
        expressions.png        optional sheet                         (H3 ref #3)
      wardrobe/<outfit-id>__vN.png   approved once, reused (never regenerated per scene)
  world/                       locations as reference too (same pattern as cast/)
    <loc-id>/{location.json, look.lock.md, refs/}
  scenes/
    ch01/sc01/
      scene.json               characters present, location id, time, mood, shot, refs in order
      prompt.md                final image prompt (human-readable)
      image.jpg                accepted image
      history/                 rejected/earlier takes
  audio/{voice,ambience,sfx}/
  jobs/{queue,done,failed}/    one record per job: request + response, kept after the run (section 6)
  gates/                       preflights and end-of-part gates (After Igari model)
  publish/
    book.json                  public metadata, age rating, price, genre
    cast.public.json           PUBLIC cast only (section 4)
    cover.jpg
    manifest.json              file list + hashes of everything published
  exports/                     pdf / docx
```

Migration: a dry-run-by-default script moves existing books (`glitch` first) into this layout and prints what it would move. `script/` stays where it is, so the existing folder import (checklist T.11) keeps working.

## 4. Publish Cast vs Full Character (the split you asked for)

| | `cast/<id>/…` Full Character | `publish/cast.public.json` Publish Cast |
|---|---|---|
| Audience | author, AI tools | readers, Studio import |
| Contains | profile, secrets, knowledge by chapter, appearance lock, all refs | display name, role, colour, voice id, portrait path, one-line public blurb |
| Spoiler-safe | no | yes, by construction (allow-list) |
| Source of truth for | consistency + prompts | what Reader shows |

`cast.public.json` is **generated** from `cast/*/character.json` by the publish step. The `::CAST` block in the `*_pagecast.txt` is generated from the same source, so the two can never drift.

## 5. Writing pipeline (mapped from the storybook folder)

**Blue Silence and After Igari were written as ordinary novels, not in pageCast format.** For these two the pipeline is *convert*, not *draft*: the finished manuscript chapters (`01_The_Blue_Silence/Manuscript/*.docx`; After Igari `Manuscript/`) are converted chapter by chapter into `script/chNN_pagecast.txt` (existing `storybook-importer` skill and the Studio dialogue-extraction rules are the starting point). The bible documents are read-only references for characters, locations and image prompts: Blue Silence `01`–`06` plus *Development Documents 1–4*; After Igari `00`–`08` and `Gate/`.

Image spoiler rule: a scene image for chapter N may only show facts the reader has learned by chapter N. Each image brief is checked against the Evidence/Red-Herring Ledger and the Knowledge Reveal Ladder (e.g. nothing in an early image may imply Rahim Nasir is alive). The *Fiction Disclaimer* (`06`) is carried into `publish/book.json`.


| Stage | Source in storybook folder | pageCast step | Gate |
|---|---|---|---|
| 1 Foundation | After Igari `01`, Blue Silence `01` | `bible/01_foundation.md` | author approval |
| 2 Characters | `02` Character Bible / Emotional Architecture | `cast/<id>/profile.md` | every named character has a record |
| 3 Architecture | `03` chapter architecture, 40-chapter treatment | `bible/03…` + chapter list in `00_INDEX.md` | frozen (freeze-lock) |
| 4 Voice rules | `04` Voice, Style & Manuscript Rules | `bible/04…` | — |
| 5 Research | `05` World/Historical Ledger | `bible/05…` | fact labels (H1/H2/F1/D1/O1) where real events appear |
| 6 Control | `06` Continuity & Production Control; Dev Docs 1–4 | `bible/06…`, `gates/` | — |
| 7 Chapter preflight | After Igari chapter preflight | `gates/chNN_preflight.md` | must pass before drafting |
| 8 Draft **or convert** + continuity check | Required Prompt System; for the two novels, the finished manuscript | `script/chNN_pagecast.txt` + short check | per chapter |
| 9 Part gate | Part I/II/III Continuity Gates | `gates/partN_gate.md` | PASS / PASS WITH CORRECTIONS / HOLD |
| 10 Cast lock | new | `appearance.lock.md` + refs approved | before any scene image |
| 11 Scene prompts + jobs | new | `scenes/…`, `jobs/queue/` | per scene |
| 12 Audio | existing generators | `audio/…` | Studio QA gate (4.18) |
| 13 Publish | new | `publish/…` | author approval, never automatic |

### Skill changes (proposed, small)

- **Keep** `castlet-writer`, `comic-castlet-writer`, `hidden-heroes-writer`, `storybook-writer` as drafters, but add one first step: *read `bible/` and `cast/` if present; otherwise run Stage 1–2 intake.* Their `::CAST` output is generated from `cast/`, not invented per chapter.
- **New `pagecast-bible-builder`**: builds Stages 1–6 from a premise or imports an existing storybook folder set (Blue Silence / After Igari are the two test cases).
- **New `pagecast-chapter-gate`**: Stage 7 preflight and Stage 9 part gate, using the After Igari prompts as the template.
- **Generalise `danu-character`** into **`pagecast-character-lock`**: Stage 10 for any character, producing `appearance.lock.md` and the ref-image brief.
- **Merge** `storybook-image-prompt` + `scene-image-producer` into **`pagecast-scene-jobs`**: writes `scene.json`, `prompt.md` and a job manifest instead of calling Pollinations directly.
- **New `pagecast-publish-packager`**: Stage 13, allow-list export.

## 6. Image consistency on Maestro (modelled on the AI Economy book)

### 6.1 What the AI Economy video pipeline does (read from `00 Remotion`)
- A **cast registry** (`ai-economy-cast.json`) lists each presenter with an approved identity image and approved wardrobe variants; they are generated once, approved, then reused. Scene presets (Lab, HomeOffice, Workstation, 90seconds101 backdrop) change only the setting, never identity.
- **Seven numbered gates** with explicit states (`PENDING / RUNNING / READY FOR APPROVAL / APPROVED / PASS / FAIL`); approvals survive reboots; a submission is not a gate pass.
- Every Maestro submission is saved as a **record containing the request and the response** (`…__minimax_h3_submission__v1.json`); the submit script **refuses to run again if the record exists**; a slow job is never resubmitted.
- **Additive naming** (`<campaign>__v003__<what>__v1.ext`); good assets are never overwritten.
- **Resume before creating:** look for the plan, submission record, media and active monitor first.
- **Quiet monitoring:** one 30-minute heartbeat per active generation; silent unless something changed.
- Maestro runs at `http://127.0.0.1:42003/api/v1/generate`. The real H3 request body used today (video) has: `generation_mode`, `model_type: minimax_h3_ref2va`, `prompt`, `resolution`, `video_length`, `sliding_window_size`, `sliding_window_overlap`, `num_inference_steps` (8 diagnostic, 20 production), `seed`, `negative_prompt`, `minimax_h3_text_encoder: int8`, `minimax_h3_reference_detail: match`, `minimax_h3_references[]` (each with `id`, `type`, `path`, `filename`, `role`, `image_intent: identity`), `minimax_h3_runtime_references[]`, `save_path`.

### 6.2 Mapping to PageCast

| AI Economy | PageCast |
|---|---|
| `ai-economy-cast.json` | `cast/cast-registry.json` |
| wardrobe variants `wardrobe/<preset>__vN.png` | `cast/<id>/wardrobe/<outfit>__vN.png` |
| scene presets | `world/<location>/` (approved location reference, one per place in the book) |
| combined presenter + scene still | `scenes/chNN/scNN/` additive takes, approved one marked in `scene.json` |
| submission record | `jobs/…` record (request + response), same refuse-to-resubmit rule |
| gates 1–7 | image gates below |
| 30-minute monitor | same, per active job |

### 6.3 Image gates (per book)
1. **Brief:** scene brief from the chapter and bible (who is present, where, when, mood), spoiler-checked.
2. **Character lock:** identity image and outfits for every character in the scene approved (`appearance.lock.md` + `cast-registry.json`).
3. **Location lock:** reference for the location approved.
4. **Diagnostic:** one low-cost take; identity, outfit, location checked.
5. **Production take:** generated, checked for identity drift, text artifacts, safe crop for Reader; approval recorded.
6. **Chapter sweep:** all scene images of a chapter checked together for continuity (same outfit, same time of day).
7. **Licence and publish gate:** the model used must be marked cleared (6.5) before the image can enter `publish/`.

### 6.4 Image only, voices separate (decided by eff)
Maestro is used for **images only**. PageCast's existing text-to-speech voices stay the only voices. Maestro characters are created **without** a voice recording, image jobs carry no audio references, and `voice_id` is never written into Maestro. The two systems share nothing except the character's face.

### 6.5 Can H3 make the images, and does it need a licence?
- **How:** in the AI Economy pipeline H3 only runs as video (`generation_mode: video`, `minimax_h3_ref2va`). A still would be a frame taken from a short H3 clip made from the character's identity image. That keeps H3's identity locking, but it is slow: your own notes record roughly 20+ minutes for a 5-second diagnostic and 1.5–2.5 hours for a 10-second production hook on the RTX 3080 laptop. A book with many scenes would need H3 for key art and anchor frames only, with an image model for bulk. I have not seen an image-mode Maestro payload, so I won't guess its fields (6.6).
- **Licence (read from secondary summaries only; I could not open the official licence text):**

| Model | What I found | Status for published art |
|---|---|---|
| MiniMax H3 | Community licence. Rights granted only in an "Applicable Territory" = worldwide **except the EU, UK, South Korea and the US**; one summary says running the weights or using outputs in those regions is not authorised. Free commercial use under US$20M yearly revenue, above that written authorisation; commercial products must show "MiniMax H3" in the UI (Section IV.2); MiniMax claims no rights in outputs, but an Acceptable Use Policy applies; outputs may not be used to train other models. | **BLOCKED until the official text is read.** PageCast sells globally, so readers in the US, EU and UK would receive H3-made art. |
| Qwen Image 2.1 | Maestro's own notes: research/evaluation licence, commercial use needs a separate Qwen licence. | **BLOCKED** |
| Flux 2 Klein (4B / 9B) | Not checked. My recollection, unverified: 4B is Apache-2.0 and 9B is non-commercial. | **UNCHECKED** |

Design rule: every model entry carries `licence_status` (`blocked | unchecked | cleared_global`). Local drafts and previews are allowed with any model. The publish packager refuses any image whose job used a model that is not `cleared_global`. I am not a lawyer; this table is a checklist of things to verify, not advice.

### 6.6 Job record (fields taken from your real H3 submissions; image-mode fields to be captured)

```json
{
  "job_id": "bluesilence_ch04_sc02__v003",
  "type": "scene_still",
  "gate": "5-production-take",
  "runner": {"name": "maestro", "url": "http://127.0.0.1:42003/api/v1/generate"},
  "model": {"model_type": "<fill from a real Studio image job>", "licence_status": "unchecked"},
  "request": {
    "generation_mode": "image",
    "prompt": "<from scenes/ch04/sc02/prompt.md>",
    "negative_prompt": "",
    "seed": 24042003,
    "references": [
      {"id": "rahman_identity_v1", "type": "image", "path": "cast/rahman/refs/portrait.png", "role": "Rahman identity, grey temples, navy uniform", "image_intent": "identity"},
      {"id": "room17_v1", "type": "image", "path": "world/room17/refs/main.png", "role": "location: keep layout and lighting"}
    ]
  },
  "response": null,
  "outputs": {"approved": null, "takes": []},
  "state": "PENDING"
}
```

The script that submits it refuses to run if `response` is already filled, copying the AI Economy rule.

## 7. Phased delivery (each phase small, reviewable, separately approved)

| Phase | Deliverable | Verification |
|---|---|---|
| 0 | This plan + checklist section | review by eff |
| 1 | Folder spec finalised; migration script **dry-run only** on `glitch` | dry-run report, no files moved |
| 2 | Character record schema + `appearance.lock.md` template; build records for Blue Silence principals as pilot | schema validates; records match Character Bible |
| 3 | `pagecast-bible-builder` + `pagecast-chapter-gate` skills; import After Igari set | After Igari `bible/` + `gates/` populated, no content edited |
| 4 | `pagecast-character-lock` + ref-image generation via H3 | refs reviewed by eff before any scene use |
| 5 | `pagecast-scene-jobs` + Maestro adapter (local only, starts by capturing a real Studio payload) | one scene end-to-end, regenerated reproducibly from manifest |
| 6 | `pagecast-publish-packager` + Studio import of `cast.public.json` (the only code change in Studio) | spoiler-leak test: no author-secret string appears in `publish/` |

## 8. Decisions

**Resolved by eff (2026-10-12):** Maestro = local Pinokio app. Voices = existing PageCast TTS only; Maestro is for images only. Blue Silence and After Igari are ordinary novels converted into pageCast format, with the bible documents as references for characters and scenes. Job fields = copy the AI Economy submission pattern.

**Still open:**
1. **Licence for published art** (section 6.5). Until someone reads the official MiniMax H3 text (and the Klein and Qwen terms), proposal: build and review everything locally with any model, but treat all images as drafts; nothing enters `publish/`. Decide who verifies: you, MiniMax (they offer separate authorisation), or counsel.
2. **Image-mode payload.** Save one image-mode job from Maestro Studio (the model you want for bulk art) so the adapter copies real field names.
3. **Database.** Whether `cast.public.json` needs a Supabase column or storage path (Phase 6 only).

Defaults I will use unless you object: each novel chapter becomes one pageCast chapter; adult age classification; the Fiction Disclaimer goes into `publish/book.json`; `knowledge.md` stays author-only.

## 9. Not in scope here

No change to Studio/Reader code, Supabase schema, TTS engines, existing `.casts/` books, or production. No dependency added.
