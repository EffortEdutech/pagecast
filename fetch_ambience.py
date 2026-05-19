#!/usr/bin/env python3
"""
pageCast Ambience Producer
Extracts Ambience: tags from pageCast scene headers and downloads loopable
ambient audio from Freesound.org into an /ambience/ folder for the Beat.

Usage:
  python fetch_ambience.py --pagecast path/to/file.txt --api-key YOUR_KEY
  python fetch_ambience.py --folder path/to/.casts/bookname/ --api-key YOUR_KEY
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

# ── Known label → ambient-optimised search query ─────────────────────────────
LABEL_QUERIES = {
    "school_canteen":       "school cafeteria canteen ambient background noise",
    "school_canteen_quiet": "school cafeteria quiet ambient background",
    "city_morning":         "city morning urban birds ambient background",
    "city_morning_quiet":   "city morning quiet urban ambient",
    "city_street":          "city street pedestrians urban ambient",
    "city_street_busy":     "busy city street market crowd ambient noise",
    "city_street_quiet":    "city street quiet urban ambient background",
    "city_evening":         "city evening urban ambient background",
    "city_ambience_quiet":  "city quiet urban background ambient",
    "city_traffic":         "city traffic road ambient loop",
    "park_afternoon":       "park outdoor nature birds afternoon ambient",
    "park_morning":         "park outdoor birds morning ambient",
    "indoor_cosy":          "indoor cosy room quiet ambient",
    "indoor_quiet":         "indoor quiet room ambient hum",
    "school_library":       "library quiet indoor ambient background",
    "school_classroom":     "classroom school indoor ambient quiet",
    "school_exterior":      "school playground outdoor ambient",
    "supermarket_exterior": "outdoor car park shopping ambient",
    "city_night":           "city night urban ambient crickets",
    "construction_site":    "construction site outdoor ambient tools",
    "park_evening":         "park evening outdoor ambient birds",
    "silence":              "room tone indoor silence ambient",
}

FREESOUND_SEARCH = "https://freesound.org/apiv2/search/text/"
RATE_LIMIT_DELAY = 0.5
MIN_DURATION = 20    # seconds — want something loopable
MAX_DURATION = 180   # seconds


def label_to_query(label: str) -> str:
    if label in LABEL_QUERIES:
        return LABEL_QUERIES[label]
    words = label.replace("_", " ").replace("-", " ")
    return f"{words} ambient background"


def extract_ambience_labels(pagecast_text: str) -> list:
    """Extract all unique Ambience: labels from scene headers."""
    pattern = re.compile(r'^Ambience:\s*(.+)$', re.IGNORECASE | re.MULTILINE)
    labels = pattern.findall(pagecast_text)
    normalised = [lbl.strip().lower().replace(" ", "_") for lbl in labels]
    seen = set()
    unique = []
    for lbl in normalised:
        if lbl not in seen:
            seen.add(lbl)
            unique.append(lbl)
    return unique


def search_freesound(query: str, api_key: str, min_dur: int = MIN_DURATION, max_dur: int = MAX_DURATION):
    """Search Freesound for a loopable ambient clip."""
    params = urllib.parse.urlencode({
        "query": query,
        "fields": "id,name,duration,previews,username,tags",
        "filter": f"duration:[{min_dur} TO {max_dur}]",
        "sort": "score",
        "page_size": 5,
        "token": api_key,
    })
    url = f"{FREESOUND_SEARCH}?{params}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "pageCast-ambience-producer/1.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
            results = data.get("results", [])
            if results:
                return results[0]
    except Exception as e:
        print(f"    ⚠  Search failed for '{query}': {e}")
    return None


def download_preview(sound: dict, dest_path: Path) -> bool:
    """Download HQ preview MP3."""
    previews = sound.get("previews", {})
    url = previews.get("preview-hq-mp3") or previews.get("preview-lq-mp3")
    if not url:
        return False
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "pageCast-ambience-producer/1.0"})
        with urllib.request.urlopen(req, timeout=60) as resp:
            dest_path.write_bytes(resp.read())
        return True
    except Exception as e:
        print(f"    ⚠  Download failed: {e}")
        return False


def process_pagecast_file(pagecast_path: Path, ambience_dir: Path, api_key: str, already_done: set) -> dict:
    """Extract ambience labels from one file and fetch missing ones."""
    text = pagecast_path.read_text(encoding="utf-8")
    labels = extract_ambience_labels(text)

    if not labels:
        print(f"  No Ambience tags found in {pagecast_path.name}")
        return {"found": 0, "downloaded": 0, "skipped": 0, "failed": []}

    print(f"\n  {pagecast_path.name} — {len(labels)} unique ambience label(s)")
    ambience_dir.mkdir(parents=True, exist_ok=True)

    downloaded = 0
    skipped = 0
    failed = []

    for label in labels:
        dest = ambience_dir / f"{label}.mp3"
        if dest.exists() or label in already_done:
            print(f"    ✓  {label}.mp3 (already exists — skipped)")
            skipped += 1
            continue

        query = label_to_query(label)
        print(f"    ↳  [{label}] searching: \"{query}\"")
        time.sleep(RATE_LIMIT_DELAY)

        sound = search_freesound(query, api_key)
        if not sound:
            fallback = label.replace("_", " ") + " ambient"
            print(f"       retrying with: \"{fallback}\" (any length)")
            time.sleep(RATE_LIMIT_DELAY)
            sound = search_freesound(fallback, api_key, min_dur=5, max_dur=300)

        if sound:
            name = sound.get("name", "unknown")
            dur = round(sound.get("duration", 0), 1)
            print(f"       found: \"{name}\" ({dur}s) — downloading…")
            if download_preview(sound, dest):
                print(f"       ✅  saved → ambience/{label}.mp3")
                downloaded += 1
                already_done.add(label)
            else:
                print(f"       ❌  download failed")
                failed.append(label)
        else:
            print(f"       ❌  no result found")
            failed.append(label)

    return {"found": len(labels), "downloaded": downloaded, "skipped": skipped, "failed": failed}


def main():
    parser = argparse.ArgumentParser(description="pageCast Ambience Producer")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--pagecast", help="Path to a single pageCast .txt file")
    group.add_argument("--folder", help="Path to a .casts/<book>/ folder")
    parser.add_argument("--api-key", help="Freesound.org API token")
    parser.add_argument("--ambience-dir", help="Output folder (default: <folder>/ambience/)")
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

    ambience_dir = Path(args.ambience_dir) if args.ambience_dir else base_dir / "ambience"

    print(f"\n🌆  pageCast Ambience Producer")
    print(f"    Processing {len(pagecast_files)} file(s)")
    print(f"    Output → {ambience_dir}\n")

    total_found = total_downloaded = total_skipped = 0
    all_failed = []
    already_done = set()

    for pf in pagecast_files:
        result = process_pagecast_file(pf, ambience_dir, api_key, already_done)
        total_found += result["found"]
        total_downloaded += result["downloaded"]
        total_skipped += result["skipped"]
        all_failed.extend(result["failed"])

    folder_size = sum(f.stat().st_size for f in ambience_dir.glob("*.mp3")) if ambience_dir.exists() else 0
    size_mb = round(folder_size / 1_048_576, 1)

    print(f"\n{'─'*50}")
    print(f"✅  Done!")
    print(f"   Labels found    : {total_found}")
    print(f"   Downloaded      : {total_downloaded}")
    print(f"   Already existed : {total_skipped}")
    print(f"   Folder size     : {size_mb} MB")
    if all_failed:
        print(f"   Failed ({len(all_failed)}): {', '.join(all_failed)}")
        print(f"\n   Tip: For failed labels, search https://freesound.org manually")
        print(f"   and save the MP3 as ambience/<label>.mp3")
    print(f"\n   Ambience folder: {ambience_dir}")


if __name__ == "__main__":
    main()
