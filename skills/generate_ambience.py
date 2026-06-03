#!/usr/bin/env python3
"""
pageCast Ambience Generator
Extracts Ambience: tags from pageCast scene headers and generates loopable
ambient audio using Meta's MusicGen model via the HuggingFace Inference API.

Completely free — no API key required.
Optional: pass --hf-token for higher rate limits (free at huggingface.co).

Usage:
  python generate_ambience.py --folder path/to/.casts/bookname/
  python generate_ambience.py --pagecast path/to/file.txt
  python generate_ambience.py --folder path/to/.casts/bookname/ --hf-token YOUR_TOKEN
  python generate_ambience.py --folder path/to/.casts/bookname/ --duration 20

Notes:
  - Generates ~15–30 second ambient loops (set with --duration, default 22s)
  - HuggingFace free tier: ~10–20 requests before rate limiting; re-run to continue
  - Model cold-start: first request may take 30–60s while the model loads
  - Output: ambience/<label>.mp3 (WAV converted to MP3 via lameenc)
  - Re-running skips already-generated files
"""

import argparse
import io
import json
import os
import re
import struct
import subprocess
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

# ── Install lameenc if needed (MP3 encoder, no ffmpeg required) ──────────────
try:
    import lameenc
except ImportError:
    print("Installing lameenc (MP3 encoder)…")
    subprocess.check_call([
        sys.executable, "-m", "pip", "install", "lameenc", "--quiet",
        "--break-system-packages"
    ])
    import lameenc

# ── HuggingFace model ─────────────────────────────────────────────────────────
HF_API_URL    = "https://api-inference.huggingface.co/models/facebook/musicgen-small"
RETRY_DELAY   = 35    # seconds to wait when model is loading (503)
MAX_RETRIES   = 5
RATE_DELAY    = 2.0   # seconds between successful requests

# ── Label → MusicGen generation prompt ───────────────────────────────────────
# MusicGen responds best to descriptive atmospheric prompts.
# Keep prompts under ~100 words. Include BPM/tempo hints for better loops.
# Unknown labels get auto-converted from snake_case.

LABEL_PROMPTS = {
    # ── Coastal / harbour ────────────────────────────────────────────────────
    "coastal_morning":     "Calm coastal harbour morning, gentle waves, distant seagulls, soft sea breeze, "
                           "peaceful and atmospheric, cinematic ambient, no melody",
    "coastal_afternoon":   "Coastal harbour afternoon, light waves, occasional seagull, distant boat sounds, "
                           "breezy, warm, atmospheric background, no melody",
    "coastal_evening":     "Coastal harbour at dusk, quiet waves, distant foghorn, melancholic and still, "
                           "cinematic ambient texture, no melody",
    "coastal_wind":        "Cold coastal wind through rigging, harbour atmosphere, moody and grey, "
                           "subtle wave sounds, cinematic ambience",
    "harbour_morning":     "Early morning harbour, ropes and masts, light waves, quiet and expectant, "
                           "ambient, no melody",

    # ── Interior / old buildings ─────────────────────────────────────────────
    "old_wood_interior":   "Old wooden interior room, quiet and still, subtle creak, dusty and warm, "
                           "library or study atmosphere, gentle ambient hum, no melody",
    "cosy_indoor":         "Cosy indoor room, warm and quiet, faint clock, comfortable atmosphere, "
                           "soft ambient texture, no melody",
    "library_quiet":       "Quiet library interior, hushed and calm, paper and wood, gentle ambient hum, "
                           "scholarly peaceful atmosphere, no melody",
    "map_shop_interior":   "Narrow old map shop interior, paper and wood, warm lamplight, quiet and still, "
                           "cosy ambient texture, no melody",
    "indoor_quiet":        "Quiet indoor room, still air, faint hum, calm and neutral ambient, no melody",
    "hotel_room":          "Quiet hotel room at night, distant city sounds, muffled, still and lonely, "
                           "ambient texture, no melody",

    # ── Urban / city ─────────────────────────────────────────────────────────
    "city_morning":        "City street morning ambient, light traffic, birds, footsteps, awakening urban, "
                           "no music, background texture",
    "city_afternoon":      "City street afternoon ambient, moderate traffic, pedestrians, urban buzz, "
                           "natural city soundscape, no melody",
    "city_evening":        "City street evening, quieter traffic, distant voices, urban atmosphere, "
                           "slightly melancholic ambient, no melody",
    "city_night":          "City at night, sparse traffic, distant sounds, quiet urban, atmospheric, "
                           "cinematic ambience, no melody",
    "city_street":         "Urban city street ambient, traffic and pedestrians, lively background, no melody",
    "city_street_quiet":   "Quiet city street, sparse traffic, distant city hum, calm urban ambient, no melody",

    # ── School / institutional ───────────────────────────────────────────────
    "school_canteen":      "Busy school canteen, children chattering, cutlery and trays, lively indoor, "
                           "ambient cafeteria noise, no melody",
    "school_canteen_quiet":"School canteen emptying out, sparse chatter, echoing room, ambient, no melody",
    "school_classroom":    "Quiet school classroom, faint chalk, ambient indoor, attentive stillness, no melody",
    "school_library":      "School library, quiet and ordered, whispers, pages turning, calm ambient, no melody",
    "school_exterior":     "School playground exterior, distant children playing, open air, ambient, no melody",

    # ── Nature / outdoor ────────────────────────────────────────────────────
    "park_morning":        "Park morning ambience, birds singing, gentle breeze through leaves, "
                           "peaceful and natural, no melody",
    "park_afternoon":      "Park afternoon, birdsong, distant laughter, light wind, relaxed outdoor ambient",
    "park_evening":        "Park at dusk, fading birdsong, cooler air, melancholic and still, ambient",
    "forest_ambient":      "Deep forest ambient, birdsong, wind through trees, natural and immersive, no melody",
    "rain_ambient":        "Steady rain ambient, rain on windows and roof, cosy and rhythmic, no melody",
    "winter_outdoor":      "Winter outdoor ambient, cold wind, muffled quiet, bare trees, sparse, no melody",

    # ── Tension / mystery ────────────────────────────────────────────────────
    "tense_indoor":        "Tense indoor atmosphere, low drone, subtle unease, cinematic suspense ambient, "
                           "no melody",
    "mystery_ambient":     "Mysterious ambient atmosphere, eerie and quiet, subtle texture, cinematic, no melody",
    "dark_corridor":       "Dark corridor ambient, distant hum, echo, unsettling and still, cinematic",

    # ── Warm / magical ───────────────────────────────────────────────────────
    "warm_interior":       "Warm interior ambient, gentle room tone, soft and comforting, no melody",
    "magical_ambient":     "Magical atmospheric ambient, shimmering and warm, wonder and quiet, "
                           "cinematic texture, no melody",
    "wonder_ambient":      "Ambient of wonder and discovery, soft and luminous, cinematic texture, no melody",

    # ── General fallbacks ─────────────────────────────────────────────────────
    "silence":             "Near-silence room tone, faint ambient hum, indoors, neutral and still",
    "outdoor_ambient":     "Generic outdoor ambient, light breeze, birds, natural background, no melody",
    "indoor_ambient":      "Generic indoor ambient, quiet room tone, subtle hum, no melody",
}


def label_to_prompt(label: str) -> str:
    """Return a MusicGen prompt for a label, or auto-build from snake_case."""
    if label in LABEL_PROMPTS:
        return LABEL_PROMPTS[label]
    words = label.replace("_", " ").replace("-", " ")
    return f"{words}, ambient background loop, atmospheric, no melody, cinematic texture"


def extract_ambience_labels(pagecast_text: str) -> list:
    """Extract all unique Ambience: values from pageCast scene headers."""
    pattern = re.compile(r'^Ambience:\s*(.+)$', re.IGNORECASE | re.MULTILINE)
    labels  = pattern.findall(pagecast_text)
    normalised = [lbl.strip().lower().replace(" ", "_") for lbl in labels]
    seen   = set()
    unique = []
    for lbl in normalised:
        if lbl not in seen:
            seen.add(lbl)
            unique.append(lbl)
    return unique


def wav_bytes_to_mp3(wav_bytes: bytes) -> bytes:
    """
    Convert raw WAV bytes to MP3 using lameenc.
    Parses the WAV header to extract PCM parameters.
    Returns MP3 bytes.
    """
    # Parse WAV header
    # RIFF chunk: 'RIFF' (4) + size (4) + 'WAVE' (4)
    # fmt  chunk: 'fmt ' (4) + size (4) + format (2) + channels (2) +
    #              sample_rate (4) + byte_rate (4) + block_align (2) + bits (2)
    # data chunk: 'data' (4) + size (4) + pcm data

    buf = io.BytesIO(wav_bytes)

    def read_chunk_header():
        return buf.read(4), struct.unpack('<I', buf.read(4))[0]

    # RIFF header
    riff_id, riff_size = read_chunk_header()
    if riff_id != b'RIFF':
        raise ValueError(f"Not a RIFF file: {riff_id}")
    wave_id = buf.read(4)
    if wave_id != b'WAVE':
        raise ValueError(f"Not a WAVE file: {wave_id}")

    channels    = 1
    sample_rate = 32000
    bits        = 16
    pcm_data    = b""

    while True:
        chunk_hdr = buf.read(8)
        if len(chunk_hdr) < 8:
            break
        chunk_id   = chunk_hdr[:4]
        chunk_size = struct.unpack('<I', chunk_hdr[4:])[0]

        if chunk_id == b'fmt ':
            fmt_data    = buf.read(chunk_size)
            audio_fmt   = struct.unpack_from('<H', fmt_data, 0)[0]
            channels    = struct.unpack_from('<H', fmt_data, 2)[0]
            sample_rate = struct.unpack_from('<I', fmt_data, 4)[0]
            bits        = struct.unpack_from('<H', fmt_data, 14)[0]
        elif chunk_id == b'data':
            pcm_data = buf.read(chunk_size)
        else:
            buf.seek(chunk_size, 1)  # skip unknown chunks

    if not pcm_data:
        raise ValueError("No PCM data found in WAV")

    # Encode to MP3
    encoder = lameenc.Encoder()
    encoder.set_bit_rate(128)
    encoder.set_in_sample_rate(sample_rate)
    encoder.set_channels(channels)
    encoder.set_quality(2)   # 2 = high quality

    mp3_bytes = encoder.encode(pcm_data)
    mp3_bytes += encoder.flush()
    return mp3_bytes


def call_musicgen(prompt: str, duration_seconds: int, hf_token: str | None) -> bytes | None:
    """
    Call HuggingFace MusicGen Inference API.
    Returns raw audio bytes (WAV) or None on failure.

    max_new_tokens ≈ duration_seconds × 50 for musicgen-small (32 kHz, 50 fps codec).
    """
    max_tokens = max(200, duration_seconds * 50)

    payload = json.dumps({
        "inputs":     prompt,
        "parameters": {
            "max_new_tokens": int(max_tokens),
        },
    }).encode("utf-8")

    headers = {
        "Content-Type": "application/json",
        "Accept":       "audio/wav",
    }
    if hf_token:
        headers["Authorization"] = f"Bearer {hf_token}"

    for attempt in range(1, MAX_RETRIES + 1):
        req = urllib.request.Request(HF_API_URL, data=payload, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                return resp.read()
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")

            if e.code == 503:
                # Model is loading
                try:
                    msg = json.loads(body)
                    est = msg.get("estimated_time", RETRY_DELAY)
                    wait = min(int(est) + 5, 60)
                except Exception:
                    wait = RETRY_DELAY
                print(f"     Model loading… waiting {wait}s (attempt {attempt}/{MAX_RETRIES})")
                time.sleep(wait)
                continue

            elif e.code == 429:
                print(f"     Rate limited — waiting 60s (attempt {attempt}/{MAX_RETRIES})")
                time.sleep(60)
                continue

            elif e.code == 401:
                print(f"     ❌  401 Unauthorized — check your HuggingFace token")
                return None

            else:
                print(f"     ❌  HTTP {e.code}: {body[:300]}")
                return None

        except Exception as e:
            print(f"     ❌  Request error: {e}")
            if attempt < MAX_RETRIES:
                print(f"     Retrying in 10s…")
                time.sleep(10)
            continue

    print(f"     ❌  Failed after {MAX_RETRIES} attempts")
    return None


def process_folder(pagecast_files: list, ambience_dir: Path,
                   hf_token: str | None, duration: int) -> dict:
    """Collect all unique ambience labels, generate missing ones."""
    all_labels = []
    seen = set()
    for pf in pagecast_files:
        text = pf.read_text(encoding="utf-8")
        for lbl in extract_ambience_labels(text):
            if lbl not in seen:
                seen.add(lbl)
                all_labels.append(lbl)

    if not all_labels:
        print("  No Ambience: tags found in any pageCast file.")
        return {"found": 0, "generated": 0, "skipped": 0, "failed": []}

    print(f"  Found {len(all_labels)} unique ambience label(s) across all chapters\n")
    ambience_dir.mkdir(parents=True, exist_ok=True)

    generated = 0
    skipped   = 0
    failed    = []

    for i, label in enumerate(all_labels, 1):
        dest = ambience_dir / f"{label}.mp3"
        if dest.exists():
            print(f"  [{i}/{len(all_labels)}] ✓  {label}.mp3 (exists — skipped)")
            skipped += 1
            continue

        prompt = label_to_prompt(label)
        print(f"  [{i}/{len(all_labels)}] ↳  [{label}]")
        print(f"     prompt   : \"{prompt[:90]}{'…' if len(prompt)>90 else ''}\"")
        print(f"     duration : ~{duration}s")
        print(f"     generating…", end=" ", flush=True)

        wav_bytes = call_musicgen(prompt, duration, hf_token)

        if wav_bytes:
            try:
                mp3_bytes = wav_bytes_to_mp3(wav_bytes)
                dest.write_bytes(mp3_bytes)
                size_kb = round(len(mp3_bytes) / 1024, 1)
                print(f"✅  saved ({size_kb} KB) → ambience/{label}.mp3")
                generated += 1
                time.sleep(RATE_DELAY)  # polite pause between calls
            except Exception as e:
                # If WAV conversion fails, save raw bytes and warn
                print(f"\n     WAV→MP3 conversion failed ({e}), saving raw WAV…")
                wav_dest = ambience_dir / f"{label}.wav"
                wav_dest.write_bytes(wav_bytes)
                print(f"     Saved as {label}.wav — rename manually or convert with ffmpeg")
                failed.append(label)
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
        description="pageCast Ambience Generator — HuggingFace MusicGen (free, no key needed)"
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--pagecast", help="Path to a single pageCast .txt file")
    group.add_argument("--folder",   help="Path to a .casts/<book>/ folder (processes all chapters)")
    parser.add_argument(
        "--hf-token",
        default=os.environ.get("HF_TOKEN", ""),
        help="HuggingFace API token for higher rate limits (optional). "
             "Free at: https://huggingface.co/settings/tokens",
    )
    parser.add_argument(
        "--duration",
        type=int,
        default=22,
        help="Approx. generation length in seconds per clip (default: 22). "
             "Range: 10–30. Longer = slower generation.",
    )
    parser.add_argument("--ambience-dir", help="Output folder (default: <folder>/ambience/)")
    args = parser.parse_args()

    hf_token = args.hf_token or None

    if args.pagecast:
        pagecast_files = [Path(args.pagecast)]
        base_dir = Path(args.pagecast).parent
    else:
        base_dir = Path(args.folder)
        pagecast_files = sorted(base_dir.glob("*_pagecast.txt"))
        if not pagecast_files:
            print(f"❌  No *_pagecast.txt files found in: {base_dir}")
            sys.exit(1)

    ambience_dir = Path(args.ambience_dir) if args.ambience_dir else base_dir / "ambience"

    print(f"\n🎼  pageCast Ambience Generator  (HuggingFace MusicGen — free)")
    print(f"    Model       : facebook/musicgen-small")
    print(f"    Book folder : {base_dir.name}")
    print(f"    Chapters    : {len(pagecast_files)}")
    print(f"    Duration    : ~{args.duration}s per clip")
    print(f"    Auth        : {'HF token provided' if hf_token else 'anonymous (rate-limited)'}")
    print(f"    Output      : {ambience_dir}")
    print()
    if not hf_token:
        print("  💡 Tip: Get a free HuggingFace token at https://huggingface.co/settings/tokens")
        print("     and pass --hf-token YOUR_TOKEN for higher rate limits.\n")

    result = process_folder(pagecast_files, ambience_dir, hf_token, args.duration)

    folder_size = sum(f.stat().st_size for f in ambience_dir.glob("*.mp3")) if ambience_dir.exists() else 0
    size_mb = round(folder_size / 1_048_576, 1)

    print(f"\n{'─'*55}")
    print(f"✅  Done!")
    print(f"   Labels found  : {result['found']}")
    print(f"   Generated     : {result['generated']}")
    print(f"   Already existed: {result['skipped']}")
    print(f"   Folder size   : {size_mb} MB")
    if result["failed"]:
        print(f"\n   ❌  Failed ({len(result['failed'])}): {', '.join(result['failed'])}")
        print(f"   Tip: Re-run to retry (HF sometimes rate-limits — it recovers).")
        print(f"   Or add a custom prompt to LABEL_PROMPTS in this file.")
    print(f"\n   Ambience folder: {ambience_dir}")
    if result["generated"] > 0:
        print(f"\n   Each clip is ~{args.duration}s. The Beat player loops them automatically.")


if __name__ == "__main__":
    main()
