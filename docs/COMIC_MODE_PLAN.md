# PageCast Comic Cast — A New Writing Style + Image Skill Plan

**Status:** plan only, no code/reader/studio changes involved
**Scope:** Comic Cast is a **new way of writing** a Castlet from scratch — not a style check or retrofit applied to existing stories. It still saves as the same `::PAGECAST_BOOK` format, same `::CAST` block, same `## Adegan` scenes, same `[NARRATION]`/`[DIALOGUE]`/`[THOUGHT]`/`[SFX]`/`[PAUSE]`/`[TRANSITION]` tags every other Castlet uses — but the *story itself* has to be conceived visually, panel by panel, from the first draft. Existing Castlets were written for the ear (audio-first prose); Comic Cast is written for the eye.

---

## 1. What makes this a genuinely different writing style

An audio-first Castlet is written as prose that happens to get illustrated later — long narration paragraphs, scenes that wander through several beats, description aimed at what a listener hears and feels over time.

Comic Cast reverses that: the writer thinks in panels first. Before writing a word of narration, the question for every scene is *"what is the one image here?"* — then the narration, dialogue, and thought lines are written to serve that image, not the other way around. That's the actual shift, not just shorter sentences.

## 2. Writing style rules (for new stories, written this way from the start)

1. **Plan scene-by-scene as panels, before drafting prose.** Sketch each Adegan as a single visual moment first — a specific action, expression, or composition — the way a comic artist thumbnails a page before anyone writes dialogue. The scene only gets written once its one image is clear.
2. **One dominant visual per scene, always.** If a moment needs two distinct images to land, it's two scenes, not one. Comic Cast scenes should read as naturally short — err toward more, tighter scenes over fewer long ones.
3. **Narration is caption-length by design, not by editing.** Write `[NARRATION]` as 1-2 sentence captions from the first draft — concrete, sensory, visually specific ("smoke rising thin and grey from the last chimney in the village," not "something felt different that morning"). This isn't compression of longer prose; it's the native unit of Comic Cast narration.
4. **Dialogue is written bubble-length.** Short, punchy exchanges from the start — write for what fits in a speech bubble, not for what sounds natural read aloud over time.
5. **Every character gets a locked physical description at their first panel.** The moment a character is introduced, give them a specific, reusable physical description in the narration. This is written in deliberately so the image skill (below) always has something concrete to draw and keep consistent — not something to add later.
6. **The scene header is the camera direction.** `Location` / `Time` / `Ambience` / `Music` should be written like a director's shot description — specific enough that a scene's setting is unambiguous from the header alone, since that's the first thing the image prompt reads.
7. **`[SFX]` tags double as panel cues.** Placing an SFX tag is also a way of marking "this is the beat worth drawing" — use it deliberately as a visual anchor, not just a sound layer.

## 3. A new skill to write in this style

Because this is a genuinely different writing mode rather than a style tweak, it's worth its own dedicated writing skill — parallel to how `castlet-writer` and `hidden-heroes-writer` already exist for their own formulas, and `storybook-writer` handles "write in the style of [master]."

**Proposed: `comic-castlet-writer`** — a new skill whose job is to draft brand-new Castlets directly in Comic Cast style, applying the rules in §2 from the first line rather than writing prose and hoping it illustrates well. It would take a story idea/premise as input (the same way `castlet-writer` takes a Collection to write into) and output a `*_pagecast.txt` file that's Comic Cast from conception — same file format, distinctly different prose.

## 4. Image generation skill plan

Still the right target skill, unchanged from before:

- **`scene-image-producer`** already reads a pagecast `.txt`, builds one prompt per scene, has a `--style comic` flag, and saves one image per scene to `/images/`.
- **`danu-character`** already proves out locking one character's visual description across prompts.

What it needs, built specifically to pair with `comic-castlet-writer` output rather than legacy material:

1. **Read the whole scene when building the prompt** — every new Comic Cast scene is written as one deliberate visual moment (per §2), so the prompt builder should pull that moment directly rather than defaulting to just the opening lines.
2. **Generalize character-locking to every named character**, using the locked descriptions Comic Cast writing now bakes in at first appearance (§2 rule 5) — the same mechanism `danu-character` proves for Danu, now fed by the writing style itself instead of a bespoke per-character skill.
3. **Comic-specific prompt scaffolding** — panel composition, inked linework, comic-style lighting as the default register for anything written in Comic Cast style.
4. **Same output contract** — one image per scene, same naming, same `/images/` folder.

## 5. What this deliberately does not include

- No new file format or script syntax
- No reader app or Studio changes
- No retrofitting, style-checking, or reference to existing Castlets — this is new material, written new
- No multi-panel-per-page layout — one scene stays one image

## 6. Next step

Pick a brand-new story premise (not an existing Collection/Castlet) to pilot Comic Cast on: draft it fresh using the §2 rules — ideally through the proposed `comic-castlet-writer` skill once built — then generate its images with the upgraded prompt logic from §4 and review whether the results land before rolling this out further.
