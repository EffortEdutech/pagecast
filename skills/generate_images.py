#!/usr/bin/env python3
"""
pageCast Scene Image Producer
Generates scene illustrations using Pollinations.ai (free, no API key needed).
Saves one JPG per scene, named for the Beat.

Usage:
  python generate_images.py --pagecast path/to/file.txt
  python generate_images.py --folder path/to/.casts/bookname/
  python generate_images.py --folder path/ --style "watercolour" --width 1280 --height 720
"""

import argparse
import re
import sys
import time
import urllib.request
import urllib.parse
from pathlib import Path

RATE_LIMIT_DELAY = 2.0   # seconds between image requests (be kind to free service)

# Genre → style mapping (matched against pageCast Genre header)
GENRE_STYLES = {
    "young adult adventure comedy": "comic book illustration, graphic novel YA style",
    "young adult adventure":        "graphic novel illustration, YA fiction style",
    "young adult romance":          "soft illustrated YA novel style, warm tones",
    "young adult":                  "illustrated YA fiction style",
    "children's fantasy":           "watercolour children's book illustration, magical",
    "children's islamic":           "warm illustrated children's book, soft colours",
    "children's":                   "illustrated children's storybook, colourful",
    "adult literary":               "moody painterly illustration, atmospheric",
    "adult islamic":                "warm detailed illustration, serene",
    "malay":                        "batik-inspired illustrated folk art, tropical colours",
    "nusantara":                    "batik-inspired illustrated folk art, tropical colours",
}

MUSIC_MOODS = {
    "quirky_upbeat":   "light-hearted energetic mood",
    "upbeat_comedy":   "comedic cheerful mood",
    "quiet_mystery":   "mysterious subtle mood",
    "quirky_mystery":  "curious mysterious mood",
    "upbeat_tension":  "tense energetic mood",
    "quiet_tension":   "tense quiet suspense",
    "quiet_warmth":    "warm intimate mood",
    "freeze_tension":  "suspended frozen tense moment",
}


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9\s-]", "", text)
    text = re.sub(r"[\s-]+", "_", text)
    return text[:50]


def detect_style(genre: str) -> str:
    genre_lower = genre.lower()
    for key, style in GENRE_STYLES.items():
        if key in genre_lower:
            return style
    return "illustrated storybook style"


def extract_narration_lines(scene_block: str, max_lines: int = 2) -> str:
    narration_pattern = re.compile(r'\[NARRATION\]\s*\n([^\[]+)', re.MULTILINE)
    matches = narration_pattern.findall(scene_block)
    lines = []
    for match in matches[:max_lines]:
        line = match.strip().split("\n")[0].strip()
        if line and len(line) > 10:
            lines.append(line)
        if len(lines) >= max_lines:
            break
    return " ".join(lines)[:200]


def build_image_prompt(scene_data: dict, style: str) -> str:
    parts = [style]

    location = scene_data.get("location", "")
    if location:
        location = re.sub(r"^Location:\s*", "", location, flags=re.IGNORECASE).strip()
        parts.append(location)

    time_val = scene_data.get("time", "")
    if time_val:
        time_val = re.sub(r"^Time:\s*", "", time_val, flags=re.IGNORECASE).strip()
        time_short = re.split(r"[,—]", time_val)[0].strip()
        parts.append(time_short)

    music = scene_data.get("music", "").lower().replace(" ", "_")
    mood = MUSIC_MOODS.get(music)
    if mood:
        parts.append(mood)

    content = scene_data.get("narration", "")
    if content:
        parts.append(content)

    characters = scene_data.get("characters", [])
    if characters:
        char_str = ", ".join(characters[:3])
        parts.append(f"featuring {char_str}")

    parts.append("detailed composition, high quality, cinematic lighting")

    return ", ".join(filter(None, parts))


def download_image(prompt: str, dest_path: Path, width: int, height: int, model: str) -> bool:
    encoded = urllib.parse.quote(prompt)
    models_to_try = [model]
    if model == "flux":
        models_to_try.append("turbo")  # fallback if flux returns 402

    for attempt_model in models_to_try:
        url = (
            f"https://image.pollinations.ai/prompt/{encoded}"
            f"?width={width}&height={height}&model={attempt_model}&nologo=true&enhance=true"
        )
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "pageCast-image-producer/1.0"}
            )
            with urllib.request.urlopen(req, timeout=90) as resp:
                data = resp.read()
                if len(data) < 5000:
                    continue
                dest_path.write_bytes(data)
                if attempt_model != model:
                    print(f"       (used {attempt_model} fallback)")
                return True
        except urllib.error.HTTPError as e:
            if e.code == 402 and attempt_model == "flux":
                print(f"    ⚠  flux model requires account — trying turbo...")
                continue
            print(f"    ⚠  Image generation failed: {e}")
            return False
        except Exception as e:
            print(f"    ⚠  Image generation failed: {e}")
            return False
    return False


def parse_pagecast(pagecast_path: Path):
    text = pagecast_path.read_text(encoding="utf-8")

    genre_match = re.search(r'^Genre:\s*(.+)$', text, re.MULTILINE | re.IGNORECASE)
    genre = genre_match.group(1).strip() if genre_match else ""

    chapter_pattern = re.compile(r'^#\s+(?:Chapter|Bab|CHAPTER|BAB)\s+(\d+):\s*(.+)$', re.MULTILINE | re.IGNORECASE)
    scene_pattern = re.compile(r'^##\s+(?:Scene|SCENE)\s+(\d+):\s*(.+)$', re.MULTILINE | re.IGNORECASE)

    scenes = []
    current_chapter = 0
    current_chapter_title = ""

    chapter_matches = list(chapter_pattern.finditer(text))
    scene_matches = list(scene_pattern.finditer(text))

    for scene_match in scene_matches:
        scene_num = int(scene_match.group(1))
        scene_title = scene_match.group(2).strip()
        scene_start = scene_match.start()

        for ch_match in reversed(chapter_matches):
            if ch_match.start() < scene_start:
                current_chapter = int(ch_match.group(1))
                current_chapter_title = ch_match.group(2).strip()
                break

        next_scene_idx = scene_matches.index(scene_match) + 1
        if next_scene_idx < len(scene_matches):
            scene_end = scene_matches[next_scene_idx].start()
        else:
            scene_end = len(text)

        scene_block = text[scene_start:scene_end]

        def get_meta(key):
            m = re.search(rf'^{key}:\s*(.+)$', scene_block, re.MULTILINE | re.IGNORECASE)
            return m.group(1).strip() if m else ""

        location = get_meta("Location")
        time_val = get_meta("Time")
        ambience = get_meta("Ambience")
        music = get_meta("Music")

        narration = extract_narration_lines(scene_block)

        char_pattern = re.compile(r'\[DIALOGUE:\s*([^\|]+)', re.IGNORECASE)
        char_names = [m.group(1).strip() for m in char_pattern.finditer(scene_block)]
        unique_chars = list(dict.fromkeys(char_names))[:3]

        scenes.append({
            "chapter_num": current_chapter,
            "chapter_title": current_chapter_title,
            "scene_num": scene_num,
            "scene_title": scene_title,
            "location": location,
            "time": time_val,
            "ambience": ambience,
            "music": music,
            "narration": narration,
            "characters": unique_chars,
            "slug": slugify(scene_title),
        })

    return genre, scenes


def main():
    parser = argparse.ArgumentParser(description="pageCast Scene Image Producer")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--pagecast", help="Path to a single pageCast .txt file")
    group.add_argument("--folder", help="Path to a .casts/<book>/ folder")
    parser.add_argument("--style", help="Visual style override (e.g. 'watercolour', 'comic')")
    parser.add_argument("--width", type=int, default=1024, help="Image width px (default: 1024)")
    parser.add_argument("--height", type=int, default=576, help="Image height px (default: 576)")
    parser.add_argument("--model", default="turbo", choices=["flux", "turbo"],
                        help="Pollinations model: turbo (default, free) or flux (needs account)")
    parser.add_argument("--images-dir", help="Output folder (default: <folder>/images/)")
    args = parser.parse_args()

    if args.pagecast:
        pagecast_files = [Path(args.pagecast)]
        base_dir = Path(args.pagecast).parent
    else:
        base_dir = Path(args.folder)
        pagecast_files = sorted(base_dir.glob("*_pagecast.txt"))
        if not pagecast_files:
            print(f"❌  No *_pagecast.txt files found in {base_dir}")
            sys.exit(1)

    images_dir = Path(args.images_dir) if args.images_dir else base_dir / "images"
    images_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n🖼   pageCast Scene Image Producer")
    print(f"    Model: {args.model} | Size: {args.width}×{args.height}")
    print(f"    Output → {images_dir}\n")

    total_scenes = generated = skipped = failed_count = 0

    for pf in pagecast_files:
        print(f"  📄 {pf.name}")
        genre, scenes = parse_pagecast(pf)

        if not scenes:
            print(f"     No scenes found.")
            continue

        style = args.style or detect_style(genre)
        print(f"     Genre: {genre or 'unknown'}")
        print(f"     Style: {style}")
        print(f"     Scenes: {len(scenes)}\n")

        for scene in scenes:
            ch = scene["chapter_num"]
            sc = scene["scene_num"]
            slug = scene["slug"]
            filename = f"Ch{ch}_Sc{sc}_{slug}.jpg"
            dest = images_dir / filename

            total_scenes += 1

            if dest.exists():
                print(f"    ✓  {filename} (already exists — skipped)")
                skipped += 1
                continue

            prompt = build_image_prompt(scene, style)
            title = scene["scene_title"]
            print(f"    ↳  Ch{ch} Scene {sc}: {title}")
            print(f"       Prompt: {prompt[:80]}…")

            time.sleep(RATE_LIMIT_DELAY)
            success = download_image(prompt, dest, args.width, args.height, args.model)

            if success:
                size_kb = round(dest.stat().st_size / 1024)
                print(f"       ✅  saved → images/{filename} ({size_kb}KB)")
                generated += 1
            else:
                print(f"       ❌  failed — will retry on next run")
                failed_count += 1

    print(f"\n{'─'*50}")
    print(f"✅  Done!")
    print(f"   Scenes found    : {total_scenes}")
    print(f"   Generated       : {generated}")
    print(f"   Already existed : {skipped}")
    if failed_count:
        print(f"   Failed          : {failed_count} (re-run to retry)")
    print(f"\n   Images folder: {images_dir}")
    print(f"\n   Tip: Default model is turbo (free). Add --model flux for higher quality")
    print(f"        (flux may require a free Pollinations account at pollinations.ai)")
    print(f"        Use --style to override the visual style for all scenes")


if __name__ == "__main__":
    main()
