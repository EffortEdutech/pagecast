#!/usr/bin/env python3
"""
pageCast Scene Image Producer
Generates scene illustrations using Pollinations.ai, HuggingFace Inference API,
or a local ComfyUI instance (best quality, runs on your GPU).

Usage -- Pollinations (default):
  python skills/generate_images.py --folder ".casts/bookname/" --style-pick 2

Usage -- HuggingFace FLUX.1-dev (better humans, free with HF account):
  python skills/generate_images.py --folder ".casts/bookname/" --backend hf --hf-token hf_xxx --style-pick 2

Usage -- HuggingFace FLUX.1-schnell (fastest, Apache 2.0, no license needed):
  python skills/generate_images.py --folder ".casts/bookname/" --backend hf --hf-token hf_xxx --hf-model schnell --style-pick 2

Usage -- ComfyUI local GPU (best quality, requires ComfyUI running at localhost:8000):
  python skills/generate_images.py --folder ".casts/bookname/" --backend comfyui --style-pick 2
  python skills/generate_images.py --folder ".casts/bookname/" --backend comfyui --comfyui-model juggernaut_xl_v9_lightning.safetensors
"""

import argparse
import json
import os
import re
import sys
import time
import uuid
import urllib.request
import urllib.parse
import urllib.error
from pathlib import Path

RATE_LIMIT_DELAY = 2.0
HF_RATE_LIMIT_DELAY = 4.0  # HF free tier needs a bit more breathing room

# HuggingFace model options
HF_MODELS = {
    "dev":     "black-forest-labs/FLUX.1-dev",      # Best quality; requires license acceptance
    "schnell": "black-forest-labs/FLUX.1-schnell",  # Fastest; Apache 2.0, no gating needed
}
HF_DEFAULT_MODEL = "dev"

# ComfyUI local backend
COMFYUI_DEFAULT_URL   = "http://localhost:8000"
COMFYUI_DEFAULT_MODEL = "juggernaut_xl_v9_lightning.safetensors"

# Character reference images live here: .casts/CHARACTER_REFS/CHARNAME.jpg
# generate_images.py auto-detects this folder when using --backend comfyui.
CHAR_REFS_FOLDER = "CHARACTER_REFS"

# Prop / location reference images live here: .casts/PROP_REFS/PROPNAME.jpg
# Same book-overrides-series shadowing rule as CHARACTER_REFS.
PROP_REFS_FOLDER = "PROP_REFS"

# Module-level upload cache so each character/prop image is uploaded only once per run
_COMFYUI_UPLOAD_CACHE = {}  # {local_path_str: comfyui_filename}

# Cache of ComfyUI /object_info lookups so identity-mode auto-detection only
# hits the server once per class_type per run.
_COMFYUI_NODE_CACHE = {}  # {(comfyui_url, class_type): bool}

# Negative prompt for character model-sheet / portrait generation (txt2img + FaceDetailer).
# Mirrors comfyui_workflows/api/character_portrait_gen.json's NEGATIVE node exactly.
PORTRAIT_NEGATIVE = (
    "blurry face, bad face, ugly face, deformed face, melted face, asymmetric eyes, "
    "cross-eyed, missing eyes, no eyes, extra limbs, extra arms, extra legs, missing limbs, "
    "deformed hands, extra fingers, fused fingers, malformed hands, bad anatomy, low quality, "
    "watermark, text, sunglasses, hat covering face, hair covering face, turned away from camera, "
    "side view, back view, profile view, looking away, closed eyes, dark background, busy background, "
    "multiple characters, cropped body, cut off legs, cut off feet, partial body, close-up face only, "
    "portrait crop, headshot only"
)

PORTRAIT_TEMPLATE = (
    "full body character design sheet, ArtStation concept art, digital illustration, {desc}, "
    "standing upright, A-pose arms slightly away from body, looking directly at camera, "
    "neutral calm expression, front facing, centered full body composition, head to toe visible, "
    "complete outfit clearly shown, soft studio lighting, plain white background, clear sharp face, "
    "detailed eyes, detailed clothing and accessories, symmetrical, correct human anatomy, 8k, "
    "high quality, character reference sheet turnaround"
)

# Pollinations model options
# flux-realism is the best free model for human anatomy on Pollinations.ai
DEFAULT_MODEL = "flux-realism"

# Available Pollinations.ai models -- pick with --model-pick N
MODEL_PRESETS = [
    (1, "flux-realism",   "Best for humans & realistic scenes -- correct anatomy ✅ RECOMMENDED"),
    (2, "flux",           "Base FLUX -- fast, free, weaker anatomy"),
    (3, "flux-pro",       "Highest quality -- slowest, free on Pollinations"),
    (4, "flux-anime",     "Anime / manga style"),
    (5, "flux-3d",        "3D rendered look"),
    (6, "any-dark",       "Dark moody atmospheric style"),
    (7, "turbo",          "SDXL Turbo -- very fast, lower quality"),
]

NEGATIVE_PROMPT = (
    # Text / comic panel artifacts
    "speech bubble, dialogue balloon, word balloon, text overlay, caption, label, "
    "watermark, comic panel, panel border, thought bubble, onomatopoeia, "
    "subtitle, letter, word, writing, typography, manga, anime panel, comic strip, "
    # Extra / missing body parts
    "extra legs, three legs, four legs, too many legs, extra arms, three arms, "
    "extra fingers, missing fingers, six fingers, fused fingers, malformed hands, "
    "deformed hands, extra limbs, missing limbs, floating limbs, disconnected limbs, "
    "extra head, two heads, missing head, no head, headless, "
    # Wrong joint directions and bent limbs
    "backwards knees, inverted knees, hyperextended knees, knee bent wrong way, "
    "backwards elbows, inverted joints, dislocated joints, broken joints, "
    "limbs bending wrong direction, impossible pose, contorted limbs, "
    # Body shape and proportion failures
    "twisted torso, distorted anatomy, bad proportions, disfigured body, alien body, "
    "misshapen body, warped figure, impossible body shape, elongated limbs, "
    "shrunken limbs, asymmetric body, lopsided figure, melted body parts, "
    "merged legs, fused legs, legs growing from wrong place, "
    # Face failures
    "no eyes, missing eyes, blank face, faceless, blurry face, "
    "distorted face, disfigured face, melted face, asymmetric eyes, "
    # General quality failures
    "low quality, blurry, pixelated, jpeg artifacts, overexposed, underexposed, "
    "out of frame, cropped, duplicate, clone, multiple versions of same character"
)

# All presets use photography/painting framing -- avoids comic panel associations
STYLE_PRESETS = [
    (1, "Cinematic Photo",        "cinematic photography, DSLR photo, dramatic lighting, shallow depth of field"),
    (2, "Concept Art",            "ArtStation concept art, digital illustration, cinematic, detailed"),
    (3, "Movie Poster",           "movie poster art, dramatic composition, vibrant colours, detailed"),
    (4, "Oil Painting",           "oil painting, dramatic lighting, rich colours, detailed brushwork"),
    (5, "Watercolour",            "watercolour illustration, soft light, detailed, painterly"),
    (6, "3D Render",              "3D render, octane render, cinematic lighting, photorealistic"),
]

GENRE_STYLES = {
    "young adult adventure comedy": "cinematic photography, DSLR photo, vibrant colours, dramatic lighting",
    "young adult adventure":        "cinematic photography, DSLR photo, dramatic lighting",
    "young adult romance":          "watercolour illustration, soft warm tones, painterly, detailed",
    "young adult":                  "ArtStation concept art, digital illustration, cinematic",
    "children's fantasy":           "watercolour children's book illustration, soft light, magical",
    "children's islamic":           "warm watercolour illustration, soft colours, detailed",
    "children's":                   "watercolour illustration, colourful, soft light, detailed",
    "adult literary":               "oil painting, moody dramatic lighting, atmospheric, detailed",
    "adult islamic":                "warm oil painting, serene, detailed, soft light",
    "malay":                        "batik-inspired digital illustration, tropical colours, detailed",
    "nusantara":                    "batik-inspired digital illustration, tropical colours, detailed",
}

MUSIC_MOODS = {
    "quirky_upbeat":   "light-hearted energetic atmosphere",
    "upbeat_comedy":   "comedic cheerful atmosphere",
    "quiet_mystery":   "mysterious quiet atmosphere",
    "quirky_mystery":  "curious mysterious atmosphere",
    "upbeat_tension":  "tense energetic atmosphere",
    "quiet_tension":   "tense suspenseful atmosphere",
    "quiet_warmth":    "warm intimate atmosphere",
    "freeze_tension":  "frozen tense suspended moment",
}

# Dialogue/thought verbs that signal "comic panel" to the model -- strip from narration
DIALOGUE_VERBS = re.compile(
    r'\b(said|asked|shouted|whispered|replied|answered|exclaimed|muttered|gasped|'
    r'laughed|smiled|frowned|thought|felt|wondered|realized|noticed|heard|'
    r'knew|believed|hoped|feared|remembered|forgot|decided|wanted|needed)\b',
    re.IGNORECASE
)

# Filler words that add no visual value
FILLER_WORDS = re.compile(
    r'\b(suddenly|immediately|quickly|slowly|carefully|finally|actually|really|'
    r'just|already|still|even|also|very|quite|rather|almost|nearly|perhaps|'
    r'maybe|somehow|anyway|however|therefore|although|because|since|'
    r'while|when|if|that|which|who|whom|whose|what|about|know|'
    r'I|me|my|we|our|us|she|he|they|it|her|his|their|its|'
    r'was|were|had|have|has|did|does|do|could|would|should|might|must|shall|will|'
    r'can|may|be|been|being|and|but|or|so|yet|for|nor|a|an|the)\b',
    re.IGNORECASE
)


def narration_to_visual(text):
    """
    Find the most visually rich sentence in narration text.
    Scores all sentences by surviving word count after filler/dialogue-verb removal.
    Abstract first-person thought-sentences are penalised but not excluded entirely.
    """
    if not text:
        return ""

    sentences = re.split(r'(?<=[.!?])\s+', text.strip())

    def filter_sentence(s):
        # Collapse contractions before stripping punctuation (I'd->Id, won't->wont)
        f = re.sub(r"'s|'t|'d|'re|'ve|'ll|'m", '', s)
        f = DIALOGUE_VERBS.sub('', f)
        f = FILLER_WORDS.sub('', f)
        f = re.sub(r'[^\w\s]', '', f)
        # Remove lone single-letter tokens left by contraction collapse
        f = re.sub(r'\b[a-zA-Z]\b', '', f)
        f = re.sub(r'\s+', ' ', f).strip()
        return f

    best_filtered = ""
    best_score = 0

    for s in sentences[:12]:
        s = s.strip()
        if not s or len(s) < 12:
            continue
        filtered = filter_sentence(s)
        score = len(filtered.split())
        # Abstract first-person thought sentences get a heavy score penalty
        # so a concrete visual sentence beats them
        if re.match(r'^(I |My |Here)', s) and DIALOGUE_VERBS.search(s):
            score = score // 3
        if score > best_score and len(filtered) > 8:
            best_filtered = filtered
            best_score = score

    return best_filtered if len(best_filtered) > 8 else ""


def title_to_visual(scene_title):
    """Convert a scene title like 'The Alley Test' into visual scene keywords."""
    clean = re.sub(r'\b(the|a|an|of|in|at|on|to|into|from|scene)\b', '', scene_title, flags=re.IGNORECASE)
    clean = re.sub(r'\s+', ' ', clean).strip()
    return clean


def pick_model_interactive():
    print()
    print("  +------------------------------------------------------------------+")
    print("  |  Choose image model                                              |")
    print("  +------------------------------------------------------------------+")
    for num, name, desc in MODEL_PRESETS:
        print("  |  {}  {:<18}  {:<38}|".format(num, name, desc[:38]))
    print("  +------------------------------------------------------------------+")
    while True:
        try:
            choice = input("  Enter number (1-{}) or press Enter for default (flux-realism): ".format(len(MODEL_PRESETS))).strip()
            if choice == "":
                print("  Using: flux-realism")
                return DEFAULT_MODEL
            n = int(choice)
            if 1 <= n <= len(MODEL_PRESETS):
                _, name, _ = MODEL_PRESETS[n - 1]
                print("  Using: " + name)
                return name
        except EOFError:
            return DEFAULT_MODEL
        except ValueError:
            pass
        print("  Please enter 1-{}.".format(len(MODEL_PRESETS)))


def pick_style_interactive():
    print()
    print("  +------------------------------------------------------------------+")
    print("  |  Choose visual style  (all are speech-bubble-free)              |")
    print("  +------------------------------------------------------------------+")
    for num, name, style in STYLE_PRESETS:
        print("  |  {}  {:<22}  {:<35}|".format(num, name, style[:35]))
    print("  +------------------------------------------------------------------+")
    while True:
        try:
            choice = input("  Enter number (1-6) or press Enter for genre default: ").strip()
            if choice == "":
                return ""
            n = int(choice)
            if 1 <= n <= len(STYLE_PRESETS):
                _, name, style = STYLE_PRESETS[n - 1]
                print("  Using: " + name)
                return style
        except EOFError:
            return ""
        except ValueError:
            pass
        print("  Please enter 1-{}.".format(len(STYLE_PRESETS)))


def slugify(text):
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9\s-]", "", text)
    text = re.sub(r"[\s-]+", "_", text)
    return text[:50]


def detect_style(genre):
    genre_lower = genre.lower()
    for key, style in GENRE_STYLES.items():
        if key in genre_lower:
            return style
    return "ArtStation concept art, digital illustration, cinematic"


def build_image_prompt(scene_data, style):
    """
    Builds a visual prompt from scene metadata.
    - Scene title + filtered narration -> characters + action
    - Location + time + ambience -> environment and mood
    """
    parts = [style]

    visual_title = title_to_visual(scene_data.get("scene_title", ""))
    if visual_title:
        parts.append(visual_title)

    narration = scene_data.get("narration", "")
    visual_action = narration_to_visual(narration)
    if visual_action:
        parts.append(visual_action)

    location = re.sub(r"^Location:\s*", "", scene_data.get("location", ""), flags=re.IGNORECASE).strip()
    if location:
        parts.append(location)

    time_val = re.sub(r"^Time:\s*", "", scene_data.get("time", ""), flags=re.IGNORECASE).strip()
    if time_val:
        parts.append(re.split(r"[,--]", time_val)[0].strip())

    ambience = re.sub(r"^Ambience:\s*", "", scene_data.get("ambience", ""), flags=re.IGNORECASE).strip()
    if ambience:
        parts.append(ambience)

    music = scene_data.get("music", "").lower().replace(" ", "_")
    mood = MUSIC_MOODS.get(music)
    if mood:
        parts.append(mood)

    chars = scene_data.get("characters", [])
    if chars:
        parts.append("featuring " + ", ".join(chars[:2]))

    # Positive anatomy + face quality anchors
    parts.append(
        "sharp face, clear eyes, defined facial features, symmetrical eyes, "
        "natural skin tone, well-lit face, "
        "correct human anatomy, well-proportioned figure, natural pose, "
        "two legs, two arms, five fingers each hand, "
        "dynamic composition, detailed, cinematic lighting, high quality, 8k"
    )

    return ", ".join(p for p in parts if p)


# Short embedded-negative appended directly to prompt text.
# FLUX models use flow-matching and do NOT process negative_prompt URL params the same
# way Stable Diffusion does. Embedding "No X. Exactly N." phrasing in the PROMPT TEXT
# is the most reliable way to suppress anatomy failures with FLUX-based models.
FLUX_EMBEDDED_NEGATIVE = (
    "No extra legs. Exactly two legs. No inverted knees. No bent-wrong knees. "
    "No merged legs. No fused limbs. No extra arms. No deformed hands. "
    "No oversized hair. Hair proportionate to head. Normal child proportions. "
    "Face clearly visible. Eyes visible. Not facing away. "
    "No speech bubbles. No text. No watermarks. No Disney style. No cartoon exaggeration."
)


def download_image_hf(prompt, dest_path, width, height, hf_token, hf_model_id, debug=False):
    """
    Download an image from the HuggingFace Inference API (FLUX.1-dev or schnell).
    FLUX models do not support negative_prompt -- negatives are embedded in prompt text.
    """
    full_prompt = prompt + " " + FLUX_EMBEDDED_NEGATIVE

    # FLUX.1-schnell is a 4-step distilled model; dev needs more steps
    is_schnell = "schnell" in hf_model_id.lower()
    steps    = 4   if is_schnell else 28
    guidance = 0.0 if is_schnell else 3.5

    # HF FLUX supports up to 1024 on each dimension; snap to multiples of 8
    def snap8(v):
        return max(64, min(1024, (v // 8) * 8))

    w = snap8(width)
    h = snap8(height)

    payload = json.dumps({
        "inputs": full_prompt,
        "parameters": {
            "num_inference_steps": steps,
            "guidance_scale":      guidance,
            "width":               w,
            "height":              h,
        }
    }).encode("utf-8")

    url = "https://api-inference.huggingface.co/models/" + hf_model_id

    if debug:
        print("    HF URL: {}".format(url))
        print("    Prompt ({} chars): {}...".format(len(full_prompt), full_prompt[:120]))

    headers = {
        "Authorization":    "Bearer " + hf_token,
        "Content-Type":     "application/json",
        "User-Agent":       "pageCast-image-producer/1.0",
        "x-wait-for-model": "true",   # wait for cold-start rather than returning 503
    }

    max_retries = 3
    for attempt in range(max_retries):
        try:
            req = urllib.request.Request(url, data=payload, headers=headers)
            with urllib.request.urlopen(req, timeout=240) as resp:
                data = resp.read()
                # Tiny response is likely a JSON error, not an image
                if len(data) < 500:
                    try:
                        err = json.loads(data)
                        msg = err.get("error", str(err))
                        print("    HF error: {}".format(msg))
                        if "loading" in msg.lower() and attempt < max_retries - 1:
                            wait = int(err.get("estimated_time", 20)) + 5
                            print("    Model loading -- waiting {}s...".format(wait))
                            time.sleep(wait)
                            continue
                        return False
                    except (json.JSONDecodeError, KeyError):
                        pass
                if len(data) < 5000:
                    print("    Warning: response too small ({} bytes)".format(len(data)))
                    return False
                dest_path.write_bytes(data)
                return True
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")
            try:
                err  = json.loads(body)
                msg  = err.get("error", body[:120])
                print("    HF HTTP {}: {}".format(e.code, msg))
                if e.code in (503, 429) and attempt < max_retries - 1:
                    wait = 30 if e.code == 503 else 60
                    print("    Waiting {}s before retry...".format(wait))
                    time.sleep(wait)
                    continue
            except (json.JSONDecodeError, KeyError):
                print("    HF HTTP {}: {}".format(e.code, body[:120]))
            return False
        except Exception as e:
            print("    Error: {}".format(e))
            if attempt < max_retries - 1:
                print("    Retrying in 10s...")
                time.sleep(10)
                continue
            return False
    return False


# ── ComfyUI character reference helpers ───────────────────────────────────────

def _upload_char_ref_to_comfyui(image_path, comfyui_url):
    """
    Upload a character reference image to ComfyUI /upload/image.
    Returns the filename as stored in ComfyUI's input folder.
    Uses the module-level _COMFYUI_UPLOAD_CACHE to avoid re-uploading.
    """
    from urllib.parse import urlparse
    import http.client
    import mimetypes

    path_str = str(image_path)
    if path_str in _COMFYUI_UPLOAD_CACHE:
        return _COMFYUI_UPLOAD_CACHE[path_str]

    img_path = Path(image_path)
    with open(img_path, 'rb') as f:
        img_data = f.read()

    mime      = mimetypes.guess_type(str(img_path))[0] or 'image/jpeg'
    boundary  = 'PageCastBoundary' + uuid.uuid4().hex
    body      = (
        '--{b}\r\nContent-Disposition: form-data; name="image"; filename="{fn}"\r\n'
        'Content-Type: {m}\r\n\r\n'
    ).format(b=boundary, fn=img_path.name, m=mime).encode('utf-8')
    body     += img_data
    body     += ('\r\n--{}--\r\n'.format(boundary)).encode('utf-8')

    parsed = urlparse(comfyui_url)
    conn   = http.client.HTTPConnection(parsed.netloc, timeout=30)
    try:
        conn.request('POST', '/upload/image', body=body, headers={
            'Content-Type':   'multipart/form-data; boundary=' + boundary,
            'Content-Length': str(len(body)),
        })
        resp   = conn.getresponse()
        result = json.loads(resp.read().decode('utf-8'))
        name   = result.get('name', img_path.name)
        _COMFYUI_UPLOAD_CACHE[path_str] = name
        return name
    finally:
        conn.close()


def _sampler_settings_for_model(model_name):
    """
    Picks KSampler steps/cfg/sampler/scheduler by checkpoint type — both a
    'main' preset (the base image) and a 'detail' preset (FaceDetailer's
    internal regional resample).

    Lightning/Turbo/LCM checkpoints (e.g. juggernaut_xl_v9_lightning.safetensors)
    are distilled specifically for ultra-low step counts (4-8) at low CFG (~1.5-2) —
    more steps doesn't help and can even hurt. Standard SDXL checkpoints (e.g.
    juggernautXL_v9.safetensors) need the normal ~25-30 steps at CFG ~5-7 to
    resolve fine detail — faces especially. Confirmed via the ComfyUI folder
    audit that both checkpoint types are installed side by side, so switching
    --comfyui-model is enough to trade render speed for quality; no separate
    flag needed.
    """
    name = (model_name or '').lower()
    is_fast = 'lightning' in name or 'turbo' in name or 'lcm' in name or 'hyper' in name
    if is_fast:
        return {
            "main":   {"steps": 4, "cfg": 1.5, "sampler_name": "euler", "scheduler": "sgm_uniform"},
            "detail": {"steps": 8, "cfg": 2.0, "sampler_name": "euler", "scheduler": "normal"},
        }
    return {
        "main":   {"steps": 30, "cfg": 6.0, "sampler_name": "dpmpp_2m", "scheduler": "karras"},
        "detail": {"steps": 12, "cfg": 5.0, "sampler_name": "dpmpp_2m", "scheduler": "karras"},
    }


class _NodeGraph:
    """Tiny builder for ComfyUI API-format prompt graphs — allocates sequential
    string node IDs so composable graph pieces (identity lock, style lock,
    prop lock) can be chained without hand-tracking ID collisions."""
    def __init__(self):
        self.graph = {}
        self._next_id = 1

    def add(self, class_type, inputs):
        nid = str(self._next_id)
        self._next_id += 1
        self.graph[nid] = {"class_type": class_type, "inputs": inputs}
        return nid


def _comfyui_object_info(comfyui_url, class_type):
    """Checks whether a ComfyUI node class is registered (i.e. its custom node
    package is installed), via GET /object_info/<class_type>. Cached per run.
    Never raises — any failure (offline, unexpected shape) is treated as
    'not available' so callers can safely fall back to the proven path."""
    key = (comfyui_url, class_type)
    if key in _COMFYUI_NODE_CACHE:
        return _COMFYUI_NODE_CACHE[key]
    found = False
    try:
        url = comfyui_url + "/object_info/" + urllib.parse.quote(class_type)
        with urllib.request.urlopen(url, timeout=8) as resp:
            data = json.loads(resp.read())
            found = bool(data) and class_type in data
    except Exception:
        found = False
    _COMFYUI_NODE_CACHE[key] = found
    return found


def _resolve_identity_mode(identity_mode, comfyui_url, char_count, debug=False):
    """
    identity_mode: 'auto' | 'ipadapter' | 'instantid'
    Returns the effective mode to actually use. InstantID only applies to
    single-character shots (it conditions on one face per generation) — for
    2-character scenes it always falls back to the proven dual-IPAdapter chain.
    """
    if char_count != 1:
        return 'ipadapter'
    if identity_mode == 'ipadapter':
        return 'ipadapter'
    if identity_mode == 'instantid':
        return 'instantid'
    # auto
    has_instantid = _comfyui_object_info(comfyui_url, 'ApplyInstantID')
    if debug:
        print("    InstantID node detected: {}".format(has_instantid))
    return 'instantid' if has_instantid else 'ipadapter'


def _comfyui_wf_build(prompt, w, h, model_name, seed,
                       char_refs=None, prop_ref=None,
                       identity_mode='ipadapter',
                       instantid_model='ip-adapter.bin',
                       instantid_controlnet='instantid_controlnet.safetensors',
                       instantid_provider='CPU',
                       negative_prompt=None,
                       face_detail=True):
    """
    Composable SDXL ComfyUI API-format graph builder.

    char_refs: list of 0-2 ComfyUI-side filenames (from _upload_char_ref_to_comfyui).
      0 → plain txt2img.
      1 → face + style IPAdapter (or InstantID + light style pass, if identity_mode
          resolves to 'instantid').
      2 → dual face IPAdapter chain (proven scene_dual_character.json shape;
          InstantID is not used for 2 characters — see _resolve_identity_mode).
    prop_ref: optional ComfyUI-side filename for a prop/location reference —
      chained as one more IPAdapter-plus pass (weight 0.5) after identity/style,
      so recurring props/locations (matched via [PROP: Name] tag or Location
      text) stay visually consistent across scenes. Works with 0, 1, or 2
      character refs.
    face_detail: when True (default), runs FaceDetailer on every detected face
      before saving — the base KSampler is only 4 steps (Lightning checkpoint),
      which is fast but leaves faces mushy/deformed, especially several small
      faces in a wide/crowd shot. FaceDetailer crops each detected face and
      re-samples it at higher effective resolution, using the SAME
      identity-locked model + conditioning as the main pass so the touch-up
      doesn't drift off the reference. This is the same fix already used in
      _comfyui_wf_portrait — scenes/cover just never had it wired in before.

    With char_refs=None/[], prop_ref=None, identity_mode='ipadapter' and
    face_detail=False, this produces the exact same node shape as the
    original hand-authored _comfyui_wf_txt2img/_single_char/_dual_char
    functions it replaces.
    """
    char_refs = char_refs or []
    negative_prompt = negative_prompt if negative_prompt is not None else NEGATIVE_PROMPT
    g = _NodeGraph()
    ckpt = g.add("CheckpointLoaderSimple", {"ckpt_name": model_name})
    model_link = [ckpt, 0]
    clip_link = [ckpt, 1]
    vae_link = [ckpt, 2]

    clip_vision_id = [None]

    def clip_vision():
        if clip_vision_id[0] is None:
            clip_vision_id[0] = g.add("CLIPVisionLoader", {"clip_name": "CLIP-ViT-H-14.safetensors"})
        return [clip_vision_id[0], 0]

    use_instantid = (identity_mode == 'instantid' and len(char_refs) == 1)
    char_img_nodes = []

    if use_instantid:
        instantid_loader  = g.add("InstantIDModelLoader", {"instantid_file": instantid_model})
        face_analysis     = g.add("InstantIDFaceAnalysis", {"provider": instantid_provider})
        controlnet_loader = g.add("ControlNetLoader", {"control_net_name": instantid_controlnet})
        face_img = g.add("LoadImage", {"image": char_refs[0]})
        char_img_nodes.append(face_img)
        pos_txt = g.add("CLIPTextEncode", {"clip": clip_link, "text": prompt})
        neg_txt = g.add("CLIPTextEncode", {"clip": clip_link, "text": negative_prompt})
        apply_instantid = g.add("ApplyInstantID", {
            "instantid": [instantid_loader, 0], "insightface": [face_analysis, 0],
            "control_net": [controlnet_loader, 0], "image": [face_img, 0],
            "model": model_link, "positive": [pos_txt, 0], "negative": [neg_txt, 0],
            "weight": 0.8, "start_at": 0.0, "end_at": 1.0,
        })
        model_link    = [apply_instantid, 0]
        positive_cond = [apply_instantid, 1]
        negative_cond = [apply_instantid, 2]
        style_loader = g.add("IPAdapterModelLoader", {"ipadapter_file": "ip-adapter-plus_sdxl_vit-h.safetensors"})
        style_apply = g.add("IPAdapterAdvanced", {
            "model": model_link, "ipadapter": [style_loader, 0], "image": [face_img, 0],
            "clip_vision": clip_vision(), "weight": 0.3, "weight_type": "linear",
            "combine_embeds": "concat", "start_at": 0.0, "end_at": 1.0, "embeds_scaling": "V only",
        })
        model_link = [style_apply, 0]
    else:
        pos_txt = g.add("CLIPTextEncode", {"clip": clip_link, "text": prompt})
        neg_txt = g.add("CLIPTextEncode", {"clip": clip_link, "text": negative_prompt})
        positive_cond = [pos_txt, 0]
        negative_cond = [neg_txt, 0]
        if char_refs:
            face_loader = g.add("IPAdapterModelLoader", {"ipadapter_file": "ip-adapter-plus-face_sdxl_vit-h.safetensors"})
            per_char_weight = 0.7 if len(char_refs) == 1 else 0.65
            for ref in char_refs[:2]:
                img_node = g.add("LoadImage", {"image": ref})
                char_img_nodes.append(img_node)
                face_apply = g.add("IPAdapterAdvanced", {
                    "model": model_link, "ipadapter": [face_loader, 0], "image": [img_node, 0],
                    "clip_vision": clip_vision(), "weight": per_char_weight, "weight_type": "linear",
                    "combine_embeds": "concat", "start_at": 0.0, "end_at": 1.0, "embeds_scaling": "V only",
                })
                model_link = [face_apply, 0]
            if len(char_refs) == 1:
                style_loader = g.add("IPAdapterModelLoader", {"ipadapter_file": "ip-adapter-plus_sdxl_vit-h.safetensors"})
                style_apply = g.add("IPAdapterAdvanced", {
                    "model": model_link, "ipadapter": [style_loader, 0], "image": [char_img_nodes[0], 0],
                    "clip_vision": clip_vision(), "weight": 0.35, "weight_type": "linear",
                    "combine_embeds": "concat", "start_at": 0.0, "end_at": 1.0, "embeds_scaling": "V only",
                })
                model_link = [style_apply, 0]

    if prop_ref:
        prop_loader = g.add("IPAdapterModelLoader", {"ipadapter_file": "ip-adapter-plus_sdxl_vit-h.safetensors"})
        prop_img = g.add("LoadImage", {"image": prop_ref})
        prop_apply = g.add("IPAdapterAdvanced", {
            "model": model_link, "ipadapter": [prop_loader, 0], "image": [prop_img, 0],
            "clip_vision": clip_vision(), "weight": 0.5, "weight_type": "linear",
            "combine_embeds": "concat", "start_at": 0.0, "end_at": 1.0, "embeds_scaling": "V only",
        })
        model_link = [prop_apply, 0]

    samp = _sampler_settings_for_model(model_name)
    latent = g.add("EmptyLatentImage", {"width": w, "height": h, "batch_size": 1})
    sampler = g.add("KSampler", {
        "model": model_link, "positive": positive_cond, "negative": negative_cond,
        "latent_image": [latent, 0], "seed": seed, "denoise": 1.0,
        **samp["main"],
    })
    decode = g.add("VAEDecode", {"samples": [sampler, 0], "vae": vae_link})

    final_image = [decode, 0]
    if face_detail:
        bbox = g.add("UltralyticsDetectorProvider", {"model_name": "bbox/face_yolov8m.pt"})
        detail = g.add("FaceDetailer", {
            "image": final_image, "model": model_link, "clip": clip_link, "vae": vae_link,
            "positive": positive_cond, "negative": negative_cond, "bbox_detector": [bbox, 0],
            "guide_size": 512, "guide_size_for": "bbox", "max_size": 1024, "seed": seed,
            "denoise": 0.45, **samp["detail"],
            "feather": 5, "noise_mask": True, "force_inpaint": True, "bbox_threshold": 0.45,
            "bbox_dilation": 10, "bbox_crop_factor": 3, "sam_detection_hint": "center-1",
            "sam_dilation": 0, "sam_threshold": 0.93, "sam_bbox_expansion": 0,
            "sam_mask_hint_threshold": 0.7, "sam_mask_hint_use_negative": "False",
            "drop_size": 10, "wildcard": "", "cycle": 1, "inpaint_model": 1,
            "noise_mask_feather": 20, "tiled_encode": False, "tiled_decode": False,
        })
        final_image = [detail, 0]

    g.add("SaveImage", {"images": final_image, "filename_prefix": "pagecast"})
    return g.graph


def _comfyui_wf_portrait(prompt, w, h, model_name, seed):
    """Text-to-image + FaceDetailer canon portrait generator — same node
    shape as comfyui_workflows/api/character_portrait_gen.json, built
    programmatically so it can run headless from the CLI."""
    g = _NodeGraph()
    ckpt = g.add("CheckpointLoaderSimple", {"ckpt_name": model_name})
    latent = g.add("EmptyLatentImage", {"width": w, "height": h, "batch_size": 1})
    pos = g.add("CLIPTextEncode", {"clip": [ckpt, 1], "text": prompt})
    neg = g.add("CLIPTextEncode", {"clip": [ckpt, 1], "text": PORTRAIT_NEGATIVE})
    samp = _sampler_settings_for_model(model_name)
    sampler = g.add("KSampler", {
        "model": [ckpt, 0], "positive": [pos, 0], "negative": [neg, 0],
        "latent_image": [latent, 0], "seed": seed, "denoise": 1.0,
        **samp["main"],
    })
    decode = g.add("VAEDecode", {"samples": [sampler, 0], "vae": [ckpt, 2]})
    bbox = g.add("UltralyticsDetectorProvider", {"model_name": "bbox/face_yolov8m.pt"})
    detail = g.add("FaceDetailer", {
        "image": [decode, 0], "model": [ckpt, 0], "clip": [ckpt, 1], "vae": [ckpt, 2],
        "positive": [pos, 0], "negative": [neg, 0], "bbox_detector": [bbox, 0],
        "guide_size": 512, "guide_size_for": "bbox", "max_size": 768, "seed": seed,
        "denoise": 0.45, **samp["detail"],
        "feather": 5, "noise_mask": True, "force_inpaint": True, "bbox_threshold": 0.5,
        "bbox_dilation": 10, "bbox_crop_factor": 3, "sam_detection_hint": "center-1",
        "sam_dilation": 0, "sam_threshold": 0.93, "sam_bbox_expansion": 0,
        "sam_mask_hint_threshold": 0.7, "sam_mask_hint_use_negative": "False",
        "drop_size": 10, "wildcard": "CUDA", "cycle": 1, "inpaint_model": 1,
        "noise_mask_feather": 20, "tiled_encode": False, "tiled_decode": False,
    })
    g.add("SaveImage", {"images": [detail, 0], "filename_prefix": "char_portrait"})
    return g.graph


def _comfyui_submit_and_poll(workflow, dest_path, comfyui_url, debug=False, max_wait=300):
    """Shared submit-to-/prompt + poll-/history + fetch-/view logic, used by
    both scene/cover generation and character portrait generation."""
    client_id = str(uuid.uuid4())
    payload = json.dumps({"prompt": workflow, "client_id": client_id}).encode("utf-8")

    try:
        req = urllib.request.Request(
            comfyui_url + "/prompt", data=payload,
            headers={"Content-Type": "application/json"}, method="POST",
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read())
            prompt_id = result.get("prompt_id")
            node_errors = result.get("node_errors") or {}
            if node_errors:
                # ComfyUI accepted the HTTP request (200, sometimes even with a
                # prompt_id attached) but the graph itself failed validation --
                # this prompt will NEVER produce output, so fail fast instead of
                # polling /history for up to max_wait (this used to silently
                # burn the full timeout per item, e.g. 300s x 18 characters).
                details = "; ".join(
                    "{}: {}".format(node_id, [e.get("message", e) for e in info.get("errors", [])])
                    for node_id, info in node_errors.items()
                )
                print("    ComfyUI validation error: {}".format(details or node_errors))
                return False
            if not prompt_id:
                print("    ComfyUI error: {}".format(result))
                return False
    except urllib.error.HTTPError as e:
        try:
            body = json.loads(e.read())
            print("    ComfyUI validation error ({}): {}".format(e.code, body.get("error", body)))
        except Exception:
            print("    ComfyUI submit error: {}".format(e))
        return False
    except Exception as e:
        print("    ComfyUI submit error: {}".format(e))
        return False

    print("    Submitted to ComfyUI (prompt_id {}) -- waiting for render...".format(prompt_id[:8]))

    poll_interval = 2
    heartbeat_every = 15  # seconds -- keeps the log visibly alive during slow renders (e.g. FaceDetailer)
    elapsed = 0
    last_heartbeat = 0
    while elapsed < max_wait:
        time.sleep(poll_interval)
        elapsed += poll_interval
        if elapsed - last_heartbeat >= heartbeat_every:
            last_heartbeat = elapsed
            print("    ... still rendering ({}s elapsed)".format(elapsed))
        try:
            with urllib.request.urlopen(comfyui_url + "/history/" + prompt_id, timeout=10) as resp:
                history = json.loads(resp.read())
                if prompt_id not in history:
                    continue
                status = history[prompt_id].get("status", {})
                if status.get("status_str") == "error":
                    err_msgs = [m for m in status.get("messages", []) if isinstance(m, (list, tuple)) and m and m[0] == "execution_error"]
                    print("    ComfyUI execution error: {}".format(err_msgs or status))
                    return False
                outputs = history[prompt_id].get("outputs", {})
                for node_output in outputs.values():
                    if "images" not in node_output:
                        continue
                    img_info = node_output["images"][0]
                    filename = img_info["filename"]
                    subfolder = img_info.get("subfolder", "")
                    img_type = img_info.get("type", "output")
                    params = urllib.parse.urlencode({
                        "filename": filename, "subfolder": subfolder, "type": img_type,
                    })
                    img_url = comfyui_url + "/view?" + params
                    try:
                        with urllib.request.urlopen(img_url, timeout=30) as img_resp:
                            data = img_resp.read()
                            if len(data) < 5000:
                                print("    Warning: image too small ({} bytes)".format(len(data)))
                                return False
                            dest_path.write_bytes(data)
                            return True
                    except Exception as e:
                        print("    Error downloading image: {}".format(e))
                        return False
        except Exception:
            pass  # keep polling

    print("    Timeout: ComfyUI took more than {}s".format(max_wait))
    return False


def download_image_comfyui(prompt, dest_path, width, height,
                           comfyui_url=COMFYUI_DEFAULT_URL,
                           model_name=COMFYUI_DEFAULT_MODEL,
                           char_refs=None,
                           prop_ref_path=None,
                           identity_mode='auto',
                           instantid_model='ip-adapter.bin',
                           instantid_controlnet='instantid_controlnet.safetensors',
                           instantid_provider='CPU',
                           force_workflow=None,
                           face_detail=True,
                           debug=False):
    """
    Generate an image using a local ComfyUI instance (Juggernaut XL Lightning).

    char_refs: optional dict {char_name: local_image_path} — when supplied the
    function uploads the reference images once (cached) and switches to an
    identity-locked workflow so characters look consistent across every scene.
    prop_ref_path: optional local Path to a prop/location reference image —
    chained as an extra IPAdapter pass for prop/location consistency.
    identity_mode: 'auto' (default, prefers InstantID for single-character
    shots when detected on the running ComfyUI instance), 'ipadapter'
    (proven, always available), or 'instantid' (force, single-character only).
    face_detail: when True (default), adds a FaceDetailer pass over every
    detected face — the base 4-step Lightning sampler alone tends to produce
    mushy/deformed faces, especially several small ones in a wide shot.
    """
    # SDXL requires dimensions as multiples of 64, minimum 512
    def snap64(v):
        return max(512, (v // 64) * 64)

    w    = snap64(width)
    h    = snap64(height)
    seed = int(time.time() * 1000) % (2 ** 31)

    # ── Upload character + prop references ──────────────────────────────────
    comfy_chars = []
    if char_refs:
        for char_name, local_path in list(char_refs.items())[:2]:
            try:
                comfy_name = _upload_char_ref_to_comfyui(local_path, comfyui_url)
                comfy_chars.append(comfy_name)
                if debug:
                    print("    Char ref uploaded: {} → {}".format(char_name, comfy_name))
            except Exception as e:
                print("    Warning: could not upload char ref '{}': {}".format(char_name, e))

    comfy_prop = None
    if prop_ref_path:
        try:
            comfy_prop = _upload_char_ref_to_comfyui(prop_ref_path, comfyui_url)
            if debug:
                print("    Prop ref uploaded: {}".format(comfy_prop))
        except Exception as e:
            print("    Warning: could not upload prop ref: {}".format(e))

    # ── Force-workflow override (legacy CLI compatibility) ──────────────────
    _fw = force_workflow or ''
    if _fw == 'txt2img_juggernaut':
        comfy_chars, wf_note = [], ' (forced txt2img)'
    elif _fw == 'scene_single_character':
        comfy_chars, wf_note = (comfy_chars[:1] or comfy_chars), ' (forced single)'
    elif _fw == 'scene_dual_character':
        wf_note = ' (forced dual)'
    else:
        wf_note = ''

    mode = _resolve_identity_mode(identity_mode, comfyui_url, len(comfy_chars), debug=debug)
    workflow = _comfyui_wf_build(
        prompt, w, h, model_name, seed,
        char_refs=comfy_chars, prop_ref=comfy_prop, identity_mode=mode,
        instantid_model=instantid_model, instantid_controlnet=instantid_controlnet,
        instantid_provider=instantid_provider, face_detail=face_detail,
    )

    if debug:
        wf_label = '{}-char / {}{}{}{}'.format(
            len(comfy_chars), mode, '+prop' if comfy_prop else '', wf_note,
            '+facedetail' if face_detail else '')
        print("    ComfyUI: {} | model: {} | {}x{} | wf: {}".format(
            comfyui_url, model_name, w, h, wf_label))
        print("    Prompt ({} chars): {}...".format(len(prompt), prompt[:120]))

    return _comfyui_submit_and_poll(workflow, dest_path, comfyui_url, debug=debug, max_wait=300)


def download_portrait_comfyui(prompt, dest_path, width, height,
                              comfyui_url=COMFYUI_DEFAULT_URL,
                              model_name=COMFYUI_DEFAULT_MODEL,
                              debug=False):
    """Generate a character model-sheet portrait (txt2img + FaceDetailer,
    no reference image — this establishes the canon look)."""
    def snap64(v):
        return max(512, (v // 64) * 64)
    w = snap64(width)
    h = snap64(height)
    seed = int(time.time() * 1000) % (2 ** 31)
    workflow = _comfyui_wf_portrait(prompt, w, h, model_name, seed)
    if debug:
        print("    ComfyUI portrait: {} | model: {} | {}x{}".format(comfyui_url, model_name, w, h))
        print("    Prompt ({} chars): {}...".format(len(prompt), prompt[:120]))
    return _comfyui_submit_and_poll(workflow, dest_path, comfyui_url, debug=debug, max_wait=300)


def download_image(prompt, dest_path, width, height, api_key="", model=DEFAULT_MODEL,
                   extra_negative="", debug=False):
    # Embed short negative directly in prompt text (works for FLUX)
    full_prompt = prompt + " " + FLUX_EMBEDDED_NEGATIVE

    # Build URL negative_prompt (works for SD/SDXL models)
    url_negative = extra_negative if extra_negative.strip() else NEGATIVE_PROMPT

    encoded   = urllib.parse.quote(full_prompt)
    neg_enc   = urllib.parse.quote(url_negative)
    key_param = "&key=" + api_key if api_key else ""

    url = (
        "https://image.pollinations.ai/prompt/" + encoded
        + "?model={}&width={}&height={}&nologo=true&negative_prompt={}{}".format(
            model, width, height, neg_enc, key_param)
    )

    if debug:
        print("    URL ({} chars): {}...".format(len(url), url[:120]))
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "pageCast-image-producer/1.0"})
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = resp.read()
            if len(data) < 5000:
                print("    Warning: response too small ({} bytes)".format(len(data)))
                return False
            dest_path.write_bytes(data)
            return True
    except urllib.error.HTTPError as e:
        if e.code == 401:
            print("    Error: 401 -- add --key pk_YOUR_KEY (free at enter.pollinations.ai)")
        else:
            print("    Error: HTTP {}".format(e.code))
        return False
    except Exception as e:
        print("    Error: {}".format(e))
        return False


def parse_pagecast(pagecast_path):
    text = pagecast_path.read_text(encoding="utf-8")

    genre_match = re.search(r'^Genre:\s*(.+)$', text, re.MULTILINE | re.IGNORECASE)
    genre = genre_match.group(1).strip() if genre_match else ""

    chapter_pattern = re.compile(r'^#\s+(?:Chapter|Bab|CHAPTER|BAB)\s+(\d+):\s*(.+)$', re.MULTILINE | re.IGNORECASE)
    scene_pattern   = re.compile(r'^##\s+(?:Scene|SCENE)\s+(\d+):\s*(.+)$', re.MULTILINE | re.IGNORECASE)

    chapter_matches = list(chapter_pattern.finditer(text))
    scene_matches   = list(scene_pattern.finditer(text))

    scenes = []
    current_chapter = 0
    current_chapter_title = ""

    for i, sm in enumerate(scene_matches):
        scene_num   = int(sm.group(1))
        scene_title = sm.group(2).strip()
        scene_start = sm.start()

        for cm in reversed(chapter_matches):
            if cm.start() < scene_start:
                current_chapter       = int(cm.group(1))
                current_chapter_title = cm.group(2).strip()
                break

        scene_end = scene_matches[i + 1].start() if i + 1 < len(scene_matches) else len(text)
        block = text[scene_start:scene_end]

        def get_meta(key, b=block):
            m = re.search(r'^' + key + r':\s*(.+)$', b, re.MULTILINE | re.IGNORECASE)
            return m.group(1).strip() if m else ""

        char_names = [m.group(1).strip()
                      for m in re.finditer(r'\[DIALOGUE:\s*([^|]+)', block, re.IGNORECASE)]

        prop_match = re.search(r'\[PROP:\s*([^\]]+)\]', block, re.IGNORECASE)
        explicit_prop = prop_match.group(1).strip() if prop_match else ""

        narration_matches = re.findall(r'\[NARRATION\][ \t]*\r?\n(.*?)(?=\[|\Z)', block, re.DOTALL)
        narration_lines = []
        for match in narration_matches:
            line = match.strip().split('\n')[0].strip()
            if line and len(line) > 10:
                narration_lines.append(line)
            if len(narration_lines) >= 5:
                break
        raw_narr = ' '.join(narration_lines)[:600]
        if raw_narr and raw_narr[-1] not in '.!?':
            raw_narr = re.sub(r'\s*\S+$', '', raw_narr).rstrip()
        narration = raw_narr

        scenes.append({
            "chapter_num":   current_chapter,
            "chapter_title": current_chapter_title,
            "scene_num":     scene_num,
            "scene_title":   scene_title,
            "location":      get_meta("Location"),
            "time":          get_meta("Time"),
            "ambience":      get_meta("Ambience"),
            "music":         get_meta("Music"),
            "narration":     narration,
            "characters":    list(dict.fromkeys(char_names))[:2],
            "all_characters": list(dict.fromkeys(char_names)),
            "prop":          explicit_prop,
            "slug":          slugify(scene_title),
        })

    return genre, scenes


def extract_all_character_names(scenes):
    """Full, uncapped, de-duplicated character list across all scenes —
    used for character-portrait generation (unlike scene['characters'],
    which is capped at 2 for reference-image resolution)."""
    seen = []
    for sc in scenes:
        for name in sc.get("all_characters", sc.get("characters", [])):
            if name and name not in seen and name.lower() != 'narrator':
                seen.append(name)
    return seen


def _resolve_prop_for_scene(scene, all_props):
    """Matches a scene to a PROP_REFS entry: an explicit [PROP: Name] tag
    takes priority; otherwise falls back to a case-insensitive substring
    match of any known prop/location name against the scene's Location text."""
    if not all_props:
        return None, None
    explicit = scene.get("prop", "")
    if explicit:
        for name, path in all_props.items():
            if name.lower() == explicit.lower():
                return name, path
    loc = scene.get("location", "").lower()
    if loc:
        for name, path in all_props.items():
            if name.lower() in loc:
                return name, path
    return None, None


def _portrait_prompt_from_file(name, char_refs_dir):
    """Mirrors pageCast_gui.py's _character_prompt() file lookup: a prompt
    written by the storybook-image-prompt skill or by hand, saved beside the
    portrait itself."""
    for suffix in ('.prompt.txt', '.txt', '.md'):
        p = char_refs_dir / (name + suffix)
        if p.exists():
            try:
                return p.read_text(encoding='utf-8', errors='replace').strip()
            except Exception:
                pass
    return ""


def _generic_portrait_prompt(name):
    """Low-quality fallback used only when no [char:Name] prompt block and no
    CHARACTER_REFS/Name.prompt.txt file exists. Callers should print a note
    pointing at the storybook-image-prompt skill when this path is used."""
    desc = "a character named {} — no visual description available yet, please refine".format(name)
    return PORTRAIT_TEMPLATE.format(desc=desc)


def read_prompts_file(path):
    """
    Parse a <Book>_image_prompts.txt file produced by scene-prompt-writer.
    Returns dict { "Ch1Sc1": {"slug": ..., "prompt": ...}, "cover": {"prompt": ...}, ... }
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
            cur_key = "Ch{}Sc{}".format(m.group(1), m.group(2))
            cur = {}
            continue
        if line.lower() == '[cover]':
            if cur_key and cur:
                result[cur_key] = cur
            cur_key = 'cover'
            cur = {}
            continue
        cm = re.match(r'^\[char:(.+)\]$', line, re.IGNORECASE)
        if cm:
            if cur_key and cur:
                result[cur_key] = cur
            cur_key = 'char:' + cm.group(1).strip()
            cur = {}
            continue
        if '=' in line and cur_key is not None:
            k, _, v = line.partition('=')
            cur[k.strip()] = v.strip()
    if cur_key and cur:
        result[cur_key] = cur
    return result


def generate_character_portraits(folder, scenes, prompts_data, all_refs,
                                 comfyui_url, comfyui_model, overwrite, debug):
    """
    Generates one canon model-sheet portrait per character found in dialogue
    tags that doesn't already have a CHARACTER_REFS image (book- or
    series-level). Prompt source, in priority order:
      1. [char:Name] block in <Book>_image_prompts.txt (storybook-image-prompt skill)
      2. CHARACTER_REFS/Name.prompt.txt (or .txt/.md)
      3. Generic template fallback (flagged with a note to refine it)
    """
    char_refs_dir = folder / CHAR_REFS_FOLDER
    char_refs_dir.mkdir(parents=True, exist_ok=True)

    names = extract_all_character_names(scenes)
    if not names:
        print("No characters found in dialogue tags — nothing to generate.")
        return

    print("Characters found: {}".format(", ".join(names)))
    print()

    ok = skip = fail = 0
    for name in names:
        existing = all_refs.get(name)
        dest = existing if existing else (char_refs_dir / (re.sub(r'[\\/:*?"<>|]', '_', name) + '.jpg'))
        if existing and not overwrite:
            print("{}  [reference exists -- skipping]".format(name))
            skip += 1
            continue

        block = prompts_data.get('char:' + name, {})
        prompt = block.get('prompt', '')
        source = 'image_prompts.txt [char:{}]'.format(name)
        if not prompt:
            prompt = _portrait_prompt_from_file(name, char_refs_dir)
            source = 'CHARACTER_REFS/{}.prompt.txt'.format(name)
        if not prompt:
            prompt = _generic_portrait_prompt(name)
            source = 'generic fallback'
            print("{}  Note: no prompt found -- using a generic placeholder.".format(name))
            print("       Run the storybook-image-prompt skill, or write CHARACTER_REFS/{}.prompt.txt, for a real description.".format(name))

        print("{}  Generating portrait (prompt: {})...".format(name, source))
        ok_gen = download_portrait_comfyui(
            prompt=prompt, dest_path=Path(dest), width=768, height=1024,
            comfyui_url=comfyui_url, model_name=comfyui_model, debug=debug,
        )
        if ok_gen:
            print("  Saved: {}".format(dest))
            ok += 1
        else:
            fail += 1
        debug = False  # only first image gets debug output

    print()
    print("Done. Generated: {}  Skipped: {}  Failed: {}".format(ok, skip, fail))


def main():
    parser = argparse.ArgumentParser(description="pageCast Scene Image Producer")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--pagecast", help="Path to a pageCast .txt file")
    group.add_argument("--folder",   help="Path to a .casts/<book>/ folder")
    parser.add_argument("--style",      help="Visual style override (free text)")
    parser.add_argument("--style-pick", type=int, metavar="1-6",
                        help="Pick style preset by number (skips interactive menu)")
    # Backend selection
    parser.add_argument("--backend",    default="pollinations",
                        choices=["pollinations", "hf", "comfyui"],
                        help="Image backend: pollinations (default), hf (HuggingFace), "
                             "or comfyui (local GPU via ComfyUI)")
    parser.add_argument("--hf-token",   default="", metavar="hf_...",
                        help="HuggingFace API token (required when --backend hf). "
                             "Also reads env var HF_TOKEN.")
    parser.add_argument("--hf-model",   default=HF_DEFAULT_MODEL,
                        choices=list(HF_MODELS.keys()),
                        help="HF model: dev (best quality, default) or schnell (fastest)")
    # ComfyUI options
    parser.add_argument("--comfyui-url",   default=COMFYUI_DEFAULT_URL,
                        help="ComfyUI server URL (default: {})".format(COMFYUI_DEFAULT_URL))
    parser.add_argument("--comfyui-model", default=COMFYUI_DEFAULT_MODEL,
                        help="Checkpoint filename in ComfyUI models/checkpoints/ "
                             "(default: {})".format(COMFYUI_DEFAULT_MODEL))
    # Pollinations options
    parser.add_argument("--model",      default=DEFAULT_MODEL,
                        help="Pollinations model name (default: flux-realism)")
    parser.add_argument("--model-pick", type=int, metavar="1-7",
                        help="Pick Pollinations model 1-7. 1=flux-realism, 2=flux, "
                             "3=flux-pro, 4=flux-anime, 5=flux-3d, 6=any-dark, 7=turbo")
    parser.add_argument("--key",        default="", metavar="pk_...",
                        help="Pollinations API key (optional, reduces rate limiting)")
    # Output options
    parser.add_argument("--width",      type=int, default=1024)
    parser.add_argument("--height",     type=int, default=576)
    parser.add_argument("--images-dir", help="Output folder (default: <folder>/images/)")
    parser.add_argument("--overwrite",  action="store_true",
                        help="Regenerate images that already exist")
    parser.add_argument("--prompts",    metavar="FILE",
                        help="Path to <Book>_image_prompts.txt (auto-detected if omitted)")
    parser.add_argument("--debug",      action="store_true",
                        help="Print URL / prompt info for first image")
    parser.add_argument("--force-workflow", default="", metavar="WORKFLOW_NAME",
                        help="Override ComfyUI workflow auto-selection. "
                             "Use the JSON stem name, e.g. txt2img_juggernaut, "
                             "scene_single_character, scene_dual_character. "
                             "Empty string (default) = auto by character count.")
    parser.add_argument("--mode", default="scenes", choices=["scenes", "characters"],
                        help="scenes (default): generate scene images + cover. "
                             "characters: generate missing character model-sheet "
                             "portraits into CHARACTER_REFS/ instead (comfyui backend only).")
    parser.add_argument("--identity-mode", default="auto",
                        choices=["auto", "ipadapter", "instantid"],
                        help="Face identity-lock technique for single-character scenes/cover "
                             "(comfyui backend only). auto (default): use InstantID if your "
                             "ComfyUI has it installed, else fall back to IPAdapter-plus-face. "
                             "2-character scenes always use the proven dual-IPAdapter chain "
                             "regardless of this setting -- InstantID conditions on one face "
                             "per generation.")
    parser.add_argument("--instantid-model", default="ip-adapter.bin",
                        help="InstantID model filename in ComfyUI models/instantid/ "
                             "(only used when identity-mode resolves to instantid).")
    parser.add_argument("--instantid-controlnet", default="instantid_controlnet.safetensors",
                        help="InstantID ControlNet filename in ComfyUI models/controlnet/ "
                             "(only used when identity-mode resolves to instantid).")
    parser.add_argument("--instantid-provider", default="CPU", choices=["CPU", "CUDA"],
                        help="InstantIDFaceAnalysis provider (default CPU -- safe default; "
                             "use CUDA if your ComfyUI's insightface build supports GPU).")
    parser.add_argument("--no-face-detail", action="store_true",
                        help="Skip the FaceDetailer touch-up pass on scenes/cover (comfyui "
                             "backend only). On by default -- the base 4-step Lightning "
                             "sampler alone tends to produce mushy/deformed faces, especially "
                             "several small ones in a wide shot. Turning it off is faster but "
                             "noticeably lower face quality.")
    args = parser.parse_args()

    # Resolve HF token
    if not args.hf_token:
        args.hf_token = os.environ.get("HF_TOKEN", "")
    if args.backend == "hf" and not args.hf_token:
        print("Error: --backend hf requires --hf-token hf_... or env var HF_TOKEN")
        sys.exit(1)

    # Resolve Pollinations key
    if not args.key:
        args.key = os.environ.get("POLLINATIONS_KEY", "")
    if args.backend == "pollinations" and not args.key:
        print("Note: no Pollinations API key -- running unauthenticated (may be rate-limited)")
        print("      Get a free key at https://enter.pollinations.ai")
        print()

    # Resolve HF model ID
    hf_model_id = HF_MODELS.get(args.hf_model, HF_MODELS[HF_DEFAULT_MODEL])

    # Resolve Pollinations model: --model-pick > --model > interactive > default
    model = args.model
    if args.backend == "pollinations":
        if args.model_pick:
            n = args.model_pick
            if 1 <= n <= len(MODEL_PRESETS):
                _, model, _ = MODEL_PRESETS[n - 1]
                print("Model: {}".format(model))
            else:
                print("Warning: --model-pick must be 1-{}".format(len(MODEL_PRESETS)))
        elif sys.stdin.isatty() and not args.model_pick and args.model == DEFAULT_MODEL and args.mode != "characters":
            model = pick_model_interactive()
    args.model = model

    # Resolve style: --style-pick > --style > interactive > genre default
    # (--mode characters never needs this -- each character portrait's look
    # comes from its own [char:Name] prompt block, not a scene-wide style.)
    style_override = args.style or ""
    if args.style_pick:
        n = args.style_pick
        if 1 <= n <= len(STYLE_PRESETS):
            _, _, style_override = STYLE_PRESETS[n - 1]
            print("Style: {}".format(STYLE_PRESETS[n - 1][1]))
        else:
            print("Warning: --style-pick must be 1-{}".format(len(STYLE_PRESETS)))
    elif sys.stdin.isatty() and not args.style and not args.style_pick and args.mode != "characters":
        style_override = pick_style_interactive()

    # Determine base folder
    if args.folder:
        folder = Path(args.folder)
    else:
        # book folder is one level up if the given file lives in script/
        _pc_parent = Path(args.pagecast).parent
        folder = _pc_parent.parent if _pc_parent.name.lower() == "script" else _pc_parent

    if not folder.exists():
        print("Error: folder not found: {}".format(folder))
        sys.exit(1)

    # Images output directory
    images_dir = Path(args.images_dir) if args.images_dir else folder / "images"
    images_dir.mkdir(parents=True, exist_ok=True)

    # Character reference images for IP-Adapter consistency (comfyui backend only)
    # Checks two locations (book-level takes priority over series-level):
    #   1. .casts/<book>/CHARACTER_REFS/  (book-specific characters)
    #   2. .casts/CHARACTER_REFS/         (shared series characters, e.g. Danu)
    # Files in location 1 shadow files with the same name in location 2.
    _book_refs_dir   = folder / CHAR_REFS_FOLDER
    _series_refs_dir = folder.parent / CHAR_REFS_FOLDER
    # Merge: series refs first, then book refs overwrite (book takes priority)
    _all_refs = {}
    for _d in (_series_refs_dir, _book_refs_dir):
        if _d.exists():
            for _f in _d.iterdir():
                if _f.suffix.lower() in ('.jpg', '.jpeg', '.png', '.webp'):
                    _all_refs[_f.stem] = _f   # stem = character name
    char_refs_dir = _book_refs_dir if _book_refs_dir.exists() else _series_refs_dir
    if args.backend == "comfyui":
        if _all_refs:
            print("Char refs found: {}".format(", ".join(sorted(_all_refs.keys()))))
        else:
            print("Char refs: none found (checked {} and {})".format(
                _book_refs_dir, _series_refs_dir))

    # Prop / location reference images -- same book-overrides-series shadowing
    # rule as CHARACTER_REFS. Matched per scene via [PROP: Name] tag or a
    # substring match against the scene's Location text (see _resolve_prop_for_scene).
    _book_props_dir   = folder / PROP_REFS_FOLDER
    _series_props_dir = folder.parent / PROP_REFS_FOLDER
    _all_props = {}
    for _d in (_series_props_dir, _book_props_dir):
        if _d.exists():
            for _f in _d.iterdir():
                if _f.suffix.lower() in ('.jpg', '.jpeg', '.png', '.webp'):
                    _all_props[_f.stem] = _f
    if args.backend == "comfyui" and _all_props:
        print("Prop/location refs found: {}".format(", ".join(sorted(_all_props.keys()))))

    # Find prompts file (auto-detect *_image_prompts.txt in folder)
    prompts_data = {}
    if args.prompts:
        prompts_path = Path(args.prompts)
        if prompts_path.exists():
            prompts_data = read_prompts_file(prompts_path)
            print("Prompts: {}".format(prompts_path.name))
        else:
            print("Warning: prompts file not found: {}".format(prompts_path))
    else:
        for pf in sorted(folder.glob("*_image_prompts.txt")):
            prompts_data = read_prompts_file(pf)
            print("Prompts: {}".format(pf.name))
            break

    # Parse pagecast file(s) -- live in <folder>/script/ (falls back to folder
    # root for any book not yet migrated to the script/ layout)
    genre = ""
    scenes = []
    if args.pagecast:
        genre, scenes = parse_pagecast(Path(args.pagecast))
    else:
        script_dir = folder / "script"
        pagecast_dir = script_dir if script_dir.exists() else folder
        for pf in sorted(pagecast_dir.glob("*_pagecast.txt")):
            g, sc = parse_pagecast(pf)
            if not genre:
                genre = g
            scenes.extend(sc)

    if not scenes:
        print("Error: no scenes found. Check --folder or --pagecast path.")
        sys.exit(1)

    if args.mode == "characters":
        if args.backend != "comfyui":
            print("Error: --mode characters requires --backend comfyui (character model "
                  "sheets need a real ComfyUI render, not a text-to-image API call).")
            sys.exit(1)
        print()
        print("Book    : {}".format(folder.name))
        print("Mode    : character model sheets -> {}".format(char_refs_dir))
        print("Backend : ComfyUI (local GPU)")
        print("URL     : {}".format(args.comfyui_url))
        print("Model   : {}".format(args.comfyui_model))
        print()
        generate_character_portraits(
            folder, scenes, prompts_data, _all_refs,
            args.comfyui_url, args.comfyui_model, args.overwrite, args.debug,
        )
        return

    # Resolve style from genre if not already set
    genre_style = detect_style(genre)
    final_style = style_override if style_override else genre_style

    print()
    print("Book    : {}".format(folder.name))
    print("Genre   : {}".format(genre or "(unknown)"))
    print("Style   : {}".format(final_style[:60]))
    if args.backend == "hf":
        print("Backend : HuggingFace Inference API")
        print("Model   : {} ({})".format(hf_model_id, args.hf_model))
    elif args.backend == "comfyui":
        print("Backend : ComfyUI (local GPU)")
        print("URL     : {}".format(args.comfyui_url))
        print("Model   : {}".format(args.comfyui_model))
    else:
        print("Backend : Pollinations.ai")
        print("Model   : {}".format(args.model))
    print("Scenes  : {}".format(len(scenes)))
    print("Output  : {}".format(images_dir))
    if prompts_data:
        print("Prompts : {} blocks loaded".format(len(prompts_data)))
    print()

    # Cover image
    cover_out = folder / "cover.jpg"
    if "cover" in prompts_data:
        cover_block    = prompts_data["cover"]
        cover_prompt   = cover_block.get("prompt", "")
        cover_negative = cover_block.get("negative", "")
        if cover_prompt:
            if cover_out.exists() and not args.overwrite:
                print("cover.jpg  [exists -- skipping]")
            else:
                print("cover.jpg  Generating cover image...")
                if args.backend == "hf":
                    ok = download_image_hf(
                        prompt=cover_prompt,
                        dest_path=cover_out,
                        width=768,
                        height=1024,
                        hf_token=args.hf_token,
                        hf_model_id=hf_model_id,
                        debug=args.debug,
                    )
                    time.sleep(HF_RATE_LIMIT_DELAY)
                elif args.backend == "comfyui":
                    ok = download_image_comfyui(
                        prompt=cover_prompt,
                        dest_path=cover_out,
                        width=768,
                        height=1024,
                        comfyui_url=args.comfyui_url,
                        model_name=args.comfyui_model,
                        char_refs=None,
                        identity_mode=args.identity_mode,
                        face_detail=not args.no_face_detail,
                        debug=args.debug,
                    )
                else:
                    ok = download_image(
                        prompt=cover_prompt,
                        dest_path=cover_out,
                        width=768,
                        height=1024,
                        api_key=args.key,
                        model=args.model,
                        extra_negative=cover_negative,
                        debug=args.debug,
                    )
                    time.sleep(RATE_LIMIT_DELAY)
                if ok:
                    print("cover.jpg  Saved ({})".format(cover_out))
                else:
                    print("cover.jpg  Failed")
    print()

    # Scene images
    ok_count   = 0
    skip_count = 0
    fail_count = 0

    for scene in scenes:
        ch  = scene["chapter_num"]
        sc  = scene["scene_num"]
        key = "Ch{}Sc{}".format(ch, sc)

        if key in prompts_data:
            block     = prompts_data[key]
            prompt    = block.get("prompt", "")
            extra_neg = block.get("negative", "")
            slug      = block.get("slug", scene["slug"])
        else:
            prompt    = build_image_prompt(scene, final_style)
            extra_neg = ""
            slug      = scene["slug"]

        fname = "ch{}_sc{}_{}.jpg".format(ch, sc, slug)
        dest  = images_dir / fname
        label = "Ch{} Sc{} {}".format(ch, sc, scene["scene_title"][:40])

        if dest.exists() and not args.overwrite:
            print("{}  [exists -- skipping]".format(label))
            skip_count += 1
            continue

        print("{}  Generating...".format(label))
        if not prompt:
            print("  Warning: empty prompt -- skipping")
            fail_count += 1
            continue

        if args.backend == "hf":
            ok = download_image_hf(
                prompt=prompt,
                dest_path=dest,
                width=args.width,
                height=args.height,
                hf_token=args.hf_token,
                hf_model_id=hf_model_id,
                debug=args.debug,
            )
            time.sleep(HF_RATE_LIMIT_DELAY)
        elif args.backend == "comfyui":
            # _all_refs: {char_name: Path} merged from book + series dirs
            scene_char_refs = {
                name: str(_all_refs[name])
                for name in scene.get("characters", [])[:2]
                if name in _all_refs
            }
            prop_name, prop_path = _resolve_prop_for_scene(scene, _all_props)
            if prop_path and args.debug:
                print("    Prop match: {} -> {}".format(prop_name, prop_path))
            ok = download_image_comfyui(
                prompt=prompt,
                dest_path=dest,
                width=args.width,
                height=args.height,
                comfyui_url=args.comfyui_url,
                model_name=args.comfyui_model,
                char_refs=scene_char_refs if scene_char_refs else None,
                prop_ref_path=prop_path,
                identity_mode=args.identity_mode,
                instantid_model=args.instantid_model,
                instantid_controlnet=args.instantid_controlnet,
                instantid_provider=args.instantid_provider,
                face_detail=not args.no_face_detail,
                force_workflow=args.force_workflow or None,
                debug=args.debug,
            )
        else:
            ok = download_image(
                prompt=prompt,
                dest_path=dest,
                width=args.width,
                height=args.height,
                api_key=args.key,
                model=args.model,
                extra_negative=extra_neg,
                debug=args.debug,
            )
            time.sleep(RATE_LIMIT_DELAY)

        if ok:
            print("  Saved: {}".format(fname))
            ok_count += 1
        else:
            fail_count += 1

        args.debug = False  # Only print debug info for first image

    print()
    print("Done. Generated: {}  Skipped: {}  Failed: {}".format(ok_count, skip_count, fail_count))


if __name__ == "__main__":
    main()
