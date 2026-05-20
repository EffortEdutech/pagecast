#!/usr/bin/env python3
"""
pageCast Voice Producer
Generates TTS audio for every narration, dialogue, and thought block
in a pageCast story. Supports ElevenLabs and Gemini TTS providers.
Uses the exact same voice IDs, casting notes, and emotion settings as the Beat.

Usage — generate voices:
  python generate_voices.py --folder ".casts/algoritma-tuhan/" --config ".casts/algoritma-tuhan/voice_config.json"
  python generate_voices.py --pagecast "file_pagecast.txt" --config "voice_config.json"
  python generate_voices.py --folder ".casts/glitch/" --scene 3   (one scene only)

Usage — create config template first:
  python generate_voices.py --folder ".casts/algoritma-tuhan/" --setup
"""

import argparse
import base64
import json
import re
import struct
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

# ── pageCast ai_ voice → ElevenLabs fallback voice IDs ───────────────────────
# These mirror ELEVENLABS_FALLBACK_VOICES in src/lib/voiceLibrary.ts
ELEVENLABS_FALLBACK = {
    'ai_narrator_warm': ('21m00Tcm4TlvDq8ikWAM', 'Rachel'),
    'ai_narrator_deep': ('JBFqnCBsd6RMkjVDRZzb', 'George'),
    'ai_female_soft':   ('EXAVITQu4vr4xnSDxMaL', 'Sarah'),
    'ai_female_warm':   ('XB0fDUnXU5powFXDhCwa', 'Charlotte'),
    'ai_female_bright': ('XrExE9yKIg1WjnnlVkGX', 'Matilda'),
    'ai_male_deep':     ('VR6AewLTigWG4xSOukaG', 'Arnold'),
    'ai_male_calm':     ('ErXwobaYiN019PkySvjV', 'Antoni'),
    'ai_male_gruff':    ('2EiwWnXFnvU5JabPnv8n', 'Clyde'),
    'ai_child_female':  ('MF3mGyEYCl7XYWbV9V6O', 'Elli'),
    'ai_child_male':    ('yoZ06aMxZJJ28mfd3POQ', 'Sam'),
    'ai_elder_female':  ('ThT5KcBeYPX3keUQqHPh', 'Dorothy'),
    'ai_elder_male':    ('GBv7mTt0atIp3Br8iCZE', 'Thomas'),
    'ai_villain':       ('N2lVS1w4EtoT3dr4eOWO', 'Callum'),
    'ai_whisper':       ('oWAxZDx7w5VEj9dCyTzz', 'Grace'),
    'ai_dramatic':      ('IKne3meq5aSn9XLyUdCD', 'Charlie'),
    'ai_cartoon':       ('jBpfuIE2acCO8z3wKNLl', 'Gigi'),
    'ai_robot':         ('TX3LPaxmHKxFdv7VOQHJ', 'Liam'),
    'ai_fantasy':       ('jsCqWAovK2LkecY7zXl4', 'Freya'),
}

# ── pageCast ai_ voice → Gemini voice name ────────────────────────────────────
AI_TO_GEMINI = {
    'ai_narrator_warm':  'Sulafat',
    'ai_narrator_deep':  'Kore',
    'ai_female_soft':    'Aoede',
    'ai_female_warm':    'Vindemiatrix',
    'ai_female_bright':  'Zephyr',
    'ai_male_deep':      'Orus',
    'ai_male_calm':      'Iapetus',
    'ai_male_gruff':     'Algenib',
    'ai_child_female':   'Leda',
    'ai_child_male':     'Puck',
    'ai_elder_female':   'Gacrux',
    'ai_elder_male':     'Gacrux',
    'ai_villain':        'Charon',
    'ai_whisper':        'Enceladus',
    'ai_dramatic':       'Orus',
    'ai_cartoon':        'Fenrir',
    'ai_robot':          'Iapetus',
    'ai_fantasy':        'Aoede',
}

# ── Casting notes (mirrors src/lib/voiceLibrary.ts castingNote fields) ────────
CASTING_NOTES = {
    'ai_narrator_warm':  'A polished premium audiobook narrator: warm, grounded, intimate, emotionally observant, and steady.',
    'ai_narrator_deep':  'A resonant cinematic narrator with mature depth, calm authority, long phrasing, and restrained drama.',
    'ai_female_soft':    'A gentle young adult woman: bright, soft, caring, clear, and emotionally sincere.',
    'ai_female_warm':    'A warm adult woman with nurturing confidence, rounded vowels, gentle humor, and comforting presence.',
    'ai_female_bright':  'A bright teenage girl: curious, energetic, quick reactions, expressive smiles in the voice.',
    'ai_male_deep':      'A deep adult man: low register, controlled strength, serious but not harsh, with weight in each line.',
    'ai_male_calm':      'A calm young adult man: relaxed, reassuring, natural conversational rhythm, and steady pacing.',
    'ai_male_gruff':     'A rugged adult man: gravelly edge, protective, weathered, clipped delivery, and dry resolve.',
    'ai_child_female':   'A young girl around seven years old: innocent, playful, high energy, light tone, and small delighted gasps.',
    'ai_child_male':     'A young boy around eight years old: lively, mischievous, quick, brave, and slightly breathless.',
    'ai_elder_female':   'An elderly woman storyteller: wise, tender, slower cadence, delicate pauses, and lived-in warmth.',
    'ai_elder_male':     'An elderly man storyteller: gentle rasp, reflective, patient, amused, and full of remembered history.',
    'ai_villain':        'An elegant villain: smooth, dangerous, quiet confidence, deliberate pauses, never shouting.',
    'ai_whisper':        'A near-whispered secret voice: airy, close to the microphone, suspenseful, careful, and hushed.',
    'ai_dramatic':       'A heroic dramatic performer: bold, theatrical, rising momentum, clean projection, and emotional lift.',
    'ai_cartoon':        'A playful cartoon sidekick: bouncy, exaggerated reactions, fast comic timing, and harmless silliness.',
    'ai_robot':          'A friendly story robot: precise, lightly mechanical cadence, dry warmth, and evenly spaced syllables.',
    'ai_fantasy':        'An enchanted fantasy voice: lyrical, mysterious, graceful, lightly musical, and full of wonder.',
    # Gemini built-in voices
    'gemini:Sulafat':         'A warm story voice with inviting tone and gentle emotional color.',
    'gemini:Kore':            'A firm, grounded narrator voice with authority and clean pacing.',
    'gemini:Aoede':           'A breezy, relaxed female voice with soft confidence and easy movement.',
    'gemini:Zephyr':          'A bright, clear female voice with optimistic color and crisp delivery.',
    'gemini:Vindemiatrix':    'A gentle adult woman voice, warm, tender, and softly expressive.',
    'gemini:Despina':         'A smooth adult woman voice with polished delivery and calm control.',
    'gemini:Orus':            'A firm adult male voice with confidence, weight, and controlled expression.',
    'gemini:Iapetus':         'A clear adult male voice suited for clean dialogue and direct narration.',
    'gemini:Charon':          'An informative adult male voice with steady clarity and measured delivery.',
    'gemini:Algenib':         'A gravelly adult male voice with texture, grit, and grounded presence.',
    'gemini:Gacrux':          'A mature, older voice with patient pacing, warmth, and lived-in depth.',
    'gemini:Leda':            'A youthful, bright child or young teen voice with clean diction and curiosity.',
    'gemini:Puck':            'An upbeat young character voice: lively, friendly, expressive, and quick to react.',
    'gemini:Fenrir':          'An excitable, energetic young voice with playful momentum and clear enthusiasm.',
    'gemini:Enceladus':       'A breathy, vulnerable voice useful for tired, scared, secretive, or intimate moments.',
}

RATE_LIMIT_DELAY = 0.4   # seconds between API calls


def get_casting_note(voice_id: str) -> str:
    return CASTING_NOTES.get(voice_id, 'A clear, expressive storytelling voice suited to the character.')


# ── pageCast parsing ──────────────────────────────────────────────────────────

def parse_cast_block(text: str) -> dict:
    """Parse ::CAST block → {slug: label}"""
    characters = {}
    cast_match = re.search(r'::CAST\s*\n(.*?)(?=::|$)', text, re.DOTALL)
    if not cast_match:
        return characters
    for line in cast_match.group(1).strip().splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        m = re.match(r'^(.+?):\s*(\S+)', line)
        if m:
            label = m.group(1).strip()
            rest  = m.group(2).strip()
            slug  = rest.split('|')[0].strip()
            characters[slug] = label
    return characters


def parse_header(text: str) -> dict:
    info = {}
    for key in ('Title', 'Genre', 'Language'):
        m = re.search(rf'^{key}:\s*(.+)$', text, re.MULTILINE | re.IGNORECASE)
        if m:
            info[key.lower()] = m.group(1).strip()
    return info


def parse_scenes(text: str) -> list:
    """Return list of scene dicts, each with chapter info and blocks."""
    chapter_pat = re.compile(
        r'^#\s+(?:Chapter|Bab|BAB|CHAPTER)\s+(\d+):\s*(.+)$',
        re.MULTILINE | re.IGNORECASE
    )
    scene_pat = re.compile(
        r'^##\s+(?:Scene|SCENE)\s+(\d+):\s*(.+)$',
        re.MULTILINE | re.IGNORECASE
    )
    # Matches [TYPE] or [TYPE: meta] followed by body text until next [
    block_pat = re.compile(
        r'\[(?P<type>NARRATION|DIALOGUE|THOUGHT)(?::(?P<meta>[^\]]*))?\]\s*\n(?P<body>[^\[]*)',
        re.IGNORECASE | re.DOTALL
    )

    chapter_matches = list(chapter_pat.finditer(text))
    scene_matches   = list(scene_pat.finditer(text))
    scenes = []

    for i, sm in enumerate(scene_matches):
        scene_start = sm.start()
        scene_end   = scene_matches[i + 1].start() if i + 1 < len(scene_matches) else len(text)
        scene_block = text[scene_start:scene_end]

        # Find containing chapter
        ch_num, ch_title = 1, ''
        for cm in reversed(chapter_matches):
            if cm.start() < scene_start:
                ch_num   = int(cm.group(1))
                ch_title = cm.group(2).strip()
                break

        blocks = []
        for bm in block_pat.finditer(scene_block):
            btype = bm.group('type').upper()
            meta  = (bm.group('meta') or '').strip()
            body  = bm.group('body').strip()

            if not body:
                continue

            # Parse meta: "character | emotion=X | style=Y"
            parts   = [p.strip() for p in meta.split('|')]
            char    = parts[0].strip().lower().replace(' ', '_') if parts else ''
            emotion = ''
            style   = ''
            for part in parts[1:]:
                if '=' in part:
                    k, v = part.split('=', 1)
                    k = k.strip().lower()
                    if k == 'emotion':
                        emotion = v.strip()
                    elif k == 'style':
                        style = v.strip()

            blocks.append({
                'type':    btype.lower(),
                'char':    char or 'narrator',
                'emotion': emotion,
                'style':   style,
                'text':    body,
            })

        if blocks:
            scenes.append({
                'chapter_num':   ch_num,
                'chapter_title': ch_title,
                'scene_num':     int(sm.group(1)),
                'scene_title':   sm.group(2).strip(),
                'blocks':        blocks,
            })

    return scenes


# ── Voice resolution ──────────────────────────────────────────────────────────

def resolve_voice(char_slug: str, config: dict) -> dict:
    """Map character slug to provider + voice IDs."""
    char_cfg = config.get('characters', {}).get(char_slug, {})
    if isinstance(char_cfg, str):
        voice_id = char_cfg
        label    = char_slug
    else:
        voice_id = char_cfg.get('voice_id', 'ai_narrator_warm')
        label    = char_cfg.get('label', char_slug)

    top_provider = config.get('provider', 'elevenlabs')

    if voice_id.startswith('gemini:'):
        return {
            'provider':     'gemini',
            'voice_id':     voice_id,
            'gemini_voice': voice_id[len('gemini:'):],
            'el_voice_id':  None,
            'label':        label,
        }
    elif voice_id.startswith('elevenlabs:'):
        return {
            'provider':     'elevenlabs',
            'voice_id':     voice_id,
            'el_voice_id':  voice_id[len('elevenlabs:'):],
            'gemini_voice': None,
            'label':        label,
        }
    else:
        # ai_* voice — route to whichever provider is configured
        el_id, _  = ELEVENLABS_FALLBACK.get(voice_id, ('21m00Tcm4TlvDq8ikWAM', 'Rachel'))
        gem_voice = AI_TO_GEMINI.get(voice_id, 'Sulafat')
        return {
            'provider':     top_provider,
            'voice_id':     voice_id,
            'el_voice_id':  el_id,
            'gemini_voice': gem_voice,
            'label':        label,
        }


# ── ElevenLabs TTS ────────────────────────────────────────────────────────────

def _el_voice_settings(block_type: str, emotion: str, speed: float) -> dict:
    """Mirrors getElevenLabsVoiceSettings() in the Beat's generate/route.ts."""
    speed    = max(0.7, min(1.2, speed))
    stability, style = 0.5, 0.35

    if block_type == 'dialogue':
        stability, style = 0.44, 0.42
    elif block_type == 'thought':
        speed -= 0.04; stability, style = 0.55, 0.30
    else:
        stability, style = 0.52, 0.32

    em = (emotion or '').lower()
    if em in ('sad', 'worried', 'scared', 'mysterious'):
        speed -= 0.04; stability += 0.04; style += 0.04
    elif em in ('angry', 'excited', 'surprised'):
        speed += 0.02; stability -= 0.04; style += 0.08
    elif em == 'happy':
        speed += 0.01; style += 0.04

    return {
        'stability':         min(max(stability, 0.25), 0.75),
        'similarity_boost':  0.8,
        'style':             min(max(style, 0.0), 0.65),
        'use_speaker_boost': True,
        'speed':             max(0.7, min(1.2, speed)),
    }


def call_elevenlabs(text: str, el_voice_id: str, block_type: str,
                    emotion: str, speed: float, api_key: str) -> bytes | None:
    vs   = _el_voice_settings(block_type, emotion, speed)
    body = json.dumps({
        'text':           text,
        'model_id':       'eleven_multilingual_v2',
        'voice_settings': vs,
    }).encode()
    url = f'https://api.elevenlabs.io/v1/text-to-speech/{el_voice_id}'
    req = urllib.request.Request(url, data=body, headers={
        'xi-api-key':   api_key,
        'Content-Type': 'application/json',
        'Accept':       'audio/mpeg',
    })
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.read()
    except urllib.error.HTTPError as e:
        msg = ''
        try:
            msg = json.loads(e.read()).get('detail', {}).get('message', '')
        except Exception:
            pass
        print(f'      ⚠  ElevenLabs {e.code}: {msg or e.reason}')
        return None
    except Exception as e:
        print(f'      ⚠  ElevenLabs failed: {e}')
        return None


# ── Gemini TTS ────────────────────────────────────────────────────────────────

def _pcm_to_wav(pcm: bytes, sample_rate: int = 24000, channels: int = 1, bits: int = 16) -> bytes:
    """Mirrors pcmToWav() in the Beat's generate/route.ts."""
    byte_rate   = sample_rate * channels * bits // 8
    block_align = channels * bits // 8
    header = struct.pack(
        '<4sI4s4sIHHIIHH4sI',
        b'RIFF', 36 + len(pcm), b'WAVE',
        b'fmt ', 16, 1, channels, sample_rate, byte_rate, block_align, bits,
        b'data', len(pcm)
    )
    return header + pcm


def _build_gemini_prompt(text: str, char_label: str, voice_id: str,
                         block_type: str, emotion: str) -> str:
    """Mirrors buildGeminiPrompt() in the Beat's generate/route.ts."""
    note = get_casting_note(voice_id)
    lines = [
        'Synthesize speech for PageCast. Speak only the transcript, not these directions.',
        f'# AUDIO PROFILE: {char_label or "Narrator"}',
        note,
        f'Block type: {block_type}.',
        f'Emotion: {emotion}. Let it affect tone and pacing naturally.' if emotion and emotion != 'neutral' else '',
        'Keep the voice consistent, expressive, and age-appropriate.',
        'Do not read punctuation labels, stage directions, or square-bracket tags aloud.',
        '# TRANSCRIPT',
        text.strip(),
    ]
    return '\n'.join(l for l in lines if l)


def call_gemini(text: str, gemini_voice: str, voice_id: str, char_label: str,
                block_type: str, emotion: str, model: str, api_key: str) -> bytes | None:
    prompt = _build_gemini_prompt(text, char_label, voice_id, block_type, emotion)
    body   = json.dumps({
        'contents': [{'parts': [{'text': prompt}]}],
        'generationConfig': {
            'responseModalities': ['AUDIO'],
            'speechConfig': {
                'voiceConfig': {
                    'prebuiltVoiceConfig': {'voiceName': gemini_voice},
                },
            },
        },
        'model': model,
    }).encode()
    url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent'
    req = urllib.request.Request(url, data=body, headers={
        'x-goog-api-key': api_key,
        'Content-Type':   'application/json',
    })
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            payload = json.loads(resp.read())
        parts = payload.get('candidates', [{}])[0].get('content', {}).get('parts', [])
        b64 = None
        for part in parts:
            inline = part.get('inlineData') or part.get('inline_data')
            if inline:
                b64 = inline.get('data')
                break
        if not b64:
            print('      ⚠  Gemini: no audio in response')
            return None
        return _pcm_to_wav(base64.b64decode(b64))
    except urllib.error.HTTPError as e:
        try:
            msg = json.loads(e.read()).get('error', {}).get('message', e.reason)
        except Exception:
            msg = e.reason
        print(f'      ⚠  Gemini {e.code}: {msg}')
        return None
    except Exception as e:
        print(f'      ⚠  Gemini failed: {e}')
        return None


# ── Dispatch ──────────────────────────────────────────────────────────────────

def generate_audio(block: dict, voice_cfg: dict, config: dict) -> bytes | None:
    text       = block['text']
    block_type = block['type']
    emotion    = block['emotion']
    speed      = config.get('speed', 0.95)
    provider   = voice_cfg['provider']

    if provider == 'elevenlabs':
        return call_elevenlabs(
            text, voice_cfg['el_voice_id'], block_type, emotion, speed,
            config.get('api_key', '')
        )
    elif provider == 'gemini':
        return call_gemini(
            text,
            voice_cfg['gemini_voice'],
            voice_cfg['voice_id'],
            voice_cfg['label'],
            block_type,
            emotion,
            config.get('gemini_model', 'gemini-2.5-flash-preview-tts'),
            config.get('gemini_api_key', config.get('api_key', ''))
        )
    else:
        print(f'      ⚠  Unknown provider: {provider}')
        return None


# ── Setup: generate voice_config.json template ───────────────────────────────

def create_voice_config_template(folder: Path, pagecast_files: list) -> Path:
    all_chars = {}
    for pf in pagecast_files:
        text = pf.read_text(encoding='utf-8')
        for slug, label in parse_cast_block(text).items():
            if slug not in all_chars:
                all_chars[slug] = label

    default_voices = {
        'narrator': 'ai_narrator_warm',
    }
    chars_cfg = {}
    for slug, label in sorted(all_chars.items()):
        chars_cfg[slug] = {
            'label':    label,
            'voice_id': default_voices.get(slug, 'ai_female_soft'),
        }

    config = {
        '_readme':        'Set voice_id for each character. Use ai_* IDs, or gemini:VoiceName, or elevenlabs:VOICE_ID',
        'provider':       'elevenlabs',
        'api_key':        'YOUR_ELEVENLABS_API_KEY',
        'gemini_api_key': 'YOUR_GEMINI_API_KEY',
        'speed':          0.95,
        'gemini_model':   'gemini-2.5-flash-preview-tts',
        'characters':     chars_cfg,
    }

    out = folder / 'voice_config.json'
    out.write_text(json.dumps(config, indent=2, ensure_ascii=False), encoding='utf-8')
    return out


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='pageCast Voice Producer')
    group  = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--pagecast', help='Path to a single pageCast .txt file')
    group.add_argument('--folder',   help='Path to a .casts/<book>/ folder')
    parser.add_argument('--config',    help='voice_config.json path (default: <folder>/voice_config.json)')
    parser.add_argument('--setup',     action='store_true', help='Create voice_config.json template and exit')
    parser.add_argument('--voice-dir', help='Output folder (default: <folder>/voice/)')
    parser.add_argument('--scene',     type=int, help='Generate only a single scene number')
    parser.add_argument('--chapter',   type=int, help='Combined with --scene, target a specific chapter')
    args = parser.parse_args()

    if args.pagecast:
        pagecast_files = [Path(args.pagecast)]
        base_dir       = Path(args.pagecast).parent
    else:
        base_dir       = Path(args.folder)
        pagecast_files = sorted(base_dir.glob('*_pagecast.txt'))
        if not pagecast_files:
            print(f'❌  No *_pagecast.txt files found in {base_dir}')
            sys.exit(1)

    # ── Setup mode ────────────────────────────────────────────────────────────
    if args.setup:
        config_path = create_voice_config_template(base_dir, pagecast_files)
        print(f'\n✅  voice_config.json created → {config_path}')
        print(f'\n   Fill in voice_id for each character, then run:')
        print(f'   python generate_voices.py --folder "{base_dir}" --config "{config_path}"\n')
        print('   Valid voice_id values (ai_* work for both ElevenLabs and Gemini):')
        for vid in ELEVENLABS_FALLBACK:
            gem = AI_TO_GEMINI.get(vid, '')
            print(f'     {vid:<20}  → EL: {ELEVENLABS_FALLBACK[vid][1]:<12} | Gemini: {gem}')
        print('\n   Or use gemini:VoiceName — e.g. gemini:Aoede, gemini:Sulafat, gemini:Charon')
        print('   Or use elevenlabs:VOICE_ID — e.g. elevenlabs:21m00Tcm4TlvDq8ikWAM')
        return

    # ── Load config ───────────────────────────────────────────────────────────
    config_path = Path(args.config) if args.config else base_dir / 'voice_config.json'
    if not config_path.exists():
        print(f'❌  voice_config.json not found: {config_path}')
        print(f'   Run with --setup to create a template first.')
        sys.exit(1)
    config = json.loads(config_path.read_text(encoding='utf-8'))

    # Validate keys
    api_key = config.get('api_key', '')
    gemini_key = config.get('gemini_api_key', '')
    provider = config.get('provider', 'elevenlabs')
    if provider == 'elevenlabs' and 'YOUR_' in api_key:
        print(f'❌  Add your ElevenLabs API key to {config_path}')
        sys.exit(1)
    if provider == 'gemini' and 'YOUR_' in gemini_key:
        print(f'❌  Add your Gemini API key (gemini_api_key) to {config_path}')
        sys.exit(1)

    voice_dir = Path(args.voice_dir) if args.voice_dir else base_dir / 'voice'
    voice_dir.mkdir(parents=True, exist_ok=True)

    print(f'\n🎙  pageCast Voice Producer')
    print(f'    Provider : {provider}')
    print(f'    Output   → {voice_dir}\n')

    # Load existing manifest
    manifest_path = voice_dir / 'manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8')) if manifest_path.exists() else {}

    total = generated = skipped = failed_count = 0

    for pf in pagecast_files:
        text   = pf.read_text(encoding='utf-8')
        scenes = parse_scenes(text)

        print(f'  📄 {pf.name} — {len(scenes)} scene(s)')

        for scene in scenes:
            ch = scene['chapter_num']
            sc = scene['scene_num']

            if args.scene and sc != args.scene:
                continue
            if args.chapter and ch != args.chapter:
                continue

            print(f'\n     Ch{ch} Scene {sc}: {scene["scene_title"]}')

            for idx, block in enumerate(scene['blocks']):
                total += 1
                char_slug  = block['char']
                block_type = block['type']
                emotion    = block['emotion']

                voice_cfg = resolve_voice(char_slug, config)
                used_provider = voice_cfg['provider']

                # File extension depends on provider
                ext      = 'wav' if used_provider == 'gemini' else 'mp3'
                filename = f'Ch{ch}_Sc{sc}_{idx+1:03d}_{block_type}_{char_slug}.{ext}'
                dest     = voice_dir / filename

                if dest.exists():
                    print(f'      ✓  {filename} (skipped)')
                    skipped += 1
                    continue

                label        = voice_cfg['label']
                text_preview = block['text'][:60].replace('\n', ' ')
                em_str       = f' [{emotion}]' if emotion else ''
                print(f'      ↳  {label}{em_str}: {text_preview}…')

                time.sleep(RATE_LIMIT_DELAY)
                audio = generate_audio(block, voice_cfg, config)

                if audio:
                    dest.write_bytes(audio)
                    size_kb = round(len(audio) / 1024)
                    print(f'         ✅  {filename} ({size_kb}KB)')
                    generated += 1
                    manifest[filename] = {
                        'chapter':    ch,
                        'scene':      sc,
                        'block_idx':  idx + 1,
                        'block_type': block_type,
                        'character':  char_slug,
                        'label':      label,
                        'emotion':    emotion,
                        'provider':   used_provider,
                        'voice_id':   voice_cfg['voice_id'],
                    }
                else:
                    print(f'         ❌  failed')
                    failed_count += 1

    # Save manifest
    manifest_path.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False),
        encoding='utf-8'
    )

    print(f'\n{"─"*50}')
    print(f'✅  Done!')
    print(f'   Total blocks    : {total}')
    print(f'   Generated       : {generated}')
    print(f'   Already existed : {skipped}')
    if failed_count:
        print(f'   Failed          : {failed_count}  (re-run to retry)')
    print(f'\n   Voice folder : {voice_dir}')
    print(f'   Manifest     : {manifest_path}')


if __name__ == '__main__':
    main()
