#!/usr/bin/env python3
"""
pageCast SFX Generator
Extracts [SFX: label] tags from pageCast files and generates matching audio
using the ElevenLabs Sound Generation API. No existing sound library needed —
every sound is generated fresh from a text description.

Usage:
  python generate_sfx.py --folder path/to/.casts/bookname/ --api-key YOUR_KEY
  python generate_sfx.py --pagecast path/to/file.txt --api-key YOUR_KEY

API key:
  Free tier at https://elevenlabs.io — includes monthly sound effect credits.
  Also accepted via ELEVENLABS_API_KEY environment variable.
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

# ── Label → rich generation prompt ──────────────────────────────────────────
# Keys are the snake_case labels used in [SFX: label] tags.
# Values are vivid natural-language descriptions for ElevenLabs Sound Generation.
# Unknown labels get auto-converted from snake_case (see label_to_prompt()).

LABEL_PROMPTS = {
    # ── Coastal / outdoor ────────────────────────────────────────────────────
    "seagulls_morning":     "Seagulls calling in a foggy coastal harbour, morning, distant and close",
    "seagulls_overhead":    "Seagulls crying overhead, coastal, windy, atmospheric",
    "wind_outside":         "Cold wind gusting outside a building, muffled through glass, autumn",
    "wind_rise":            "Wind rising suddenly outdoors, dramatic, swelling gust",
    "footsteps_outside":    "Single set of footsteps on wet cobblestones, steady, receding",
    "footsteps_cobble":     "Footsteps on old cobblestone, slow and deliberate",
    "footsteps_inside":     "Soft footsteps on wooden floorboards indoors, quiet",
    "waves_gentle":         "Gentle ocean waves lapping against a harbour wall, rhythmic",
    "rain_window":          "Rain pattering against a window, soft and steady",

    # ── Interior / paper / objects ───────────────────────────────────────────
    "old_door_creak":       "Old wooden door creaking open slowly, aged hinges, atmospheric",
    "door_knock":           "Three knocks on a solid wooden door, firm and deliberate",
    "door_close":           "Wooden door closing gently with a soft click",
    "brass_bell_ring":      "Small brass shop bell ringing once, dry and precise, single clear ding",
    "pencil_on_paper":      "Pencil scratching carefully on paper, light and precise, quiet room",
    "paper_rustle":         "Paper rustling and unfolding, dry and delicate",
    "paper_unfold":         "A folded map being carefully opened, paper crinkle",
    "map_rustle":           "Large paper map unfolding and rustling, parchment-like",
    "drawer_open":          "Wooden desk drawer sliding open smoothly",
    "drawer_close":         "Wooden desk drawer sliding shut with a soft thud",
    "books_fall":           "Stack of books tumbling and crashing to the floor",
    "glass_set_down":       "Glass or mug placed down on a wooden surface, soft clink",
    "key_in_lock":          "Old metal key turning in a lock, single click",
    "clock_tick":           "Old clock ticking, single measured tick",
    "clock_chime":          "Clock chiming once, resonant brass tone",
    "bells_distant":        "Distant church bells ringing, slow and resonant, fading echo",
    "typewriter_click":     "Single typewriter key click, sharp and precise",

    # ── Sci-fi / digital / GLITCH ────────────────────────────────────────────
    "freeze_whoosh":        "Cinematic time-freeze whoosh, deep bass sweep followed by high pitch sci-fi shimmer",
    "city_noise_resume":    "City ambient noise rushing back suddenly after silence, urban, busy",
    "glitch_static":        "Digital static glitch burst, electronic distortion, short",
    "glitch_beep":          "Electronic beep glitch, distorted digital tone",
    "digital_chime":        "Clean digital notification chime, soft two-tone",
    "scan_beep":            "Short scanning beep, electronic, medical or security device",
    "power_surge":          "Electrical power surge hum and buzz, brief",
    "signal_ping":          "Electronic signal ping, clear single tone",
    "vibration_low":        "Low rumbling vibration through the ground, deep subsonic pulse",
    "system_boot":          "Computer system powering up, fan spin and startup chime",

    # ── Action / impact ──────────────────────────────────────────────────────
    "dog_bark":             "Single dog bark, sharp and close, medium-sized dog",
    "crash_bollard":        "Metal bollard hit by vehicle, heavy metallic crash and clang",
    "tyre_screech":         "Car tyres screeching to a halt on dry road, sharp and brief",
    "metal_groan":          "Metal structure groaning under stress, low creaking groan",
    "crash_clatter":        "Objects crashing and clattering to the floor, chaotic brief noise",
    "crash_large":          "Large heavy object crashing hard, deep impact with debris",
    "items_clattering":     "Small objects clattering and falling, loose items scattering",
    "clang":                "Single sharp metallic clang, impact, clear resonance",
    "flour_explosion":      "Powder or flour bursting from a bag, whooshing puff of air",
    "trolley_wobble":       "Supermarket trolley wheel rattling and wobbling on hard floor",
    "scream_distant":       "Distant faint scream, female, briefly audible then gone",

    # ── Nature / atmosphere ──────────────────────────────────────────────────
    "thunder_distant":      "Distant thunder rolling across the sky, low and ominous",
    "rain_heavy":           "Heavy rain falling outside, steady downpour on glass and rooftop",
    "leaves_rustle":        "Dry leaves rustling in a gentle breeze, outdoor, autumn",

    # ── Human / voice ────────────────────────────────────────────────────────
    "crowd_murmur":         "Quiet crowd murmuring in a room, low background chatter",
    "single_laugh":         "Single brief laugh, warm and genuine",
    "sharp_intake_breath":  "Sharp intake of breath, surprised or alarmed",
}

ELEVENLABS_SFX_URL = "https://api.elevenlabs.io/v1/sound-generation"
RATE_LIMIT_DELAY   = 1.2   # seconds between calls — stay within free tier RPM


def label_to_prompt(label: str) -> str:
    """Return a generation prompt for a label. Falls back to humanising the label."""
    if label in LABEL_PROMPTS:
        return LABEL_PROMPTS[label]
    # Auto-convert snake_case to a readable prompt
    words = label.replace("_", " ").replace("-", " ")
    return f"{words} sound effect, clear and distinct"


def extract_sfx_labels(pagecast_text: str) -> list:
    """Extract all unique [SFX: label] tags from pageCast text."""
    pattern = re.compile(r'\[SFX:\s*([^\]]+)\]', re.IGNORECASE)
    labels = pattern.findall(pagecast_text)
    normalised = [lbl.strip().lower().replace(" ", "_") for lbl in labels]
    seen = set()
    unique = []
    for lbl in normalised:
        if lbl not in seen:
            seen.add(lbl)
            unique.append(lbl)
    return unique


def generate_sfx(prompt: str, api_key: str, duration: float = 5.0) -> bytes | None:
    """
    Call ElevenLabs Sound Generation API and return raw MP3 bytes.
    duration: 0.5–22.0 seconds. Keep short for SFX (3–7s recommended).
    prompt_influence: 0.0–1.0. Higher = more literal interpretation.
    """
    payload = json.dumps({
        "text":             prompt,
        "duration_seconds": duration,
        "prompt_influence": 0.4,
    }).encode("utf-8")

    req = urllib.request.Request(
        ELEVENLABS_SFX_URL,
        data=payload,
        headers={
            "xi-api-key":   api_key,
            "Content-Type": "application/json",
            "Accept":       "audio/mpeg",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.read()
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        if e.code == 401:
            print(f"    ❌  401 Unauthorized — check your ElevenLabs API key")
        elif e.code == 422:
            print(f"    ❌  422 Unprocessable — prompt may be too long or invalid")
            print(f"       {body[:200]}")
        elif e.code == 429:
            print(f"    ⏳  429 Rate limited — waiting 30s then retrying…")
            time.sleep(30)
            return generate_sfx(prompt, api_key, duration)  # single retry
        else:
            print(f"    ❌  HTTP {e.code}: {body[:200]}")
    except Exception as e:
        print(f"    ❌  Request failed: {e}")
    return None


def pick_duration(label: str) -> float:
    """Choose an appropriate generation duration based on the label type."""
    short_labels = {
        "old_door_creak", "door_knock", "door_close", "brass_bell_ring",
        "clock_tick", "clock_chime", "key_in_lock", "glass_set_down",
        "drawer_open", "drawer_close", "clang", "dog_bark", "single_laugh",
        "sharp_intake_breath", "glitch_beep", "digital_chime", "scan_beep",
        "signal_ping", "typewriter_click",
    }
    long_labels = {
        "seagulls_morning", "seagulls_overhead", "wind_outside", "wind_rise",
        "rain_window", "footsteps_outside", "footsteps_cobble", "footsteps_inside",
        "bells_distant", "freeze_whoosh", "city_noise_resume", "vibration_low",
        "thunder_distant", "rain_heavy", "crowd_murmur", "metal_groan",
        "crash_clatter", "crash_large", "items_clattering",
    }
    if label in short_labels:
        return 3.0
    if label in long_labels:
        return 7.0
    return 5.0  # default


def process_folder(pagecast_files: list, sfx_dir: Path, api_key: str) -> dict:
    """Extract all unique labels across files, generate missing ones."""
    # Collect all unique labels across all files first
    all_labels = []
    seen = set()
    for pf in pagecast_files:
        text = pf.read_text(encoding="utf-8")
        for lbl in extract_sfx_labels(text):
            if lbl not in seen:
                seen.add(lbl)
                all_labels.append(lbl)

    if not all_labels:
        print("  No [SFX: ...] tags found in any pageCast file.")
        return {"found": 0, "generated": 0, "skipped": 0, "failed": []}

    print(f"  Found {len(all_labels)} unique SFX label(s) across all chapters\n")
    sfx_dir.mkdir(parents=True, exist_ok=True)

    generated = 0
    skipped   = 0
    failed    = []

    for label in all_labels:
        dest = sfx_dir / f"{label}.mp3"
        if dest.exists():
            print(f"  ✓  {label}.mp3 (exists — skipped)")
            skipped += 1
            continue

        prompt   = label_to_prompt(label)
        duration = pick_duration(label)
        print(f"  ↳  [{label}]")
        print(f"     prompt   : \"{prompt}\"")
        print(f"     duration : {duration}s")
        print(f"     generating…", end=" ", flush=True)

        time.sleep(RATE_LIMIT_DELAY)
        audio_bytes = generate_sfx(prompt, api_key, duration)

        if audio_bytes:
            dest.write_bytes(audio_bytes)
            size_kb = round(len(audio_bytes) / 1024, 1)
            print(f"✅  saved ({size_kb} KB) → sfx/{label}.mp3")
            generated += 1
        else:
            print(f"❌  failed")
            failed.append(label)

    return {
        "found":     len(all_labels),
        "generated": generated,
        "skipped":   skipped,
        "failed":    failed,
    }


def main():
    parser = argparse.ArgumentParser(
        description="pageCast SFX Generator — ElevenLabs Sound Generation"
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--pagecast", help="Path to a single pageCast .txt file")
    group.add_argument("--folder",   help="Path to a .casts/<book>/ folder (processes all chapters)")
    parser.add_argument(
        "--api-key",
        default=os.environ.get("ELEVENLABS_API_KEY", ""),
        help="ElevenLabs API key (or set ELEVENLABS_API_KEY env var). "
             "Free tier: https://elevenlabs.io",
    )
    parser.add_argument("--sfx-dir", help="Output folder (default: <folder>/sfx/)")
    args = parser.parse_args()

    api_key = args.api_key
    if not api_key:
        print("❌  No ElevenLabs API key provided.")
        print("    Pass --api-key YOUR_KEY or set ELEVENLABS_API_KEY environment variable.")
        print("    Free tier available at: https://elevenlabs.io")
        sys.exit(1)

    if args.pagecast:
        pagecast_files = [Path(args.pagecast)]
        base_dir = Path(args.pagecast).parent
    else:
        base_dir = Path(args.folder)
        pagecast_files = sorted(base_dir.glob("*_pagecast.txt"))
        if not pagecast_files:
            print(f"❌  No *_pagecast.txt files found in: {base_dir}")
            sys.exit(1)

    sfx_dir = Path(args.sfx_dir) if args.sfx_dir else base_dir / "sfx"

    print(f"\n🔊  pageCast SFX Generator  (ElevenLabs Sound Generation)")
    print(f"    Book folder : {base_dir.name}")
    print(f"    Chapters    : {len(pagecast_files)}")
    print(f"    Output      : {sfx_dir}\n")

    result = process_folder(pagecast_files, sfx_dir, api_key)

    folder_size = sum(f.stat().st_size for f in sfx_dir.glob("*.mp3")) if sfx_dir.exists() else 0
    size_mb = round(folder_size / 1_048_576, 1)

    print(f"\n{'─'*55}")
    print(f"✅  Done!")
    print(f"   Labels found  : {result['found']}")
    print(f"   Generated     : {result['generated']}")
    print(f"   Already existed: {result['skipped']}")
    print(f"   Folder size   : {size_mb} MB")
    if result["failed"]:
        print(f"\n   ❌  Failed ({len(result['failed'])}): {', '.join(result['failed'])}")
        print(f"   Tip: Re-run to retry, or add a custom prompt to LABEL_PROMPTS in this file.")
    print(f"\n   SFX folder: {sfx_dir}")


if __name__ == "__main__":
    main()
