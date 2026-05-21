#!/usr/bin/env python3
"""
scene-prompt-writer — pageCast Scene Prompt Generator
Reads pageCast .txt files and writes a <book>_image_prompts.txt with
one precise visual image prompt per scene, ready for generate_images.py.

How prompts are generated:
  1. If --ai and a Pollinations/Claude API key is provided → AI-written prompts
  2. Otherwise → structured template built from scene metadata (fast, free, offline)

Usage:
  python skills/scene-prompt-writer/scene_prompt_writer.py --folder ".casts/glitch/"
  python skills/scene-prompt-writer/scene_prompt_writer.py --folder ".casts/glitch/" --ai
  python skills/scene-prompt-writer/scene_prompt_writer.py --folder ".casts/glitch/" --ai --key pk_YOUR_KEY

Output:
  .casts/<book>/<Book>_image_prompts.txt
  → Then review/edit the file, then run:
  python skills/generate_images.py --folder ".casts/<book>/" --style-pick 2
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.request
import urllib.parse
import urllib.error
from pathlib import Path

RATE_LIMIT_DELAY = 1.5

# ── Scene parsing ─────────────────────────────────────────────────────────────

def slugify(text):
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9\s-]", "", text)
    text = re.sub(r"[\s-]+", "_", text)
    return text[:50]


def parse_pagecast(path):
    text = path.read_text(encoding="utf-8")

    genre_m = re.search(r'^Genre:\s*(.+)$', text, re.MULTILINE | re.IGNORECASE)
    genre = genre_m.group(1).strip() if genre_m else ""

    title_m = re.search(r'^Title:\s*(.+)$', text, re.MULTILINE | re.IGNORECASE)
    book_title = title_m.group(1).strip() if title_m else path.stem

    cast_m = re.findall(r'^-\s+(\w[\w\s]+?)(?:\s+\||\s*$)', text, re.MULTILINE)
    book_cast = [n.strip() for n in cast_m[:8]]

    chapter_pat = re.compile(r'^#\s+(?:Chapter|Bab|CHAPTER)\s+(\d+):\s*(.+)$', re.MULTILINE | re.IGNORECASE)
    scene_pat   = re.compile(r'^##\s+(?:Scene|SCENE)\s+(\d+):\s*(.+)$', re.MULTILINE | re.IGNORECASE)

    chapters = list(chapter_pat.finditer(text))
    scenes   = list(scene_pat.finditer(text))

    result = []
    cur_ch, cur_ch_title = 0, ""

    for i, sm in enumerate(scenes):
        sc_num   = int(sm.group(1))
        sc_title = sm.group(2).strip()
        sc_start = sm.start()

        for cm in reversed(chapters):
            if cm.start() < sc_start:
                cur_ch       = int(cm.group(1))
                cur_ch_title = cm.group(2).strip()
                break

        sc_end = scenes[i+1].start() if i+1 < len(scenes) else len(text)
        block  = text[sc_start:sc_end]

        def meta(key, b=block):
            m = re.search(r'^' + key + r':\s*(.+)$', b, re.MULTILINE | re.IGNORECASE)
            return m.group(1).strip() if m else ""

        # Characters who speak in this scene
        chars = list(dict.fromkeys(
            m.group(1).strip()
            for m in re.finditer(r'\[DIALOGUE:\s*([^|]+)', block, re.IGNORECASE)
        ))[:3]

        # First 3 narration lines
        narr_blocks = re.findall(r'\[NARRATION\][ \t]*\r?\n(.*?)(?=\[|\Z)', block, re.DOTALL)
        narr_lines  = []
        for nb in narr_blocks:
            line = nb.strip().split('\n')[0].strip()
            if line and len(line) > 10:
                narr_lines.append(line)
            if len(narr_lines) >= 3:
                break

        # SFX labels
        sfx = re.findall(r'\[SFX:\s*([^\]]+)\]', block)

        result.append({
            "chapter_num":   cur_ch,
            "chapter_title": cur_ch_title,
            "scene_num":     sc_num,
            "scene_title":   sc_title,
            "slug":          slugify(sc_title),
            "location":      re.sub(r'^Location:\s*', '', meta("Location"), flags=re.IGNORECASE),
            "time":          re.sub(r'^Time:\s*', '', meta("Time"), flags=re.IGNORECASE),
            "ambience":      re.sub(r'^Ambience:\s*', '', meta("Ambience"), flags=re.IGNORECASE),
            "music":         meta("Music"),
            "characters":    chars,
            "narration":     " ".join(narr_lines)[:500],
            "sfx":           sfx[:4],
        })

    return book_title, genre, book_cast, result


# ── Template prompt builder (no AI, offline) ──────────────────────────────────

def build_template_prompt(scene, book_cast):
    """
    Build a structured visual prompt from scene metadata.
    No AI needed — uses location, time, ambience, characters, and narration keywords.
    """
    parts = []

    # Characters
    chars = scene["characters"] or book_cast[:2]
    if chars:
        parts.append(", ".join(chars[:2]))

    # First narration sentence stripped of pronouns/auxiliaries
    narr = scene["narration"]
    if narr:
        sentence = re.split(r'[.!?]', narr)[0].strip()
        # Remove first-person openers
        sentence = re.sub(r'^(I |We |My |Here)', '', sentence, flags=re.IGNORECASE)
        sentence = re.sub(r'\b(was|were|had|have|is|are|the|a|an)\b', '', sentence, flags=re.IGNORECASE)
        sentence = re.sub(r'\s+', ' ', sentence).strip()
        if len(sentence) > 10:
            parts.append(sentence)

    # Location (shortened)
    loc = scene["location"].split(',')[0].strip()
    if loc:
        parts.append(loc)

    # Time (just time-of-day word)
    time_val = scene["time"]
    for tod in ["morning", "afternoon", "evening", "night", "dusk", "dawn", "midnight"]:
        if tod in time_val.lower():
            parts.append(tod)
            break

    # Ambience as mood word
    amb = scene["ambience"].replace("_", " ")
    if amb:
        parts.append(amb)

    prompt = ", ".join(p for p in parts if p)
    return prompt if len(prompt) > 15 else f"{scene['scene_title']} scene, {scene['location']}, {scene['ambience'].replace('_',' ')}"


# ── AI prompt builder (Pollinations text API) ─────────────────────────────────

SYSTEM_PROMPT = (
    "You are a visual art director for a YA novel. "
    "Given a scene brief, write ONE precise image generation prompt (max 25 words). "
    "Describe ONLY what is visually depicted: characters, their actions, the setting, the mood. "
    "Do NOT mention dialogue, speech, thoughts, feelings, or inner state. "
    "Do NOT use speech-bubble-triggering phrases. "
    "Output ONLY the prompt text, nothing else."
)


def build_ai_prompt(scene, api_key=""):
    """Call Pollinations text API to generate a visual prompt from scene context."""
    chars = ", ".join(scene["characters"][:2]) if scene["characters"] else "the protagonist"
    user_msg = (
        f"Scene: {scene['scene_title']}\n"
        f"Characters: {chars}\n"
        f"Location: {scene['location']}\n"
        f"Time: {scene['time']}\n"
        f"Ambience: {scene['ambience'].replace('_', ' ')}\n"
        f"Narration excerpt: {scene['narration'][:200]}\n\n"
        f"Write a single visual image generation prompt (max 25 words)."
    )

    payload = json.dumps({
        "model": "openai",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": user_msg},
        ],
        "temperature": 0.7,
        "max_tokens": 80,
        "seed": hash(scene['scene_title']) % 10000,
    }).encode()

    headers = {"Content-Type": "application/json", "User-Agent": "pageCast-prompt-writer/1.0"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    try:
        req = urllib.request.Request(
            "https://text.pollinations.ai/",
            data=payload,
            headers=headers,
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=30) as r:
            body = json.loads(r.read())
            return body["choices"][0]["message"]["content"].strip()
    except Exception as e:
        return ""  # caller will fall back to template


# ── Output file writer ────────────────────────────────────────────────────────

def write_prompts_file(out_path, book_title, scenes, prompts, mode):
    lines = [
        f"# {book_title} — Image Generation Prompts",
        f"# Generated by scene-prompt-writer ({mode} mode)",
        f"# Total scenes: {len(scenes)}",
        "#",
        "# Usage: python skills/generate_images.py --folder <folder> --style-pick 2",
        "#",
        "# Review and edit any prompt before running generate_images.py.",
        "# Keep prompts under 30 words. No dialogue. No speech references.",
        "",
    ]

    cur_ch = None
    for scene, prompt in zip(scenes, prompts):
        if scene["chapter_num"] != cur_ch:
            cur_ch = scene["chapter_num"]
            lines.append(f"# ── Chapter {cur_ch} {'─' * 60}")
            lines.append("")

        lines.append(f"[Ch{scene['chapter_num']}Sc{scene['scene_num']}]")
        lines.append(f"slug={scene['slug']}")
        lines.append(f"prompt={prompt}")
        lines.append("")

    out_path.write_text("\n".join(lines), encoding="utf-8")


# ── Prompts file reader (for generate_images.py) ─────────────────────────────

def read_prompts_file(path):
    """
    Parse a _image_prompts.txt file.
    Returns: dict { "Ch1Sc1": {"slug": ..., "prompt": ...}, ... }
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
        m = re.match(r'^\[Ch(\d+)Sc(\d+)\]$', line)
        if m:
            if cur_key and cur:
                result[cur_key] = cur
            cur_key = f"Ch{m.group(1)}Sc{m.group(2)}"
            cur = {}
            continue
        if '=' in line and cur_key is not None:
            k, _, v = line.partition('=')
            cur[k.strip()] = v.strip()

    if cur_key and cur:
        result[cur_key] = cur

    return result


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="pageCast Scene Prompt Writer")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--folder",   help="Path to a .casts/<book>/ folder")
    group.add_argument("--pagecast", help="Path to a single pageCast .txt file")
    parser.add_argument("--ai",      action="store_true",
                        help="Use Pollinations AI to write prompts (free, slower)")
    parser.add_argument("--key",     default="", metavar="pk_...",
                        help="Pollinations API key for priority access")
    parser.add_argument("--out",     help="Output file path (default: <folder>/<Book>_image_prompts.txt)")
    parser.add_argument("--overwrite", action="store_true",
                        help="Overwrite existing prompts file")
    args = parser.parse_args()

    if args.folder:
        base = Path(args.folder)
        files = sorted(base.glob("*_pagecast.txt"))
        if not files:
            print(f"Error: no *_pagecast.txt files found in {base}")
            sys.exit(1)
    else:
        files = [Path(args.pagecast)]
        base  = Path(args.pagecast).parent

    all_scenes = []
    book_title = base.name
    genre = ""
    book_cast = []

    for f in files:
        bt, g, bc, scenes = parse_pagecast(f)
        if not genre:
            genre, book_title, book_cast = g, bt, bc
        all_scenes.extend(scenes)

    # Default output path
    book_slug = slugify(book_title)
    out_path = Path(args.out) if args.out else base / f"{book_title}_image_prompts.txt"

    if out_path.exists() and not args.overwrite:
        print(f"Prompts file already exists: {out_path}")
        print("Use --overwrite to regenerate it.")
        sys.exit(0)

    mode = "AI" if args.ai else "template"
    print(f"\npageCast Scene Prompt Writer")
    print(f"Book  : {book_title}")
    print(f"Scenes: {len(all_scenes)}")
    print(f"Mode  : {mode}")
    print(f"Output: {out_path}")
    print()

    prompts = []
    for i, scene in enumerate(all_scenes):
        ch, sc = scene["chapter_num"], scene["scene_num"]
        label  = f"Ch{ch}Sc{sc} — {scene['scene_title']}"

        if args.ai:
            prompt = build_ai_prompt(scene, args.key)
            if not prompt:
                prompt = build_template_prompt(scene, book_cast)
                print(f"  [{i+1:2d}/{len(all_scenes)}] {label} (AI failed → template)")
            else:
                print(f"  [{i+1:2d}/{len(all_scenes)}] {label}")
            time.sleep(RATE_LIMIT_DELAY)
        else:
            prompt = build_template_prompt(scene, book_cast)
            print(f"  [{i+1:2d}/{len(all_scenes)}] {label}")

        prompts.append(prompt)

    write_prompts_file(out_path, book_title, all_scenes, prompts, mode)

    print()
    print(f"Done! Prompts written to: {out_path}")
    print()
    print("Next steps:")
    print(f"  1. Open and review/edit {out_path.name}")
    print(f"  2. Run: python skills/generate_images.py --folder \"{base}\" --style-pick 2")
    print()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nAborted.")
    except Exception as e:
        import traceback
        print(f"ERROR: {e}", file=sys.stderr)
        traceback.print_exc()
        sys.exit(1)
