#!/usr/bin/env python3
"""
sync_supabase_voices.py - download existing PageCast voice audio from Supabase.

This does not generate new TTS. By default it is audit-only: it reads
books/chapters/scenes/blocks from Supabase and reports audio_url coverage.
Use --download explicitly if you really want local MP3 copies.

Usage:
  python skills/sync_supabase_voices.py --list-books
  python skills/sync_supabase_voices.py --book "The Boy With the Grey Pebble"
  python skills/sync_supabase_voices.py --book "The Boy With the Grey Pebble" --download
  python skills/sync_supabase_voices.py --book "GLITCH" --chapter 2 --dry-run
"""

import argparse
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ENV_PATH = Path(__file__).parent.parent / "apps" / "creator-studio" / ".env.local"
STORAGE_BUCKET = "assets"
VOICE_TYPES = {"narration", "dialogue", "thought", "quote"}


def load_env():
    env = {}
    if ENV_PATH.exists():
        for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                env[k.strip()] = v.strip()
    return env


ENV = load_env()
SUPABASE_URL = ENV.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = ENV.get("SUPABASE_SERVICE_ROLE_KEY", "")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("ERROR: Could not load Supabase credentials from apps/creator-studio/.env.local")
    sys.exit(1)


def svc_headers():
    return {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": "Bearer " + SUPABASE_SERVICE_KEY,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def sb_get(table, params):
    url = SUPABASE_URL + "/rest/v1/" + table + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=svc_headers())
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def slugify(title):
    slug = re.sub(r"[^\w-]", "-", title.lower()).strip("-")
    return re.sub(r"-+", "-", slug)


def safe_speaker(name):
    return re.sub(r"[^a-z0-9_]+", "", name.lower().replace(" ", "_")) or "narrator"


def download(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": "pageCast-voice-sync/1.0"})
    with urllib.request.urlopen(req, timeout=90) as r:
        data = r.read()
    dest.write_bytes(data)
    return len(data)


def main():
    parser = argparse.ArgumentParser(description="Download generated PageCast voice audio from Supabase")
    parser.add_argument("--book", default="", help="Book title exactly as shown in Creator Studio")
    parser.add_argument("--list-books", action="store_true", help="Read-only audit of Supabase books with audio_url counts")
    parser.add_argument("--chapter", type=int, default=None, help="Limit to one chapter, 1-based")
    parser.add_argument("--scene", type=int, default=None, help="Limit to one scene within chapter, 1-based")
    parser.add_argument("--out-dir", default=None, help="Default: .casts/<slug>/voice")
    parser.add_argument("--download", action="store_true", help="Actually write audio_url MP3 files locally")
    parser.add_argument("--overwrite", action="store_true", help="Replace existing local files")
    parser.add_argument("--dry-run", action="store_true", help="Show what would download")
    args = parser.parse_args()
    audit_only = args.dry_run or not args.download

    if args.list_books:
        books = sb_get("books", {
            "select": "id,title",
            "order": "title",
        })
        print("pageCast Supabase Voice Audit")
        for book in books:
            blocks = sb_get("blocks", {
                "book_id": "eq." + book["id"],
                "select": "id,type,content,audio_url",
            })
            voiceable = 0
            with_url = 0
            for block in blocks:
                content = block.get("content") or {}
                text = str(content.get("text", "")).strip()
                if block.get("type") in VOICE_TYPES and text:
                    voiceable += 1
                    if block.get("audio_url"):
                        with_url += 1
            if voiceable or with_url:
                print(f"  {book['title']}: {with_url}/{voiceable} voice blocks have audio_url")
        return

    if not args.book:
        parser.error("--book is required unless --list-books is used")

    books = sb_get("books", {
        "title": "eq." + args.book,
        "select": "id,title,author_id",
    })
    if not books:
        print("ERROR: Book not found in Supabase: " + args.book)
        sys.exit(1)

    book = books[0]
    book_id = book["id"]
    base_dir = Path(__file__).parent.parent
    out_dir = Path(args.out_dir) if args.out_dir else base_dir / ".casts" / slugify(args.book) / "voice"
    out_dir.mkdir(parents=True, exist_ok=True)

    chars_raw = sb_get("characters", {
        "book_id": "eq." + book_id,
        "select": "id,name",
        "order": "sort_order",
    })
    chars = {c["id"]: c for c in chars_raw}

    chapters = sb_get("chapters", {
        "book_id": "eq." + book_id,
        "select": "id,title,sort_order",
        "order": "sort_order",
    })
    scenes = sb_get("scenes", {
        "book_id": "eq." + book_id,
        "select": "id,chapter_id,title,sort_order",
        "order": "sort_order",
    })
    blocks = sb_get("blocks", {
        "book_id": "eq." + book_id,
        "select": "id,scene_id,type,content,audio_url,sort_order",
        "order": "sort_order",
    })

    scenes_by_ch = {}
    for sc in scenes:
        scenes_by_ch.setdefault(sc["chapter_id"], []).append(sc)
    blocks_by_sc = {}
    for block in blocks:
        blocks_by_sc.setdefault(block["scene_id"], []).append(block)

    print("pageCast Supabase Voice Sync")
    print("  Book   : " + args.book)
    print("  Book ID: " + book_id)
    print("  Output : " + str(out_dir))
    if audit_only:
        print("  Mode   : AUDIT ONLY (use --download to write local files)")

    manifest = []
    total = with_url = downloaded = skipped = missing = failed = 0

    for ch_idx, chapter in enumerate(chapters, 1):
        if args.chapter and ch_idx != args.chapter:
            continue
        ch_scenes = sorted(scenes_by_ch.get(chapter["id"], []), key=lambda s: s["sort_order"])
        for sc_idx, scene in enumerate(ch_scenes, 1):
            if args.scene and sc_idx != args.scene:
                continue
            sc_blocks = sorted(blocks_by_sc.get(scene["id"], []), key=lambda b: b["sort_order"])
            for b_idx, block in enumerate(sc_blocks, 1):
                btype = block["type"]
                content = block.get("content") or {}
                text = str(content.get("text", "")).strip()
                if btype not in VOICE_TYPES or not text:
                    continue
                total += 1
                char_id = content.get("character_id")
                char = chars.get(str(char_id), {}) if char_id else {}
                char_name = char.get("name", "Narrator")
                fname = (
                    f"Ch{ch_idx:02d}_Sc{sc_idx:02d}_{b_idx:03d}_"
                    f"{btype}_{safe_speaker(char_name)}.mp3"
                )
                fpath = out_dir / fname
                audio_url = block.get("audio_url")
                row = {
                    "block_id": block["id"],
                    "file": fname,
                    "audio_url": audio_url,
                }
                if not audio_url:
                    missing += 1
                    row["status"] = "missing_audio_url"
                    manifest.append(row)
                    continue
                with_url += 1
                if fpath.exists() and not args.overwrite:
                    skipped += 1
                    row["status"] = "skipped_local_exists"
                    manifest.append(row)
                    continue
                if audit_only:
                    print("  WOULD DOWNLOAD " + fname)
                    row["status"] = "audit_only"
                    manifest.append(row)
                    continue
                try:
                    n = download(audio_url, fpath)
                    downloaded += 1
                    row["status"] = "downloaded"
                    row["bytes"] = n
                    print("  OK " + fname + " (" + str(round(n / 1024)) + " KB)")
                except Exception as exc:
                    failed += 1
                    row["status"] = "failed"
                    row["error"] = str(exc)
                    print("  FAILED " + fname + ": " + str(exc))
                manifest.append(row)

    manifest_path = out_dir / "manifest.json"
    if not audit_only:
        manifest_path.write_text(json.dumps({
            "book": args.book,
            "book_id": book_id,
            "synced_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "blocks": manifest,
        }, indent=2), encoding="utf-8")

    print("")
    print("  Voiceable blocks : " + str(total))
    print("  With audio_url   : " + str(with_url))
    print("  Downloaded       : " + str(downloaded))
    print("  Local skipped    : " + str(skipped))
    print("  Missing audio_url: " + str(missing))
    print("  Failed           : " + str(failed))
    print("  Manifest         : " + str(manifest_path))


if __name__ == "__main__":
    main()
