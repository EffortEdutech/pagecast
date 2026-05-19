#!/usr/bin/env python3
"""
pageCast SFX Producer
Extracts [SFX: label] tags from pageCast files and downloads matching audio
from Freesound.org into an /sfx/ folder ready for the Beat.

Usage:
  python fetch_sfx.py --pagecast path/to/file.txt --api-key YOUR_KEY
  python fetch_sfx.py --folder path/to/.casts/bookname/ --api-key YOUR_KEY
"""

import argparse
import os
import re
import sys
import time
import json
import urllib.request
import urllib.parse
from pathlib import Path

# ── Known label → better search query mapping ────────────────────────────────
LABEL_QUERIES = {
    "freeze_whoosh":      "whoosh time freeze sci-fi",
    "city_noise_resume":  "city street ambient urban",
    "dog_bark":           "dog bark single short",
    "crash_bollard":      "metal crash impact bollard",
    "tyre_screech":       "tyre skid screech car brake",
    "metal_groan":        "metal creak groan structural stress",
    "books_crashing":     "books falling crash paper",
    "flour_explosion":    "powder puff burst cloud",
    "clang":              "metal clang impact single",
    "scream_distant":     "scream distant faint female",
    "crash_clatter":      "crash clatter object fall",
    "crash_large":        "large crash impact heavy",
    "items_clattering":   "items small objects clattering falling",
    "trolley_wobble":     "shopping cart wheel metal wobble",
    "paper_unfold":       "paper unfold crinkle",
    "library_ambience":   "library quiet ambient indoor",
    "vibration_low":      "low rumble vibration ground",
    "construction_noise": "construction site ambient tools",
    "car_engine":         "car engine pass close",
    "city_noise":         "city street crowd ambient noise",
    "clock_tick":         "clock tick single",
    "distant_commotion":  "crowd commotion distant noise",
    "park_ambience":      "park outdoor nature birds ambient",
}

FREESOUND_SEARCH = "https://freesound.org/apiv2/search/text/"
RATE_LIMIT_DELAY = 0.5   # seconds between API calls


def label_to_query(label: str) -> str:
    """Convert a snake_case SFX label to a Freesound search query."""
    if label in LABEL_QUERIES:
        return LABEL_QUERIES[label]
    words = label.replace("_", " ").replace("-", " ")
    return words


def extract_sfx_labels(pagecast_text: str) -> list:
    """Extract all unique [SFX: label] tags from a pageCast file."""
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


def search_freesound(query: str, api_key: str, max_duration: int = 12):
    """Search Freesound and return the best matching sound's metadata."""
    params = urllib.parse.urlencode({
        "query": query,
        "fields": "id,name,duration,previews,username,tags",
        "filter": f"duration:[0 TO {max_duration}]",
        "sort": "score",
        "page_size": 5,
        "token": api_key,
    })
    url = f"{FREESOUND_SEARCH}?{params}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "pageCast-sfx-producer/1.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
            results = data.get("results", [])
            if results:
                return results[0]
    except Exception as e:
        print(f"    ⚠  Search failed for '{query}': {e}")
    return None


def download_preview(sound: dict, dest_path: Path) -> bool:
    """Download the HQ preview MP3 for a Freesound result."""
    previews = sound.get("previews", {})
    url = previews.get("preview-hq-mp3") or previews.get("preview-lq-mp3")
    if not url:
        return False
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "pageCast-sfx-producer/1.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            dest_path.write_bytes(resp.read())
        return True
    except Exception as e:
        print(f"    ⚠  Download failed: {e}")
        return False


def process_pagecast_file(pagecast_path: Path, sfx_dir: Path, api_key: str) -> dict:
    """Process one pageCast file: extract labels, fetch, save."""
    text = pagecast_path.read_text(encoding="utf-8")
    labels = extract_sfx_labels(text)

    if not labels:
        print(f"  No SFX tags found in {pagecast_path.name}")
        return {"found": 0, "downloaded": 0, "skipped": 0, "failed": []}

    print(f"\n  {pagecast_path.name} — {len(labels)} unique SFX label(s)")
    sfx_dir.mkdir(parents=True, exist_ok=True)

    downloaded = 0
    skipped = 0
    failed = []

    for label in labels:
        dest = sfx_dir / f"{label}.mp3"
        if dest.exists():
            print(f"    ✓  {label}.mp3 (already exists — skipped)")
            skipped += 1
            continue

        query = label_to_query(label)
        print(f"    ↳  [{label}] searching: \"{query}\"")
        time.sleep(RATE_LIMIT_DELAY)

        sound = search_freesound(query, api_key)
        if not sound:
            fallback = label.replace("_", " ")
            print(f"       retrying with: \"{fallback}\"")
            time.sleep(RATE_LIMIT_DELAY)
            sound = search_freesound(fallback, api_key)

        if sound:
            name = sound.get("name", "unknown")
            dur = round(sound.get("duration", 0), 1)
            print(f"       found: \"{name}\" ({dur}s) — downloading…")
            if download_preview(sound, dest):
                print(f"       ✅  saved → sfx/{label}.mp3")
                downloaded += 1
            else:
                print(f"       ❌  download failed")
                failed.append(label)
        else:
            print(f"       ❌  no result found")
            failed.append(label)

    return {"found": len(labels), "downloaded": downloaded, "skipped": skipped, "failed": failed}


def main():
    parser = argparse.ArgumentParser(description="pageCast SFX Producer")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--pagecast", help="Path to a single pageCast .txt file")
    group.add_argument("--folder", help="Path to a .casts/<book>/ folder")
    parser.add_argument("--api-key", required=True, help="Freesound.org API token")
    parser.add_argument("--sfx-dir", help="Output folder for SFX files (default: <folder>/sfx/)")
    args = parser.parse_args()

    api_key = args.api_key or os.environ.get("FREESOUND_API_KEY")
    if not api_key:
        print("❌  No API key provided. Set --api-key or FREESOUND_API_KEY environment variable.")
        print("    Get a free key at: https://freesound.org/apiv2/apply")
        sys.exit(1)

    if args.pagecast:
        pagecast_files = [Path(args.pagecast)]
        base_dir = Path(args.pagecast).parent
    else:
        base_dir = Path(args.folder)
        pagecast_files = sorted(base_dir.glob("*_pagecast.txt"))
        if not pagecast_files:
            print(f"❌  No *_pagecast.txt files found in {base_dir}")
            sys.exit(1)

    sfx_dir = Path(args.sfx_dir) if args.sfx_dir else base_dir / "sfx"

    print(f"\n🎵  pageCast SFX Producer")
    print(f"    Processing {len(pagecast_files)} file(s)")
    print(f"    Output → {sfx_dir}\n")

    total_found = total_downloaded = total_skipped = 0
    all_failed = []

    for pf in pagecast_files:
        result = process_pagecast_file(pf, sfx_dir, api_key)
        total_found += result["found"]
        total_downloaded += result["downloaded"]
        total_skipped += result["skipped"]
        all_failed.extend(result["failed"])

    print(f"\n{'─'*50}")
    print(f"✅  Done!")
    print(f"   Labels found    : {total_found}")
    print(f"   Downloaded      : {total_downloaded}")
    print(f"   Already existed : {total_skipped}")
    if all_failed:
        print(f"   Failed ({len(all_failed)}): {', '.join(all_failed)}")
        print(f"\n   Tip: For failed labels, try searching https://freesound.org manually")
        print(f"   and save the MP3 as sfx/<label>.mp3")
    print(f"\n   SFX folder: {sfx_dir}")


if __name__ == "__main__":
    main()
