#!/usr/bin/env python3
"""
voice_producer.py - pageCast Voice Production Script
=====================================================
Reads voice assignments directly from Supabase (set in Creator Studio /voices),
generates MP3 audio for every voiceable block in a book, uploads each file to
Supabase Storage, and writes the public audio_url back to the blocks table.

ALL audio is output as MP3 regardless of provider (Gemini or ElevenLabs).

Re-run the same command at any time - already-completed blocks are skipped.
Failed blocks are retried on the next run.

Usage
-----
  python skills/voice_producer.py --book "The Last Firefly" --gemini-key YOUR_KEY
  python skills/voice_producer.py --book "Algoritma Tuhan" --elevenlabs-key YOUR_KEY
  python skills/voice_producer.py --book "GLITCH" --chapter 2 --gemini-key YOUR_KEY
  python skills/voice_producer.py --book "GLITCH" --chapter 2 --scene 3 --gemini-key YOUR_KEY
  python skills/voice_producer.py --book "The Last Firefly" --dry-run
  python skills/voice_producer.py --book "The Last Firefly" --gemini-key YOUR_KEY --skip-upload

Environment variable shortcuts:
  GEMINI_API_KEY, ELEVENLABS_API_KEY
"""

import argparse
import base64
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

# ── Sliding-window rate limiter ───────────────────────────────────────────────

from collections import deque as _deque

class RateLimiter:
    """Sliding-window rate limiter.
    Call .wait() before each API request — it sleeps only as long as needed
    to stay within max_per_minute requests over the last 60 seconds.
    """
    def __init__(self, max_per_minute: int):
        self._max   = max_per_minute
        self._times = _deque()          # timestamps of recent requests

    def wait(self, label: str = ""):
        now = time.time()
        # Drop timestamps older than 60 s
        while self._times and now - self._times[0] >= 60.0:
            self._times.popleft()
        # If at capacity, block until the oldest slot expires
        if len(self._times) >= self._max:
            wait_until = self._times[0] + 60.0
            sleep_for  = wait_until - time.time()
            if sleep_for > 0:
                mins, secs = divmod(int(sleep_for) + 1, 60)
                tag = (" (" + label + ")") if label else ""
                print(
                    f"\n  [rate limit{tag}: waiting {mins}m {secs:02d}s"
                    f" — max {self._max} RPM] ",
                    end="", flush=True
                )
                time.sleep(sleep_for + 0.5)   # tiny extra margin
        self._times.append(time.time())


# ── Ensure lameenc is available (pure-Python MP3 encoder, no ffmpeg needed) ──
try:
    import lameenc
except ImportError:
    print("Installing lameenc (MP3 encoder)...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "lameenc", "--quiet",
                           "--break-system-packages"])
    import lameenc

# ── Supabase config (auto-loaded from .env.local) ────────────────────────────
_ENV_PATH = Path(__file__).parent.parent / "apps" / "creator-studio" / ".env.local"

def _load_env():
    env = {}
    if _ENV_PATH.exists():
        for line in _ENV_PATH.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                env[k.strip()] = v.strip()
    return env

_env = _load_env()
SUPABASE_URL         = _env.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = _env.get("SUPABASE_SERVICE_ROLE_KEY", "")
STORAGE_BUCKET       = "assets"

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("ERROR: Could not load Supabase credentials from apps/creator-studio/.env.local")
    print("  Make sure you are running this from the pageCast root folder.")
    sys.exit(1)

# ── Voice mappings (mirrors voiceLibrary.ts) ──────────────────────────────────

AI_TO_GEMINI = {
    "ai_narrator_warm":  "Sulafat",
    "ai_narrator_deep":  "Charon",
    "ai_female_soft":    "Aoede",
    "ai_female_warm":    "Callirrhoe",
    "ai_female_bright":  "Leda",
    "ai_male_deep":      "Orus",
    "ai_male_calm":      "Puck",
    "ai_male_gruff":     "Fenrir",
    "ai_child_female":   "Zephyr",
    "ai_child_male":     "Umbriel",
    "ai_elder_female":   "Gacrux",
    "ai_elder_male":     "Algenib",
    "ai_villain":        "Achernar",
    "ai_whisper":        "Despina",
    "ai_dramatic":       "Rasalghul",
    "ai_cartoon":        "Kore",
    "ai_robot":          "Iapetus",
    "ai_fantasy":        "Schedar",
}

ELEVENLABS_FALLBACK = {
    "ai_narrator_warm": "21m00Tcm4TlvDq8ikWAM",
    "ai_narrator_deep": "JBFqnCBsd6RMkjVDRZzb",
    "ai_female_soft":   "EXAVITQu4vr4xnSDxMaL",
    "ai_female_warm":   "XB0fDUnXU5powFXDhCwa",
    "ai_female_bright": "XrExE9yKIg1WjnnlVkGX",
    "ai_male_deep":     "VR6AewLTigWG4xSOukaG",
    "ai_male_calm":     "ErXwobaYiN019PkySvjV",
    "ai_male_gruff":    "2EiwWnXFnvU5JabPnv8n",
    "ai_child_female":  "MF3mGyEYCl7XYWbV9V6O",
    "ai_child_male":    "yoZ06aMxZJJ28mfd3POQ",
    "ai_elder_female":  "ThT5KcBeYPX3keUQqHPh",
    "ai_elder_male":    "GBv7mTt0atIp3Br8iCZE",
    "ai_villain":       "N2lVS1w4EtoT3dr4eOWO",
    "ai_whisper":       "oWAxZDx7w5VEj9dCyTzz",
    "ai_dramatic":      "IKne3meq5aSn9XLyUdCD",
    "ai_cartoon":       "jBpfuIE2acCO8z3wKNLl",
    "ai_robot":         "TX3LPaxmHKxFdv7VOQHJ",
    "ai_fantasy":       "jsCqWAovK2LkecY7zXl4",
}

VOICE_TYPES = {"narration", "dialogue", "thought", "quote"}

# ── Supabase REST helpers ─────────────────────────────────────────────────────

def _svc_headers():
    return {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": "Bearer " + SUPABASE_SERVICE_KEY,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

def sb_get(table, params):
    url = SUPABASE_URL + "/rest/v1/" + table + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=_svc_headers())
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read())

def sb_patch(table, block_id, data):
    url = SUPABASE_URL + "/rest/v1/" + table + "?id=eq." + block_id
    body = json.dumps(data).encode()
    hdrs = dict(_svc_headers())
    hdrs["Prefer"] = "return=minimal"
    req = urllib.request.Request(url, data=body, method="PATCH", headers=hdrs)
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status < 300
    except Exception as e:
        print("    [warn: DB patch failed: " + str(e) + "]", end="")
        return False

def sb_upload(path, audio, content_type):
    url = SUPABASE_URL + "/storage/v1/object/" + STORAGE_BUCKET + "/" + path
    req = urllib.request.Request(url, data=audio, method="POST", headers={
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": "Bearer " + SUPABASE_SERVICE_KEY,
        "Content-Type": content_type,
        "x-upsert": "true",
    })
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status in (200, 201)
    except urllib.error.HTTPError as e:
        print("    [warn: storage " + str(e.code) + ": " + e.read().decode()[:100] + "]", end="")
        return False

def public_url(path):
    return (SUPABASE_URL + "/storage/v1/object/public/" + STORAGE_BUCKET
            + "/" + path + "?v=" + str(int(time.time())))

# ── MP3 helpers ───────────────────────────────────────────────────────────────

def pcm_to_mp3(pcm, sample_rate=24000, channels=1, bitrate=128):
    """Convert raw PCM bytes (Gemini output) to MP3 using lameenc."""
    enc = lameenc.Encoder()
    enc.set_bit_rate(bitrate)
    enc.set_in_sample_rate(sample_rate)
    enc.set_channels(channels)
    enc.set_quality(2)  # 2 = highest
    return enc.encode(pcm) + enc.flush()

# ── Voice resolution ──────────────────────────────────────────────────────────

def detect_provider(voice_id):
    if not voice_id:
        return "gemini"
    if voice_id.startswith("gemini:"):
        return "gemini"
    if voice_id.startswith("elevenlabs:"):
        return "elevenlabs"
    return "gemini"  # ai_* tokens default to Gemini

def resolve_gemini_voice(voice_id):
    if voice_id and voice_id.startswith("gemini:"):
        return voice_id[7:]
    return AI_TO_GEMINI.get(voice_id, "Sulafat")

def resolve_elevenlabs_voice(voice_id):
    if voice_id and voice_id.startswith("elevenlabs:"):
        return voice_id[11:]
    return ELEVENLABS_FALLBACK.get(voice_id, "21m00Tcm4TlvDq8ikWAM")

# ── TTS generators ────────────────────────────────────────────────────────────

def _build_gemini_prompt(text, block_type, emotion, voice_name, voice_label, char_name):
    char = char_name or "Character"
    casting = voice_label or ("Voice: " + voice_name)
    lines = [
        "Synthesize speech for PageCast. Speak only the transcript, not these directions.",
        "# AUDIO PROFILE: " + char,
        casting,
        "Block type: " + (block_type or "narration") + ".",
    ]
    if emotion and emotion not in ("neutral", ""):
        lines.append("Emotion: " + emotion + ". Let it affect tone, emphasis, and pacing naturally.")
    lines += [
        "Pacing: natural story dialogue pace.",
        "Director notes: keep the voice consistent, expressive, and age-appropriate. "
        "Do not read punctuation labels or stage directions aloud.",
        "# TRANSCRIPT",
        text.strip(),
    ]
    return "\n".join(lines)

def generate_gemini(text, voice_id, voice_label, block_type, emotion, char_name, api_key,
                    model="gemini-2.5-flash-preview-tts"):
    voice_name = resolve_gemini_voice(voice_id)
    prompt = _build_gemini_prompt(text, block_type, emotion, voice_name, voice_label, char_name)
    payload = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {
                "voiceConfig": {
                    "prebuiltVoiceConfig": {"voiceName": voice_name}
                }
            }
        },
        "model": model,
    }).encode()
    url = ("https://generativelanguage.googleapis.com/v1beta"
           "/models/" + model + ":generateContent")
    req = urllib.request.Request(url, data=payload, method="POST", headers={
        "x-goog-api-key": api_key,
        "Content-Type": "application/json",
    })
    with urllib.request.urlopen(req, timeout=90) as r:
        data = json.loads(r.read())
    parts = (data.get("candidates") or [{}])[0].get("content", {}).get("parts", [])
    b64 = None
    for part in parts:
        inline = part.get("inlineData") or part.get("inline_data")
        if inline:
            b64 = inline.get("data")
            break
    if not b64:
        raise ValueError("Gemini returned no audio — try again")
    # Convert PCM -> MP3 (standard format)
    return pcm_to_mp3(base64.b64decode(b64))

def generate_elevenlabs(text, voice_id, block_type, emotion, api_key):
    el_id = resolve_elevenlabs_voice(voice_id)
    stability = 0.44 if block_type == "dialogue" else (0.55 if block_type == "thought" else 0.52)
    style     = 0.42 if block_type == "dialogue" else (0.30 if block_type == "thought" else 0.32)
    speed     = 0.95
    if emotion in ("sad", "worried", "scared", "mysterious"):
        speed -= 0.04; stability += 0.04; style += 0.04
    elif emotion in ("angry", "excited", "surprised"):
        speed += 0.02; stability -= 0.04; style += 0.08
    elif emotion == "happy":
        speed += 0.01; style += 0.04
    payload = json.dumps({
        "text": text.strip(),
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {
            "stability":         min(max(stability, 0.25), 0.75),
            "similarity_boost":  0.8,
            "style":             min(max(style, 0), 0.65),
            "use_speaker_boost": True,
            "speed":             min(max(speed, 0.7), 1.2),
        }
    }).encode()
    req = urllib.request.Request(
        "https://api.elevenlabs.io/v1/text-to-speech/" + el_id,
        data=payload, method="POST",
        headers={
            "xi-api-key": api_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        }
    )
    with urllib.request.urlopen(req, timeout=90) as r:
        return r.read()  # already MP3

def generate_audio(text, voice_id, voice_label, block_type, emotion, char_name, api_keys):
    """Returns (mp3_bytes) or raises. All output is MP3."""
    provider = detect_provider(voice_id)
    if provider == "gemini":
        key = api_keys.get("gemini", "")
        if not key:
            raise ValueError("Gemini API key required — pass --gemini-key YOUR_KEY")
        return generate_gemini(text, voice_id, voice_label, block_type, emotion, char_name, key)
    elif provider == "elevenlabs":
        key = api_keys.get("elevenlabs", "")
        if not key:
            raise ValueError("ElevenLabs API key required — pass --elevenlabs-key YOUR_KEY")
        return generate_elevenlabs(text, voice_id, block_type, emotion, key)
    else:
        raise ValueError("Provider '" + provider + "' is not yet supported")

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="pageCast Voice Producer — generate MP3 audio from Supabase"
    )
    parser.add_argument("--book",            required=True,
                        help="Book title exactly as shown in Creator Studio")
    parser.add_argument("--chapter",         type=int, default=None,
                        help="Limit to one chapter (1-based)")
    parser.add_argument("--scene",           type=int, default=None,
                        help="Limit to one scene within the chapter (1-based)")
    parser.add_argument("--gemini-key",      default=os.environ.get("GEMINI_API_KEY", ""),
                        help="Gemini API key (or set GEMINI_API_KEY env var)")
    parser.add_argument("--elevenlabs-key",  default=os.environ.get("ELEVENLABS_API_KEY", ""),
                        help="ElevenLabs API key (or set ELEVENLABS_API_KEY env var)")
    parser.add_argument("--skip-upload",     action="store_true",
                        help="Save audio locally only, skip Supabase upload")
    parser.add_argument("--overwrite",       action="store_true",
                        help="Re-generate blocks that already have audio_url")
    parser.add_argument("--dry-run",         action="store_true",
                        help="Show what would be generated without calling APIs")
    parser.add_argument("--retries",         type=int, default=3,
                        help="Retry attempts per failed block (default: 3)")
    parser.add_argument("--gemini-rpm",      type=int, default=9,
                        help="Max Gemini requests per minute (default: 9, free tier limit is 10)")
    parser.add_argument("--out-dir",         default=None,
                        help="Local output folder (default: .casts/<slug>/voice/)")
    args = parser.parse_args()

    api_keys = {}
    if args.gemini_key:      api_keys["gemini"]     = args.gemini_key
    if args.elevenlabs_key:  api_keys["elevenlabs"] = args.elevenlabs_key

    gemini_limiter = RateLimiter(args.gemini_rpm)

    print("")
    print("pageCast Voice Producer")
    print("  Supabase : " + SUPABASE_URL)
    print("  Book     : " + args.book)
    print("  Format   : MP3 (all providers)")
    if args.gemini_key:
        print("  Gemini   : max " + str(args.gemini_rpm) + " RPM"
              + " (~" + str(round(60 / args.gemini_rpm, 1)) + "s between requests)")
    if args.dry_run:
        print("  Mode     : DRY RUN")
    elif args.skip_upload:
        print("  Mode     : LOCAL ONLY (no Supabase upload)")

    # ── 1. Find book ──────────────────────────────────────────────────────────
    books = sb_get("books", {
        "title":  "eq." + args.book,
        "select": "id,title,author_id",
    })
    if not books:
        print("")
        print("ERROR: Book '" + args.book + "' not found in Supabase.")
        print("  Check the title exactly as shown in Creator Studio (case-sensitive).")
        sys.exit(1)
    book    = books[0]
    book_id = book["id"]
    user_id = book["author_id"]
    print("  Book ID  : " + book_id[:8] + "...")

    # ── 2. Load characters ─────────────────────────────────────────────────────
    chars_raw = sb_get("characters", {
        "book_id": "eq." + book_id,
        "select":  "id,name,role,voice_id,voice_label",
        "order":   "sort_order",
    })
    chars = {c["id"]: c for c in chars_raw}
    print("  Cast     : " + ", ".join(c["name"] for c in chars_raw))
    if not chars_raw:
        print("  WARNING  : No characters found. Set voices in Creator Studio /voices first.")

    # ── 3. Load content ────────────────────────────────────────────────────────
    chapters = sb_get("chapters", {
        "book_id": "eq." + book_id,
        "select":  "id,title,sort_order",
        "order":   "sort_order",
    })
    scenes = sb_get("scenes", {
        "book_id": "eq." + book_id,
        "select":  "id,chapter_id,title,sort_order",
        "order":   "sort_order",
    })
    blocks = sb_get("blocks", {
        "book_id": "eq." + book_id,
        "select":  "id,scene_id,type,content,audio_url,sort_order",
        "order":   "sort_order",
    })

    scenes_by_ch = {}
    for sc in scenes:
        scenes_by_ch.setdefault(sc["chapter_id"], []).append(sc)

    blocks_by_sc = {}
    for b in blocks:
        blocks_by_sc.setdefault(b["scene_id"], []).append(b)

    voice_count = sum(
        1 for b in blocks
        if b["type"] in VOICE_TYPES
        and str((b.get("content") or {}).get("text", "")).strip()
    )
    print("  Blocks   : " + str(len(blocks)) + " total, " + str(voice_count) + " voiceable")

    # ── 4. Output folder ──────────────────────────────────────────────────────
    slug = re.sub(r"[^\w-]", "-", args.book.lower()).strip("-")
    slug = re.sub(r"-+", "-", slug)
    base_dir = Path(__file__).parent.parent
    out_dir  = Path(args.out_dir) if args.out_dir else base_dir / ".casts" / slug / "voice"
    out_dir.mkdir(parents=True, exist_ok=True)
    print("  Output   : " + str(out_dir))
    print("")

    # ── 5. Generate ───────────────────────────────────────────────────────────
    n_total = n_done = n_skipped = n_failed = 0
    manifest = []
    quota_stopped = False

    for ch_idx, chapter in enumerate(chapters, 1):
        if quota_stopped:
            break
        if args.chapter and ch_idx != args.chapter:
            continue
        ch_scenes = sorted(
            scenes_by_ch.get(chapter["id"], []),
            key=lambda s: s["sort_order"]
        )
        for sc_idx, scene in enumerate(ch_scenes, 1):
            if quota_stopped:
                break
            if args.scene and sc_idx != args.scene:
                continue
            sc_blocks = sorted(
                blocks_by_sc.get(scene["id"], []),
                key=lambda b: b["sort_order"]
            )
            n_voice = sum(1 for b in sc_blocks if b["type"] in VOICE_TYPES)
            print("  Ch" + str(ch_idx) + " Sc" + str(sc_idx) + " - " + scene["title"]
                  + " (" + str(n_voice) + " voice blocks)")

            for b_idx, block in enumerate(sc_blocks, 1):
                btype   = block["type"]
                content = block.get("content") or {}
                text    = str(content.get("text", "")).strip()

                if btype not in VOICE_TYPES or not text:
                    continue
                n_total += 1

                char_id    = content.get("character_id")
                char       = chars.get(str(char_id), {}) if char_id else {}
                char_name  = char.get("name", "Narrator")
                voice_id   = char.get("voice_id") or "ai_narrator_warm"
                voice_label= char.get("voice_label") or ""
                emotion    = str(content.get("emotion", "neutral"))
                block_id   = block["id"]

                fname  = (f"Ch{ch_idx:02d}_Sc{sc_idx:02d}_{b_idx:03d}"
                          f"_{btype}_{char_name.lower().replace(' ','_')}.mp3")
                fpath  = out_dir / fname
                has_url = bool(block.get("audio_url"))
                done_locally = fpath.exists()

                tick = "[done] " if has_url else "       "
                row  = f"    {tick}[{b_idx:3d}] {btype:10s} {char_name:14s} -> {fname[:45]}"
                print(row, end="", flush=True)

                if args.dry_run:
                    provider = detect_provider(voice_id)
                    vname = (resolve_gemini_voice(voice_id) if provider == "gemini"
                             else resolve_elevenlabs_voice(voice_id))
                    print("  [" + provider + ":" + vname + "]")
                    continue

                if has_url and done_locally and not args.overwrite:
                    print("  [skip]")
                    n_skipped += 1
                    manifest.append({
                        "block_id": block_id, "file": fname,
                        "audio_url": block["audio_url"], "status": "skipped"
                    })
                    continue

                # Generate with retries
                audio_bytes = None
                provider = detect_provider(voice_id)
                quota_hit = False
                for attempt in range(1, args.retries + 1):
                    try:
                        # Throttle Gemini requests to stay within RPM limit
                        if provider == "gemini":
                            gemini_limiter.wait("Gemini")
                        audio_bytes = generate_audio(
                            text, voice_id, voice_label, btype, emotion, char_name, api_keys
                        )
                        break
                    except urllib.error.HTTPError as e:
                        body = ""
                        try: body = e.read().decode()[:400]
                        except: pass
                        err = "HTTP " + str(e.code) + ": " + body

                        # 429 / 503 quota errors — stop immediately, do NOT retry
                        if e.code in (429, 503):
                            print("\n")
                            print("  !! QUOTA / RATE LIMIT HIT (HTTP " + str(e.code) + ")")
                            print("  !! " + body[:200])
                            print("")
                            print("  Stopping now to avoid further quota consumption.")
                            print("  Progress saved — re-run the same command later to resume.")
                            print("  Already-completed blocks will be skipped automatically.")
                            print("")
                            if "day" in body.lower() or "daily" in body.lower() or "quota" in body.lower():
                                print("  This looks like a DAILY quota limit.")
                                print("  Gemini free tier: 100 requests/day. Resets at midnight Pacific time.")
                            else:
                                print("  This looks like a per-minute limit.")
                                print("  Wait 60–120 seconds, then re-run.")
                            print("")
                            quota_hit = True
                            n_failed += 1
                            manifest.append({
                                "block_id": block_id, "file": fname,
                                "audio_url": None, "status": "quota_stopped", "error": err
                            })
                            break  # break retry loop

                        # Other HTTP errors — retry with backoff
                        if attempt < args.retries:
                            wait = 5 * attempt
                            print("  [retry " + str(attempt) + "/" + str(args.retries)
                                  + " in " + str(wait) + "s]", end="", flush=True)
                            time.sleep(wait)
                        else:
                            print("  FAILED: " + err)
                            n_failed += 1
                            manifest.append({
                                "block_id": block_id, "file": fname,
                                "audio_url": None, "status": "failed", "error": err
                            })
                    except Exception as e:
                        err = str(e)
                        if attempt < args.retries:
                            wait = 5 * attempt
                            print("  [retry " + str(attempt) + "/" + str(args.retries)
                                  + " in " + str(wait) + "s]", end="", flush=True)
                            time.sleep(wait)
                        else:
                            print("  FAILED: " + err)
                            n_failed += 1
                            manifest.append({
                                "block_id": block_id, "file": fname,
                                "audio_url": None, "status": "failed", "error": err
                            })

                if quota_hit:
                    quota_stopped = True
                    break  # break block loop → scene loop checks quota_stopped → chapter loop checks quota_stopped

                if audio_bytes is None:
                    continue

                # Save locally
                fpath.write_bytes(audio_bytes)

                # Upload to Supabase Storage and update DB
                audio_url = None
                if not args.skip_upload:
                    storage_path = user_id + "/" + book_id + "/" + block_id
                    if sb_upload(storage_path, audio_bytes, "audio/mpeg"):
                        audio_url = public_url(storage_path)
                        sb_patch("blocks", block_id, {"audio_url": audio_url})
                    else:
                        print("  [warn: upload failed, saved locally]", end="")

                n_done += 1
                print("  OK")
                manifest.append({
                    "block_id": block_id, "file": fname,
                    "audio_url": audio_url, "status": "ok"
                })

    # ── 6. Manifest ───────────────────────────────────────────────────────────
    manifest_path = out_dir / "manifest.json"
    manifest_path.write_text(json.dumps({
        "book": args.book,
        "book_id": book_id,
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "blocks": manifest,
    }, indent=2))

    # ── 7. Summary ────────────────────────────────────────────────────────────
    print("")
    print("  Voiceable blocks : " + str(n_total))
    print("  Generated        : " + str(n_done))
    print("  Already done     : " + str(n_skipped))
    print("  Failed           : " + str(n_failed))
    print("  Manifest         : " + str(manifest_path))
    if n_failed:
        print("")
        print("  Run the same command again to retry the " + str(n_failed) + " failed block(s).")
    if args.skip_upload or args.dry_run:
        print("")
        print("  Audio files saved to: " + str(out_dir))
    print("")


if __name__ == "__main__":
    main()
 str(args.retries)
                                  + " in " + str(wait) + "s]", end="", flush=True)
                            time.sleep(wait)
                        else:
                            print("  FAILED: " + err)
                            n_failed += 1
                            manifest.append({
                                "block_id": block_id, "file": fname,
                                "audio_url": None, "status": "failed", "error": err
                            })

                if audio_bytes is None:
                    continue

                # Save locally
                fpath.write_bytes(audio_bytes)

                # Upload to Supabase Storage and update DB
                audio_url = None
                if not args.skip_upload:
                    storage_path = user_id + "/" + book_id + "/" + block_id
                    if sb_upload(storage_path, audio_bytes, "audio/mpeg"):
                        audio_url = public_url(storage_path)
                        sb_patch("blocks", block_id, {"audio_url": audio_url})
                    else:
                        print("  [warn: upload failed, saved locally]", end="")

                n_done += 1
                print("  OK")
                manifest.append({
                    "block_id": block_id, "file": fname,
                    "audio_url": audio_url, "status": "ok"
                })

    # ── 6. Manifest ───────────────────────────────────────────────────────────
    manifest_path = out_dir / "manifest.json"
    manifest_path.write_text(json.dumps({
        "book": args.book,
        "book_id": book_id,
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "blocks": manifest,
    }, indent=2))

    # ── 7. Summary ────────────────────────────────────────────────────────────
    print("")
    print("  Voiceable blocks : " + str(n_total))
    print("  Generated        : " + str(n_done))
    print("  Already done     : " + str(n_skipped))
    print("  Failed           : " + str(n_failed))
    print("  Manifest         : " + str(manifest_path))
    if n_failed:
        print("")
        print("  Run the same command again to retry the " + str(n_failed) + " failed block(s).")
    if args.skip_upload or args.dry_run:
        print("")
        print("  Audio files saved to: " + str(out_dir))
    print("")


if __name__ == "__main__":
    main()
