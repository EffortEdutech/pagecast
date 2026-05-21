# scene-prompt-writer

Generates a `<Book>_image_prompts.txt` file — one precise visual image prompt per scene — from a pageCast cast folder.

This is **Step 1** of the image generation workflow:

```
pageCast .txt files
       ↓
  scene-prompt-writer          ← this skill
       ↓
  <Book>_image_prompts.txt     ← human-reviewable, editable
       ↓
  generate_images.py           ← reads prompts, downloads images
```

## When to invoke

Use this skill whenever the user says:
- "write image prompts for the cast"
- "generate scene prompts for [book]"
- "prepare prompts before image generation"
- "make the image prompts file"
- Or any request to start the image generation workflow from scratch

## How to run

```powershell
# Template mode (fast, offline, no API needed)
python skills/scene-prompt-writer/scene_prompt_writer.py --folder ".casts\<book>\"

# AI mode (Pollinations text API, free, ~30s for 40 scenes)
python skills/scene-prompt-writer/scene_prompt_writer.py --folder ".casts\<book>\" --ai

# AI mode with priority key
python skills/scene-prompt-writer/scene_prompt_writer.py --folder ".casts\<book>\" --ai --key pk_YOUR_KEY

# Regenerate (overwrite existing prompts file)
python skills/scene-prompt-writer/scene_prompt_writer.py --folder ".casts\<book>\" --overwrite
```

## Output format

The prompts file is a plain `.txt` — easy to read and edit:

```
# GLITCH — Image Generation Prompts
# Total scenes: 39

[Ch1Sc1]
slug=the_van
prompt=Teen boy frozen mid-stride at a chaotic Velmoor city intersection, a delivery van skidding through a red light, early morning rush hour

[Ch1Sc2]
slug=the_alley_test
prompt=Teen boy alone in a narrow brick alley testing a freeze ability, repeatedly stopping mid-motion, early morning quiet
```

## Workflow guidance (as Claude in Cowork)

When the user asks to generate images for a pageCast story:

1. **Check if a prompts file already exists** in the cast folder (`<Book>_image_prompts.txt`).
   - If it exists → present it to the user, ask if they want to use it or regenerate
   - If not → run scene-prompt-writer (prefer `--ai` mode for best quality)

2. **Run the script** and present the output file to the user.

3. **Ask the user to review** the prompts. Tell them:
   - Open the `.txt` file
   - Edit any prompt that doesn't match the visual scene they want
   - Keep prompts under 30 words
   - No dialogue, speech acts, or inner-thought references

4. **Once confirmed**, run generate_images.py:
   ```powershell
   python skills/generate_images.py --folder ".casts\<book>\" --style-pick 2
   ```

## AI prompt writing guidelines

When Claude writes prompts (either by running this script in AI mode, or manually):

**Good prompts:**
- "Two teen boys crouching beside a drain grating on a quiet back lane, late afternoon shadows"
- "Dog trotting purposefully through quiet residential streets, three teens following, Sunday morning"
- "Heavy lorry frozen mid-turn onto a market street, teen boy sprinting through the stillness"

**Bad prompts (avoid):**
- ❌ "Marcus said to Dex that the coin was important" — dialogue
- ❌ "She thought about what Dot had told her" — inner thought
- ❌ "A young adult novel scene" — too vague
- ❌ "Panel 1: character speaks to character" — comic panel language
- ❌ Prompts over 30 words — bloats the image model context

**Structure**: [characters + action] + [setting] + [time/mood]
