#!/usr/bin/env python3
"""
generate_elevenlabs_audio.py
----------------------------
Generates SFX and Ambience audio for pageCast stories using the ElevenLabs
Sound Effects API.

- [SFX: label]   → saved as  sfx/label.mp3        (default 5 seconds)
- Ambience: label → saved as  ambience/label.mp3   (default 10 seconds)

Usage:
    python scripts/generate_elevenlabs_audio.py --folder .casts/glitch
    python scripts/generate_elevenlabs_audio.py --file .casts/glitch/Glitch_Ch1_pagecast.txt
    python scripts/generate_elevenlabs_audio.py --folder .casts/glitch --api-key sk_xxx
    python scripts/generate_elevenlabs_audio.py --folder .casts/glitch --sfx-duration 7 --ambience-duration 12

The API key can also be set via environment variable:
    export ELEVENLABS_API_KEY=sk_xxx
"""

import argparse
import os
import re
import sys
import time
import urllib.request
import urllib.error
import json
from pathlib import Path

# ── ElevenLabs API ─────────────────────────────────────────────────────────
API_URL = "https://api.elevenlabs.io/v1/sound-generation"
SFX_DURATION      = 5.0   # default; override with --sfx-duration
AMBIENCE_DURATION = 10.0  # default; override with --ambience-duration
PROMPT_INFLUENCE  = 0.3   # 0.0 = pure model creativity, 1.0 = strict to prompt

# ── Label → prompt enrichment ───────────────────────────────────────────────
# Add entries here to override the automatic snake_case → text conversion.
SFX_PROMPT_MAP = {
    # transport
    "tyre_screech":        "car tyre screech sudden braking on tarmac",
    "car_engine":          "car engine idling then accelerating",
    "car_door":            "car door closing metallic thud",
    "van_screech":         "van braking hard tyre screech",
    # city
    "city_noise":          "busy city street traffic and crowd noise",
    "city_noise_resume":   "city street sounds resume after silence",
    "construction_noise":  "construction site drilling hammering metal",
    # impacts
    "crash_bollard":       "heavy metal crash impact bollard collision",
    "crash_clatter":       "objects crashing and clattering to the floor",
    "crash_large":         "large heavy crash impact rumble",
    "books_crashing":      "stack of books falling crashing paper rustling",
    "clang":               "sharp metallic clang ring",
    # nature / environment
    "dog_bark":            "dog barking single short sharp",
    "bird_wings":          "bird wings flapping taking flight",
    "rain_light":          "light rain falling on pavement",
    "wind_gust":           "sudden wind gust whoosh outdoor",
    "thunder":             "distant thunder rumble",
    # sci-fi / supernatural
    "freeze_whoosh":       "time freeze whoosh sci-fi slow motion effect",
    "time_resume":         "time resuming whoosh reality snap back",
    "glitch_buzz":         "digital glitch electronic buzz distortion",
    "glitch_pop":          "electronic glitch pop crackle digital artifact",
    "power_up":            "sci-fi power up hum energy charge",
    # school / indoor
    "school_bell":         "school bell ringing corridor",
    "locker_slam":         "metal school locker slamming shut",
    "chair_scrape":        "chair scraping on floor classroom",
    "clock_tick":          "wall clock ticking steady rhythm",
    "paper_rustle":        "paper rustling turning pages",
    # misc
    "door_creak":          "old wooden door creaking open slowly",
    "footsteps":           "footsteps walking on pavement",
    "crowd_murmur":        "crowd murmuring indistinct chatter",
    "notification_ping":   "phone notification ping chime",
    "keyboard_typing":     "keyboard typing rapid clatter",
}

AMBIENCE_PROMPT_MAP = {
    "city_traffic":           "busy city traffic intersection cars horns background",
    "city_street":            "city street ambient urban background hum",
    "city_street_busy":       "busy city street heavy traffic pedestrians urban",
    "city_street_quiet":      "quiet city street occasional car passing",
    "city_morning":           "city morning ambience birds cars distant traffic",
    "city_morning_quiet":     "quiet city morning distant traffic birds",
    "city_evening":           "city evening ambient dusk winding down",
    "city_ambience_quiet":    "quiet city background hum low traffic",
    "indoor_quiet":           "quiet indoor room tone low hum silence",
    "school_corridor":        "school corridor ambient distant voices echoing",
    "school_classroom":       "classroom ambient quiet students background",
    "library":                "library ambient quiet pages turning whispers",
    "park_afternoon":         "park afternoon birds breeze children distant",
    "rain_ambience":          "rain falling steady outdoor ambient",
    "night_quiet":            "quiet night ambience crickets distant hum",
    "market":                 "outdoor market bustling voices stalls activity",
    "café":                   "café interior ambient chatter coffee machine",
    "forest":                 "forest ambient birdsong breeze leaves rustling",
    "office":                 "open plan office ambient keyboard hum quiet chatter",
    "hospital":               "hospital corridor ambient quiet distant beep",
}


def label_to_prompt(label: str, prompt_map: dict) -> str:
    """Return a descriptive prompt for a label, using the map or auto-converting."""
    if label in prompt_map:
        return prompt_map[label]
    # Auto: snake_case → spaced words, clean up
    words = label.replace("_", " ").replace("-", " ")
    return words


def generate_audio(prompt: str, duration: float, api_key: str) -> bytes:
    """Call ElevenLabs sound-generation API and return raw MP3 bytes."""
    payload = json.dumps({
        "text": prompt,
        "duration_seconds": duration,
        "prompt_influence": PROMPT_INFLUENCE,
    }).encode("utf-8")

    req = urllib.request.Request(
        API_URL,
        data=payload,
        headers={
            "xi-api-key": api_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read()


def extract_sfx_labels(text: str) -> list:
    """Extract all unique [SFX: label] values from pagecast text."""
    return list(dict.fromkeys(re.findall(r'\[SFX:\s*([^\]]+)\]', text)))


def extract_ambience_labels(text: str) -> list:
    """Extract all unique Ambience: label values from pagecast text."""
    return list(dict.fromkeys(re.findall(r'^Ambience:\s*(.+)$', text, re.MULTILINE)))


def process_file(txt_path: Path, api_key: str, stats: dict,
                 sfx_duration: float = SFX_DURATION,
                 ambience_duration: float = AMBIENCE_DURATION):
    text = txt_path.read_text(encoding="utf-8")
    base = txt_path.parent

    sfx_dir      = base / "sfx"
    ambience_dir = base / "ambience"
    sfx_dir.mkdir(exist_ok=True)
    ambience_dir.mkdir(exist_ok=True)

    sfx_labels      = extract_sfx_labels(text)
    ambience_labels = extract_ambience_labels(text)

    for label in sfx_labels:
        label = label.strip()
        out_path = sfx_dir / f"{label}.mp3"
        if out_path.exists():
            print(f"  [skip]  sfx/{label}.mp3  (already exists)")
            stats["skipped"] += 1
            continue
        prompt = label_to_prompt(label, SFX_PROMPT_MAP)
        print(f"  [SFX]   {label}  →  \"{prompt}\"  ({sfx_duration}s) ...", end=" ", flush=True)
        try:
            audio = generate_audio(prompt, sfx_duration, api_key)
            out_path.write_bytes(audio)
            print(f"✓  ({len(audio)//1024}KB)")
            stats["ok"] += 1
        except urllib.error.HTTPError as e:
            body = e.read().decode(errors="replace")
            print(f"✗  HTTP {e.code}: {body[:120]}")
            stats["failed"] += 1
        except Exception as e:
            print(f"✗  {e}")
            stats["failed"] += 1
        time.sleep(0.5)  # gentle rate-limit

    for label in ambience_labels:
        label = label.strip()
        out_path = ambience_dir / f"{label}.mp3"
        if out_path.exists():
            print(f"  [skip]  ambience/{label}.mp3  (already exists)")
            stats["skipped"] += 1
            continue
        prompt = label_to_prompt(label, AMBIENCE_PROMPT_MAP)
        print(f"  [AMB]   {label}  →  \"{prompt}\"  ({ambience_duration}s) ...", end=" ", flush=True)
        try:
            audio = generate_audio(prompt, ambience_duration, api_key)
            out_path.write_bytes(audio)
            print(f"✓  ({len(audio)//1024}KB)")
            stats["ok"] += 1
        except urllib.error.HTTPError as e:
            body = e.read().decode(errors="replace")
            print(f"✗  HTTP {e.code}: {body[:120]}")
            stats["failed"] += 1
        except Exception as e:
            print(f"✗  {e}")
            stats["failed"] += 1
        time.sleep(0.5)


def main():
    parser = argparse.ArgumentParser(description="Generate pageCast SFX & Ambience via ElevenLabs")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--folder", help="Path to a .casts/BOOKNAME/ folder (processes all pagecast .txt files)")
    group.add_argument("--file",   help="Path to a single pagecast .txt file")
    parser.add_argument("--api-key", default=os.environ.get("ELEVENLABS_API_KEY"), help="ElevenLabs API key")
    parser.add_argument("--sfx-duration",      type=float, default=SFX_DURATION,      metavar="SEC", help=f"SFX clip length in seconds (default: {SFX_DURATION})")
    parser.add_argument("--ambience-duration", type=float, default=AMBIENCE_DURATION, metavar="SEC", help=f"Ambience clip length in seconds (default: {AMBIENCE_DURATION})")
    args = parser.parse_args()

    api_key = args.api_key
    if not api_key:
        print("ERROR: No API key. Pass --api-key or set ELEVENLABS_API_KEY.", file=sys.stderr)
        sys.exit(1)

    stats = {"ok": 0, "skipped": 0, "failed": 0}

    if args.file:
        path = Path(args.file)
        if not path.exists():
            print(f"ERROR: File not found: {path}", file=sys.stderr)
            sys.exit(1)
        print(f"\n── {path.name} ──")
        process_file(path, api_key, stats, args.sfx_duration, args.ambience_duration)

    else:
        folder = Path(args.folder)
        if not folder.exists():
            print(f"ERROR: Folder not found: {folder}", file=sys.stderr)
            sys.exit(1)
        txt_files = sorted(folder.glob("*_pagecast.txt"))
        if not txt_files:
            txt_files = sorted(folder.glob("*.txt"))
        if not txt_files:
            print(f"ERROR: No pagecast .txt files found in {folder}", file=sys.stderr)
            sys.exit(1)
        for txt in txt_files:
            print(f"\n── {txt.name} ──")
            process_file(txt, api_key, stats, args.sfx_duration, args.ambience_duration)

    print(f"\n{'─'*40}")
    print(f"  Generated : {stats['ok']}")
    print(f"  Skipped   : {stats['skipped']}  (already existed)")
    print(f"  Failed    : {stats['failed']}")
    print(f"{'─'*40}")


if __name__ == "__main__":
    main()
