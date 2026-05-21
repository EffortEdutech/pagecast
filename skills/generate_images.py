#!/usr/bin/env python3
"""
pageCast Scene Image Producer
Generates scene illustrations using Pollinations.ai.

Usage:
  python skills/generate_images.py --folder ".casts/bookname/" --key pk_YOUR_KEY
  python skills/generate_images.py --folder ".casts/bookname/" --key pk_YOUR_KEY --style-pick 2
"""

import argparse
import os
import re
import sys
import time
import urllib.request
import urllib.parse
import urllib.error
from pathlib import Path

RATE_LIMIT_DELAY = 2.0

# flux = free default model on image.pollinations.ai (turbo requires payment)
DEFAULT_MODEL = "flux"

NEGATIVE_PROMPT = (
    "speech bubble, dialogue balloon, word balloon, text overlay, caption, label, "
    "watermark, comic panel, panel border, thought bubble, onomatopoeia, "
    "subtitle, letter, word, writing, typography, manga, anime panel, comic strip"
)

# All presets use photography/painting framing — avoids comic panel associations
STYLE_PRESETS = [
    (1, "Cinematic Photo",        "cinematic photography, DSLR photo, dramatic lighting, shallow depth of field"),
    (2, "Concept Art",            "ArtStation concept art, digital illustration, cinematic, detailed"),
    (3, "Movie Poster",           "movie poster art, dramatic composition, vibrant colours, detailed"),
    (4, "Oil Painting",           "oil painting, dramatic lighting, rich colours, detailed brushwork"),
    (5, "Watercolour",            "watercolour illustration, soft light, detailed, painterly"),
    (6, "3D Render",              "3D render, octane render, cinematic lighting, photorealistic"),
]

GENRE_STYLES = {
    "young adult adventure comedy": "cinematic photography, DSLR photo, vibrant colours, dramatic lighting",
    "young adult adventure":        "cinematic photography, DSLR photo, dramatic lighting",
    "young adult romance":          "watercolour illustration, soft warm tones, painterly, detailed",
    "young adult":                  "ArtStation concept art, digital illustration, cinematic",
    "children's fantasy":           "watercolour children's book illustration, soft light, magical",
    "children's islamic":           "warm watercolour illustration, soft colours, detailed",
    "children's":                   "watercolour illustration, colourful, soft light, detailed",
    "adult literary":               "oil painting, moody dramatic lighting, atmospheric, detailed",
    "adult islamic":                "warm oil painting, serene, detailed, soft light",
    "malay":                        "batik-inspired digital illustration, tropical colours, detailed",
    "nusantara":                    "batik-inspired digital illustration, tropical colours, detailed",
}

MUSIC_MOODS = {
    "quirky_upbeat":   "light-hearted energetic atmosphere",
    "upbeat_comedy":   "comedic cheerful atmosphere",
    "quiet_mystery":   "mysterious quiet atmosphere",
    "quirky_mystery":  "curious mysterious atmosphere",
    "upbeat_tension":  "tense energetic atmosphere",
    "quiet_tension":   "tense suspenseful atmosphere",
    "quiet_warmth":    "warm intimate atmosphere",
    "freeze_tension":  "frozen tense suspended moment",
}

# Dialogue/thought verbs that signal "comic panel" to the model — strip from narration
DIALOGUE_VERBS = re.compile(
    r'\b(said|asked|shouted|whispered|replied|answered|exclaimed|muttered|gasped|'
    r'laughed|smiled|frowned|thought|felt|wondered|realized|noticed|heard|'
    r'knew|believed|hoped|feared|remembered|forgot|decided|wanted|needed)\b',
    re.IGNORECASE
)

# Filler words that add no visual value
FILLER_WORDS = re.compile(
    r'\b(suddenly|immediately|quickly|slowly|carefully|finally|actually|really|'
    r'just|already|still|even|also|very|quite|rather|almost|nearly|perhaps|'
    r'maybe|somehow|anyway|however|therefore|although|because|since|'
    r'while|when|if|that|which|who|whom|whose|what|about|know|'
    r'I|me|my|we|our|us|she|he|they|it|her|his|their|its|'
    r'was|were|had|have|has|did|does|do|could|would|should|might|must|shall|will|'
    r'can|may|be|been|being|and|but|or|so|yet|for|nor|a|an|the)\b',
    re.IGNORECASE
)


def narration_to_visual(text):
    """
    Find the most visually rich sentence in narration text.
    Scores all sentences by surviving word count after filler/dialogue-verb removal.
    Abstract first-person thought-sentences are penalised but not excluded entirely.
    """
    if not text:
        return ""

    sentences = re.split(r'(?<=[.!?])\s+', text.strip())

    def filter_sentence(s):
        # Collapse contractions before stripping punctuation (I'd→Id, won't→wont)
        f = re.sub(r"'s|'t|'d|'re|'ve|'ll|'m", '', s)
        f = DIALOGUE_VERBS.sub('', f)
        f = FILLER_WORDS.sub('', f)
        f = re.sub(r'[^\w\s]', '', f)
        # Remove lone single-letter tokens left by contraction collapse
        f = re.sub(r'\b[a-zA-Z]\b', '', f)
        f = re.sub(r'\s+', ' ', f).strip()
        return f

    best_filtered = ""
    best_score = 0

    for s in sentences[:12]:
        s = s.strip()
        if not s or len(s) < 12:
            continue
        filtered = filter_sentence(s)
        score = len(filtered.split())
        # Abstract first-person thought sentences (starts with I/My/Here + has thought verb)
        # get a heavy score penalty so a concrete visual sentence beats them
        if re.match(r'^(I |My |Here)', s) and DIALOGUE_VERBS.search(s):
            score = score // 3
        if score > best_score and len(filtered) > 8:
            best_filtered = filtered
            best_score = score

    return best_filtered if len(best_filtered) > 8 else ""


def title_to_visual(scene_title):
    """Convert a scene title like 'The Alley Test' into visual scene keywords."""
    # Remove common scene-title words that don't add visual value
    clean = re.sub(r'\b(the|a|an|of|in|at|on|to|into|from|scene)\b', '', scene_title, flags=re.IGNORECASE)
    clean = re.sub(r'\s+', ' ', clean).strip()
    return clean


def pick_style_interactive():
    print()
    print("  +------------------------------------------------------------------+")
    print("  |  Choose visual style  (all are speech-bubble-free)              |")
    print("  +------------------------------------------------------------------+")
    for num, name, style in STYLE_PRESETS:
        print("  |  {}  {:<22}  {:<35}|".format(num, name, style[:35]))
    print("  +------------------------------------------------------------------+")
    while True:
        try:
            choice = input("  Enter number (1-6) or press Enter for genre default: ").strip()
            if choice == "":
                return ""
            n = int(choice)
            if 1 <= n <= len(STYLE_PRESETS):
                _, name, style = STYLE_PRESETS[n - 1]
                print("  Using: " + name)
                return style
        except EOFError:
            return ""
        except ValueError:
            pass
        print("  Please enter 1-{}.".format(len(STYLE_PRESETS)))


def slugify(text):
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9\s-]", "", text)
    text = re.sub(r"[\s-]+", "_", text)
    return text[:50]


def detect_style(genre):
    genre_lower = genre.lower()
    for key, style in GENRE_STYLES.items():
        if key in genre_lower:
            return style
    return "ArtStation concept art, digital illustration, cinematic"


def build_image_prompt(scene_data, style):
    """
    Builds a visual prompt from scene metadata.
    - Scene title + filtered narration → characters + action (what people are doing)
    - Location + time + ambience → environment and mood
    - Narration is filtered to strip dialogue verbs that trigger speech bubbles,
      keeping only action verbs, nouns, and visual adjectives.
    """
    parts = [style]

    # Scene title → visual context (e.g. "The Van" → "Van")
    visual_title = title_to_visual(scene_data.get("scene_title", ""))
    if visual_title:
        parts.append(visual_title)

    # Filtered narration → characters + action without bubble-triggering prose
    narration = scene_data.get("narration", "")
    visual_action = narration_to_visual(narration)
    if visual_action:
        parts.append(visual_action)

    # Location
    location = re.sub(r"^Location:\s*", "", scene_data.get("location", ""), flags=re.IGNORECASE).strip()
    if location:
        parts.append(location)

    # Time of day
    time_val = re.sub(r"^Time:\s*", "", scene_data.get("time", ""), flags=re.IGNORECASE).strip()
    if time_val:
        parts.append(re.split(r"[,—]", time_val)[0].strip())

    # Ambience
    ambience = re.sub(r"^Ambience:\s*", "", scene_data.get("ambience", ""), flags=re.IGNORECASE).strip()
    if ambience:
        parts.append(ambience)

    # Mood from music tag
    music = scene_data.get("music", "").lower().replace(" ", "_")
    mood = MUSIC_MOODS.get(music)
    if mood:
        parts.append(mood)

    # Characters — listed as visual subjects, not narrative agents
    chars = scene_data.get("characters", [])
    if chars:
        parts.append("featuring " + ", ".join(chars[:2]))

    # Quality + no text (do NOT use "wide angle" / "establishing shot" — makes people tiny)
    parts.append("dynamic composition, detailed, cinematic lighting, high quality, no text, no speech bubbles")

    return ", ".join(p for p in parts if p)


def download_image(prompt, dest_path, width, height, api_key="", model=DEFAULT_MODEL):
    encoded   = urllib.parse.quote(prompt)
    neg_enc   = urllib.parse.quote(NEGATIVE_PROMPT)
    key_param = "&key=" + api_key if api_key else ""
    # Use image.pollinations.ai (stable endpoint); flux model is free, turbo requires payment
    url = (
        "https://image.pollinations.ai/prompt/" + encoded
        + "?model={}&width={}&height={}&nologo=true&negative_prompt={}{}".format(
            model, width, height, neg_enc, key_param)
    )
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "pageCast-image-producer/1.0"})
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = resp.read()
            if len(data) < 5000:
                print("    Warning: response too small ({} bytes)".format(len(data)))
                return False
            dest_path.write_bytes(data)
            return True
    except urllib.error.HTTPError as e:
        if e.code == 401:
            print("    Error: 401 — add --key pk_YOUR_KEY (free at enter.pollinations.ai)")
        else:
            print("    Error: HTTP {}".format(e.code))
        return False
    except Exception as e:
        print("    Error: {}".format(e))
        return False


def parse_pagecast(pagecast_path):
    text = pagecast_path.read_text(encoding="utf-8")

    genre_match = re.search(r'^Genre:\s*(.+)$', text, re.MULTILINE | re.IGNORECASE)
    genre = genre_match.group(1).strip() if genre_match else ""

    chapter_pattern = re.compile(r'^#\s+(?:Chapter|Bab|CHAPTER|BAB)\s+(\d+):\s*(.+)$', re.MULTILINE | re.IGNORECASE)
    scene_pattern   = re.compile(r'^##\s+(?:Scene|SCENE)\s+(\d+):\s*(.+)$', re.MULTILINE | re.IGNORECASE)

    chapter_matches = list(chapter_pattern.finditer(text))
    scene_matches   = list(scene_pattern.finditer(text))

    scenes = []
    current_chapter = 0
    current_chapter_title = ""

    for i, sm in enumerate(scene_matches):
        scene_num   = int(sm.group(1))
        scene_title = sm.group(2).strip()
        scene_start = sm.start()

        for cm in reversed(chapter_matches):
            if cm.start() < scene_start:
                current_chapter       = int(cm.group(1))
                current_chapter_title = cm.group(2).strip()
                break

        scene_end = scene_matches[i + 1].start() if i + 1 < len(scene_matches) else len(text)
        block = text[scene_start:scene_end]

        def get_meta(key, b=block):
            m = re.search(r'^' + key + r':\s*(.+)$', b, re.MULTILINE | re.IGNORECASE)
            return m.group(1).strip() if m else ""

        char_names = [m.group(1).strip()
                      for m in re.finditer(r'\[DIALOGUE:\s*([^|]+)', block, re.IGNORECASE)]

        # Extract up to 5 narration lines — more lines = more candidate sentences
        narration_matches = re.findall(r'\[NARRATION\][ \t]*\r?\n(.*?)(?=\[|\Z)', block, re.DOTALL)
        narration_lines = []
        for match in narration_matches:
            line = match.strip().split('\n')[0].strip()
            if line and len(line) > 10:
                narration_lines.append(line)
            if len(narration_lines) >= 5:
                break
        raw_narr = ' '.join(narration_lines)[:600]
        # If truncated mid-word (no sentence-ending punctuation at the cut), trim the last word
        if raw_narr and raw_narr[-1] not in '.!?':
            raw_narr = re.sub(r'\s*\S+$', '', raw_narr).rstrip()
        narration = raw_narr

        scenes.append({
            "chapter_num":   current_chapter,
            "chapter_title": current_chapter_title,
            "scene_num":     scene_num,
            "scene_title":   scene_title,
            "location":      get_meta("Location"),
            "time":          get_meta("Time"),
            "ambience":      get_meta("Ambience"),
            "music":         get_meta("Music"),
            "narration":     narration,
            "characters":    list(dict.fromkeys(char_names))[:2],
            "slug":          slugify(scene_title),
        })

    return genre, scenes


def read_prompts_file(path):
    """
    Parse a <Book>_image_prompts.txt file produced by scene-prompt-writer.
    Returns dict { "Ch1Sc1": {"slug": ..., "prompt": ...}, "cover": {"prompt": ...}, ... }
    Also parses the [cover] block for book cover generation.
    """
    text = path.read_text(encoding="utf-8")
    result = {}
    cur_key = None
    cur = {}
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            if cur_key and cur:
                result[cur_key] = cur
                cur_key, cur = None, {}
            continue
        # Scene blocks: [Ch1Sc1]
        m = re.match(r'^\[Ch(\d+)Sc(\d+)\]$', line)
        if m:
            if cur_key and cur:
                result[cur_key] = cur
            cur_key = "Ch{}Sc{}".format(m.group(1), m.group(2))
            cur = {}
            continue
        # Cover block: [cover]
        if line.lower() == '[cover]':
            if cur_key and cur:
                result[cur_key] = cur
            cur_key = 'cover'
            cur = {}
            continue
        if '=' in line and cur_key is not None:
            k, _, v = line.partition('=')
            cur[k.strip()] = v.strip()
    if cur_key and cur:
        result[cur_key] = cur
    return result


def main():
    parser = argparse.ArgumentParser(description="pageCast Scene Image Producer")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--pagecast", help="Path to a pageCast .txt file")
    group.add_argument("--folder",   help="Path to a .casts/<book>/ folder")
    parser.add_argument("--style",      help="Visual style override (free text)")
    parser.add_argument("--style-pick", type=int, metavar="1-6",
                        help="Pick preset by number (skips interactive menu)")
    parser.add_argument("--model",      default=DEFAULT_MODEL,
                        help="Pollinations model (default: flux-realism)")
    parser.add_argument("--width",      type=int, default=1024)
    parser.add_argument("--height",     type=int, default=576)
    parser.add_argument("--key",        default="", metavar="pk_...")
    parser.add_argument("--images-dir", help="Output folder (default: <folder>/images/)")
    parser.add_argument("--overwrite",  action="store_true",
                        help="Regenerate images that already exist")
    parser.add_argument("--prompts",    metavar="FILE",
                        help="Path to <Book>_image_prompts.txt (auto-detected if omitted)")
    args = parser.parse_args()

    if not args.key:
        args.key = os.environ.get("POLLINATIONS_KEY", "")
    if not args.key:
        print("Warning: no API key. Get one free at https://enter.pollinations.ai")
        print("Then run with: --key pk_YOUR_KEY")
        print()

    # Resolve style: --style > --style-pick N > interactive menu > genre default
    forced_style = ""
    if args.style:
        forced_style = args.style
    elif args.style_pick:
        n = args.style_pick
        if 1 <= n <= len(STYLE_PRESETS):
            _, name, forced_style = STYLE_PRESETS[n - 1]
            print("Style: {}".format(name))
        else:
            print("Warning: --style-pick must be 1-{}".format(len(STYLE_PRESETS)))
    elif sys.stdin.isatty():
        forced_style = pick_style_interactive()

    if args.pagecast:
        pagecast_files = [Path(args.pagecast)]
        base_dir = Path(args.pagecast).parent
    else:
        base_dir = Path(args.folder)
        pagecast_files = sorted(base_dir.glob("*_pagecast.txt"))
        if not pagecast_files:
            print("Error: no *_pagecast.txt files found in " + str(base_dir))
            sys.exit(1)

    images_dir = Path(args.images_dir) if args.images_dir else base_dir / "images"
    images_dir.mkdir(parents=True, exist_ok=True)

    print()
    print("pageCast Scene Image Producer")
    print("Model : {}  |  Size: {}x{}".format(args.model, args.width, args.height))
    print("Output: " + str(images_dir))
    print()

    total = generated = skipped = failed = 0

    # Auto-detect prompts file if not specified
    prompts_file = None
    if args.prompts:
        prompts_file = Path(args.prompts)
    else:
        # Look for <Book>_image_prompts.txt in the base folder
        candidates = list(base_dir.glob("*_image_prompts.txt"))
        if candidates:
            prompts_file = candidates[0]

    prompts_db = {}
    if prompts_file and prompts_file.exists():
        prompts_db = read_prompts_file(prompts_file)
        print("Prompts: " + prompts_file.name + " ({} entries)".format(len(prompts_db)))
    elif prompts_file:
        print("Warning: prompts file not found: " + str(prompts_file))
    else:
        print("Prompts: auto-generated from narration (run scene-prompt-writer for better results)")
    print()

    for pf in pagecast_files:
        print("File: " + pf.name)
        genre, scenes = parse_pagecast(pf)

        if not scenes:
            print("  No scenes found.")
            continue

        style = forced_style or detect_style(genre)
        print("  Genre : " + (genre or "unknown"))
        print("  Style : " + style)
        print("  Scenes: " + str(len(scenes)))
        print()

        for scene in scenes:
            ch    = scene["chapter_num"]
            sc    = scene["scene_num"]
            fname = "Ch{}_Sc{}_{}.jpg".format(ch, sc, scene["slug"])
            dest  = images_dir / fname
            total += 1

            if dest.exists() and not args.overwrite:
                print("  [skip] " + fname)
                skipped += 1
                continue

            # Use AI-written prompt from prompts file if available, else auto-build
            key = "Ch{}Sc{}".format(ch, sc)
            if key in prompts_db:
                prompt = style + ", " + prompts_db[key].get("prompt", "")
                # Override slug-based filename if prompts file has a slug
                ps = prompts_db[key].get("slug", "")
                if ps:
                    fname = "Ch{}_Sc{}_{}.jpg".format(ch, sc, ps)
                    dest  = images_dir / fname
            else:
                prompt = build_image_prompt(scene, style)
            print("  Ch{} Sc{}: {}".format(ch, sc, scene["scene_title"]))
            print("    > " + prompt[:100] + ("..." if len(prompt) > 100 else ""))

            time.sleep(RATE_LIMIT_DELAY)
            ok = download_image(prompt, dest, args.width, args.height, args.key, args.model)


            if ok:
                kb = round(dest.stat().st_size / 1024)
                print("    Saved {} ({}KB)".format(fname, kb))
                generated += 1
            else:
                print("    Failed -- re-run to retry")
                failed += 1

    # ── Book cover (portrait 768×1024) ─────────────────────────────────────────
    cover_result = ""
    if 'cover' in prompts_db:
        cover_prompt_text = prompts_db['cover'].get('prompt', '').strip()
        if cover_prompt_text:
            cover_dest = base_dir / "cover.jpg"
            if cover_dest.exists() and not args.overwrite:
                print("  [skip] cover.jpg (already exists — use --overwrite to regenerate)")
                cover_result = "skipped"
            else:
                print("Book Cover (portrait 768×1024):")
                # Cover always uses concept art style for a polished book-cover look
                cover_style = "professional book cover art, portrait orientation, digital illustration, cinematic composition, detailed"
                full_cover_prompt = cover_style + ", " + cover_prompt_text
                print("  > " + full_cover_prompt[:110] + ("..." if len(full_cover_prompt) > 110 else ""))
                time.sleep(RATE_LIMIT_DELAY)
                ok = download_image(full_cover_prompt, cover_dest, 768, 1024, args.key, args.model)
                if ok:
                    kb = round(cover_dest.stat().st_size / 1024)
                    print("  Saved cover.jpg ({}KB)  →  {}".format(kb, cover_dest))
                    cover_result = "generated"
                else:
                    print("  Failed — re-run to retry")
                    cover_result = "failed"
            print()

    print()
    print("--------------------------------------------------")
    print("Done!  Generated: {}  Skipped: {}  Failed: {}".format(generated, skipped, failed))
    if cover_result == "generated":
        print("Cover: cover.jpg saved to " + str(base_dir))
        print("       Upload it to Supabase Storage → copy the URL → paste into")
        print("       Creator Studio → Book Settings → Cover Image field.")
    elif cover_result == "skipped":
        print("Cover: cover.jpg already exists (use --overwrite to regenerate)")
    elif cover_result == "failed":
        print("Cover: generation failed — re-run to retry")
    print("Images: " + str(images_dir))
    print()


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        import traceback
        print("ERROR: " + str(e), file=sys.stderr)
        traceback.print_exc()
        sys.exit(1)
