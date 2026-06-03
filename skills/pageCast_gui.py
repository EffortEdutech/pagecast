#!/usr/bin/env python3
"""
pageCast Image Pipeline GUI
Run:  python skills/pageCast_gui.py
Open: http://localhost:7823
"""

PORT       = 7823
ROOT       = __import__('pathlib').Path(__file__).parent.parent
CASTS_DIR  = ROOT / '.casts'
SKILLS_DIR = __import__('pathlib').Path(__file__).parent

import http.server, json, mimetypes, os, queue, re, socketserver
import subprocess, sys, threading, time
from pathlib import Path
from urllib.parse import urlparse, parse_qs, unquote
import urllib.parse, urllib.request

# ---------- Settings --------------------------------------------------------
SETTINGS_FILE = SKILLS_DIR / 'pageCast_settings.json'

def _init_settings():
    # Load settings JSON and override ROOT / CASTS_DIR if paths are configured
    global ROOT, CASTS_DIR
    if not SETTINGS_FILE.exists():
        return {}
    try:
        cfg = json.loads(SETTINGS_FILE.read_text(encoding='utf-8'))
        p   = cfg.get('paths', {})
        if p.get('root'):      ROOT      = Path(p['root'])
        if p.get('casts_dir'): CASTS_DIR = Path(p['casts_dir'])
        return cfg
    except Exception as e:
        print('Settings load warning:', e)
        return {}

_SETTINGS = _init_settings()

_ENV_PATH = ROOT / 'apps' / 'creator-studio' / '.env.local'
def _load_env_file():
    env = {}
    if _ENV_PATH.exists():
        for line in _ENV_PATH.read_text(encoding='utf-8', errors='replace').splitlines():
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, _, v = line.partition('=')
                env[k.strip()] = v.strip()
    return env

_ENV = _load_env_file()
SUPABASE_URL = _ENV.get('NEXT_PUBLIC_SUPABASE_URL', '')
SUPABASE_SERVICE_KEY = _ENV.get('SUPABASE_SERVICE_ROLE_KEY', '')

def _sb_enabled():
    return bool(SUPABASE_URL and SUPABASE_SERVICE_KEY)

def _sb_headers():
    return {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    }

def _sb_get(table, params):
    if not _sb_enabled():
        return []
    url = SUPABASE_URL + '/rest/v1/' + table + '?' + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=_sb_headers())
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read())

def _slugify_title(title):
    slug = re.sub(r'[^\w-]', '-', title.lower()).strip('-')
    return re.sub(r'-+', '-', slug)

_SB_BOOK_CACHE = {}
def _sb_book_for_slug(slug):
    if slug in _SB_BOOK_CACHE:
        return _SB_BOOK_CACHE[slug]
    if not _sb_enabled():
        _SB_BOOK_CACHE[slug] = None
        return None
    target = slug.split('/')[-1]
    try:
        books = _sb_get('books', {'select': 'id,title,author_id'})
    except Exception as e:
        print('Supabase book lookup warning:', e)
        _SB_BOOK_CACHE[slug] = None
        return None
    for b in books:
        if _slugify_title(b.get('title', '')) == target:
            _SB_BOOK_CACHE[slug] = b
            return b
    _SB_BOOK_CACHE[slug] = None
    return None

def _safe_speaker(name):
    return re.sub(r'[^a-z0-9_]+', '', name.lower().replace(' ', '_')) or 'narrator'

VOICE_TYPES = {'narration', 'dialogue', 'thought', 'quote'}


# ---------- State -----------------------------------------------------------
_gen_proc  = None
_gen_lock  = threading.Lock()
_sfx_proc  = None
_sfx_lock  = threading.Lock()
_sse_clients = []
_sse_lock  = threading.Lock()

def _broadcast(ev):
    with _sse_lock:
        dead = []
        for q in _sse_clients:
            try: q.put_nowait(ev)
            except: dead.append(q)
        for q in dead:
            try: _sse_clients.remove(q)
            except: pass

# ---------- HTTP Handler ----------------------------------------------------
class Handler(http.server.BaseHTTPRequestHandler):

    def do_GET(self):
        p  = urlparse(self.path)
        qs = parse_qs(p.query)
        rt = p.path
        try:
            if   rt == '/':              self._html(HTML.replace('/*BOOKS_JSON*/', json.dumps(list_books())))
            elif rt == '/api/books':     self._json(list_books())
            elif rt == '/api/book':      self._json(get_book(qs.get('slug',[''])[0]))
            elif rt == '/api/status':
                with _gen_lock:
                    running = _gen_proc is not None and _gen_proc.poll() is None
                self._json({'running': running})
            elif rt == '/api/events':    self._sse_loop()
            elif rt == '/api/file':      self._serve_file(qs.get('path',[''])[0])
            elif rt == '/api/workflows':   self._json(list_workflows())
            elif rt == '/api/sfx':         self._json(get_sfx_data(qs.get('slug',[''])[0]))
            elif rt == '/api/voice':       self._json(get_voice_data(qs.get('slug',[''])[0]))
            elif rt == '/api/manuscripts': self._json(get_manuscripts_data(qs.get('slug',[''])[0]))
            elif rt == '/api/script':      self._json(get_script_data(qs.get('slug',[''])[0]))
            elif rt == '/api/dashboard':   self._json(get_dashboard_data())
            elif rt == '/api/settings':    self._json(get_settings_api())
            elif rt == '/api/browse_folder': self._json({'path': browse_folder(qs.get('current',[''])[0])})
            elif rt == '/api/browse_debug':  self._json(browse_debug())
            else:                        self._send(404,'text/plain',b'Not found')
        except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
            pass  # client disconnected
        except Exception as e:
            import traceback; traceback.print_exc()
            try: self._send(500,'application/json',
                            json.dumps({'error': str(e)}).encode())
            except Exception: pass

    def do_POST(self):
        p = urlparse(self.path)
        n = int(self.headers.get('Content-Length', 0))
        body = json.loads(self.rfile.read(n)) if n else {}
        if   p.path == '/api/run':   self._json(start_generation(body))
        elif p.path == '/api/stop':        stop_generation(); self._json({'ok': True})
        elif p.path == '/api/run_sfx':     self._json(start_sfx_generation(body))
        elif p.path == '/api/stop_sfx':    stop_sfx_generation(); self._json({'ok': True})
        elif p.path == '/api/save_prompt':  self._json(save_prompt(body))
        elif p.path == '/api/save_char_prompt': self._json(save_char_prompt(body))
        elif p.path == '/api/settings':   self._json(save_settings_api(body))
        else:                        self._send(404,'text/plain',b'Not found')

    def _send(self, code, ctype, body):
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', len(body))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)

    def _html(self, s):
        body = s.encode()
        self.send_response(200)
        self.send_header('Content-Type',  'text/html; charset=utf-8')
        self.send_header('Content-Length', len(body))
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma',        'no-cache')
        self.send_header('Expires',       '0')
        self.end_headers()
        self.wfile.write(body)
    def _json(self, o): self._send(200, 'application/json', json.dumps(o).encode())

    def _serve_file(self, rel):
        full = (ROOT / unquote(rel)).resolve()
        if not str(full).startswith(str(ROOT.resolve())):
            self._send(403, 'text/plain', b'Forbidden'); return
        if not full.exists():
            self._send(404, 'text/plain', b'Not found'); return
        mime = mimetypes.guess_type(str(full))[0] or 'application/octet-stream'
        self._send(200, mime, full.read_bytes())

    def _sse_loop(self):
        q = queue.Queue()
        with _sse_lock: _sse_clients.append(q)
        self.send_response(200)
        self.send_header('Content-Type',  'text/event-stream')
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('Connection',    'keep-alive')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        try:
            while True:
                try:
                    ev = q.get(timeout=20)
                    self.wfile.write(('data: ' + json.dumps(ev) + '\n\n').encode())
                    self.wfile.flush()
                except queue.Empty:
                    self.wfile.write(b': ping\n\n'); self.wfile.flush()
        except Exception: pass
        finally:
            with _sse_lock:
                try: _sse_clients.remove(q)
                except ValueError: pass

    def log_message(self, *a): pass  # suppress request logs

# ---------- API Logic -------------------------------------------------------

def _book_type(folder):
    # 'series' if season-N subdirs present, 'pack' if subdirs contain txts, else 'book'
    subs = [d for d in folder.iterdir()
            if d.is_dir() and d.name.upper() != 'CHARACTER_REFS']
    if any(re.match(r'season-\d+', s.name, re.I) for s in subs):
        return 'series'
    if any(list(s.glob('*_pagecast.txt')) for s in subs):
        return 'pack'
    return 'book'

def _slug_folder(slug):
    # "hidden-heroes/season-1" -> .casts/hidden-heroes/season-1/
    # "glitch"                 -> .casts/glitch/
    parts = slug.split('/', 1)
    return CASTS_DIR / parts[0] / parts[1] if len(parts) == 2 else CASTS_DIR / parts[0]

def _name_key(name):
    return re.sub(r'[^a-z0-9]+', '', name.lower())

def _speaker_key(name):
    return _name_key(name.replace('_', ' '))

def _rel(path):
    return str(path.relative_to(ROOT)).replace('\\', '/')

def _character_prompt(name, folder, scenes):
    for suffix in ('.prompt.txt', '.txt', '.md'):
        p = folder / 'CHARACTER_REFS' / (name + suffix)
        if p.exists():
            return p.read_text(encoding='utf-8', errors='replace').strip()
    sample = ''
    for sc in scenes:
        if name in sc.get('characters', []):
            sample = '{} / {}'.format(sc.get('title', ''), sc.get('location', '')).strip(' /')
            break
    return 'Create a consistent character portrait/reference for {}. Use the script dialogue/thought tags and scene context{}; save the final image as CHARACTER_REFS/{}.png or .jpg.'.format(
        name, ' from ' + sample if sample else '', name)

def _supabase_voice_files(slug):
    book = _sb_book_for_slug(slug)
    if not book:
        return []
    book_id = book['id']
    try:
        chars_raw = _sb_get('characters', {
            'book_id': 'eq.' + book_id,
            'select': 'id,name',
            'order': 'sort_order',
        })
        chapters = _sb_get('chapters', {
            'book_id': 'eq.' + book_id,
            'select': 'id,title,sort_order',
            'order': 'sort_order',
        })
        scenes = _sb_get('scenes', {
            'book_id': 'eq.' + book_id,
            'select': 'id,chapter_id,title,sort_order',
            'order': 'sort_order',
        })
        blocks = _sb_get('blocks', {
            'book_id': 'eq.' + book_id,
            'select': 'id,scene_id,type,content,audio_url,sort_order',
            'order': 'sort_order',
        })
    except Exception as e:
        print('Supabase voice lookup warning:', e)
        return []

    chars = {c['id']: c for c in chars_raw}
    scenes_by_ch, blocks_by_sc = {}, {}
    for sc in scenes:
        scenes_by_ch.setdefault(sc['chapter_id'], []).append(sc)
    for b in blocks:
        blocks_by_sc.setdefault(b['scene_id'], []).append(b)

    files = []
    for ch_idx, chapter in enumerate(chapters, 1):
        ch_scenes = sorted(scenes_by_ch.get(chapter['id'], []), key=lambda s: s['sort_order'])
        for sc_idx, scene in enumerate(ch_scenes, 1):
            sc_blocks = sorted(blocks_by_sc.get(scene['id'], []), key=lambda b: b['sort_order'])
            for b_idx, block in enumerate(sc_blocks, 1):
                btype = block.get('type')
                content = block.get('content') or {}
                text = str(content.get('text', '')).strip()
                if btype not in VOICE_TYPES or not text or not block.get('audio_url'):
                    continue
                char_id = content.get('character_id')
                char = chars.get(str(char_id), {}) if char_id else {}
                speaker = char.get('name', 'Narrator')
                fname = 'Ch{:02d}_Sc{:02d}_{:03d}_{}_{}.mp3'.format(
                    ch_idx, sc_idx, b_idx, btype, _safe_speaker(speaker))
                files.append({
                    'fname': fname,
                    'key': 'Ch{}Sc{}'.format(ch_idx, sc_idx),
                    'line': b_idx,
                    'type': btype,
                    'speaker': _safe_speaker(speaker),
                    'path': block['audio_url'],
                    'size': 0,
                    'format': 'mp3',
                    'source': 'supabase',
                    'block_id': block.get('id'),
                })
    return files

def get_character_data(slug, folder, scenes, char_refs):
    """Return script-derived character production status."""
    chars = {}
    for txt in sorted(folder.glob('*_pagecast.txt')):
        text = txt.read_text(encoding='utf-8', errors='replace')
        sc_list = list(re.compile(r'^##\s+(?:Scene|Adegan|Babak|Castlet|Sc)\s+(\d+)', re.M | re.I).finditer(text))
        def _scene_label(pos):
            sc = 1
            for m in reversed(sc_list):
                if m.start() <= pos:
                    sc = int(m.group(1)); break
            return 'Sc{}'.format(sc)
        for kind in ('DIALOGUE', 'THOUGHT'):
            for m in re.finditer(r'^\[' + kind + r':\s*([^|\]]+)', text, re.M | re.I):
                name = m.group(1).strip()
                if not name:
                    continue
                key = _name_key(name)
                if key not in chars:
                    chars[key] = {'name': name, 'dialogue': 0, 'thought': 0, 'scenes': []}
                field = kind.lower()
                chars[key][field] += 1
                lbl = _scene_label(m.start())
                if lbl not in chars[key]['scenes']:
                    chars[key]['scenes'].append(lbl)

    voice_counts = {}
    remote_voice = _supabase_voice_files(slug)
    for vf in remote_voice:
        speaker = _speaker_key(vf.get('speaker', ''))
        voice_counts[speaker] = voice_counts.get(speaker, 0) + 1

    voice_dir = folder / 'voice'
    if voice_dir.exists() and not remote_voice:
        pat = re.compile(r'Ch\d+_Sc\d+_\d+_([A-Za-z]+)_(.+?)\.(?:wav|mp3)', re.I)
        for f in sorted(list(voice_dir.glob('*.wav')) + list(voice_dir.glob('*.mp3'))):
            m = pat.match(f.name)
            if not m:
                continue
            speaker = _speaker_key(m.group(2))
            voice_counts[speaker] = voice_counts.get(speaker, 0) + 1

    result = []
    for key, c in sorted(chars.items(), key=lambda kv: kv[1]['name'].lower()):
        ref = char_refs.get(c['name']) or char_refs.get(key)
        c['image'] = ref
        c['image_status'] = 'ready' if ref else 'missing'
        c['voice_count'] = voice_counts.get(key, 0)
        c['voice_status'] = 'ready' if c['voice_count'] else 'missing'
        c['prompt'] = _character_prompt(c['name'], folder, scenes)
        c['prompt_status'] = 'draft' if c['prompt'] else 'missing'
        c['scene_count'] = len(c['scenes'])
        result.append(c)
    return result

def _book_entry(slug, folder):
    txts    = list(folder.glob('*_pagecast.txt'))
    img_dir = folder / 'images'
    n_img   = len(list(img_dir.glob('*.jpg'))) if img_dir.exists() else 0
    n_sc    = sum(len(re.findall(r'^## Scene',
                                  f.read_text(encoding='utf-8', errors='replace'),
                                  re.M | re.I)) for f in txts)
    cover   = '.casts/{}/cover.jpg'.format(slug) if (folder / 'cover.jpg').exists() else None
    parts   = slug.split('/', 1)
    if len(parts) == 2:
        parent = parts[0].replace('-', ' ').title()
        child  = re.sub(r'season-(\d+)', r'Season \1', parts[1], flags=re.I)
        child  = child.replace('-', ' ').title()
        title  = '{} — {}'.format(parent, child)
        group  = parent
    else:
        title  = parts[0].replace('-', ' ').title()
        group  = ''
    return {'slug': slug, 'title': title, 'group': group,
            'scenes': n_sc, 'images': n_img, 'cover': cover}

def list_books():
    books = []
    if not CASTS_DIR.exists(): return books
    for d in sorted(CASTS_DIR.iterdir()):
        if not d.is_dir() or d.name.upper() == 'CHARACTER_REFS': continue
        btype = _book_type(d)
        if btype == 'book':
            if list(d.glob('*_pagecast.txt')):
                books.append(_book_entry(d.name, d))
        else:
            # series or pack — each child sub-folder is a selectable item
            for sub in sorted(
                (s for s in d.iterdir()
                 if s.is_dir() and s.name.upper() != 'CHARACTER_REFS'
                 and list(s.glob('*_pagecast.txt'))),
                key=lambda x: x.name
            ):
                books.append(_book_entry(d.name + '/' + sub.name, sub))
    return books


def get_book(slug):
    folder = _slug_folder(slug)
    if not folder.exists(): return {'error': 'not found'}
    prompts_data = {}
    for pf in folder.glob('*_image_prompts.txt'):
        prompts_data = _read_prompts(pf); break

    genre  = ''
    scenes = []
    for txt in sorted(folder.glob('*_pagecast.txt')):
        text = txt.read_text(encoding='utf-8', errors='replace')
        gm = re.search(r'^Genre:\s*(.+)$', text, re.M | re.I)
        if gm and not genre: genre = gm.group(1).strip()

        ch_pat = re.compile(r'^#\s+(?:Chapter|Bab|CHAPTER|Episode|Castlet|Ep)\s+(\d+)[:\s](.*)$', re.M | re.I)
        sc_pat = re.compile(r'^##\s+(?:Scene|Adegan|Babak|Castlet|Sc)\s+(\d+)[:\s](.*)$',         re.M | re.I)
        ch_list = list(ch_pat.finditer(text))
        sc_list = list(sc_pat.finditer(text))
        cur_ch  = 1
        for i, sm in enumerate(sc_list):
            sc_num, sc_title, sc_start = int(sm.group(1)), sm.group(2).strip(), sm.start()
            for cm in reversed(ch_list):
                if cm.start() < sc_start: cur_ch = int(cm.group(1)); break
            sc_end = sc_list[i+1].start() if i+1 < len(sc_list) else len(text)
            block  = text[sc_start:sc_end]
            def meta(k, b=block):
                m = re.search(r'^'+k+r':\s*(.+)$', b, re.M | re.I)
                return m.group(1).strip() if m else ''
            chars = list(dict.fromkeys(
                m.group(1).strip() for m in re.finditer(r'\[DIALOGUE:\s*([^|]+)', block, re.I)
            ))[:2]
            key    = 'Ch{}Sc{}'.format(cur_ch, sc_num)
            prompt = prompts_data.get(key, {}).get('prompt', '') or \
                     '{} — {} — {}'.format(sc_title, meta('Location'), meta('Ambience'))
            sc_slug = re.sub(r'[^a-z0-9\s-]', '', sc_title.lower())
            sc_slug = re.sub(r'[\s-]+', '_', sc_slug).strip('_')[:50]
            fname   = 'ch{}_sc{}_{}.jpg'.format(cur_ch, sc_num, sc_slug)
            img_abs = folder / 'images' / fname
            img_rel = '.casts/{}/images/{}'.format(slug, fname) if img_abs.exists() else None
            scenes.append({'key': key, 'chapter': cur_ch, 'scene': sc_num,
                           'title': sc_title, 'location': meta('Location'),
                           'time': meta('Time'), 'ambience': meta('Ambience'),
                           'music': meta('Music'), 'characters': chars,
                           'prompt': prompt, 'image': img_rel, 'fname': fname})

    # Character refs: series-level (.casts/CHARACTER_REFS/) then book-level (overrides)
    char_refs, display_refs = {}, {}
    for ref_dir in (CASTS_DIR/'CHARACTER_REFS', folder/'CHARACTER_REFS'):
        if ref_dir.exists():
            for f in sorted(ref_dir.iterdir()):
                if f.suffix.lower() in ('.jpg','.jpeg','.png','.webp'):
                    rel = _rel(f)
                    char_refs[f.stem] = rel   # book overrides series
                    char_refs[_name_key(f.stem)] = rel
                    display_refs[f.stem] = rel

    return {'slug': slug, 'genre': genre, 'scenes': scenes,
            'char_refs': [{'name': k, 'path': v} for k, v in sorted(display_refs.items())],
            'characters': get_character_data(slug, folder, scenes, char_refs),
            'has_prompts': bool(prompts_data),
            'cover': '.casts/{}/cover.jpg'.format(slug) if (folder/'cover.jpg').exists() else None}


def _read_prompts(path):
    text = path.read_text(encoding='utf-8')
    result, cur_key, cur = {}, None, {}
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            if cur_key and cur: result[cur_key] = cur
            cur_key, cur = None, {}; continue
        m = re.match(r'^\[Ch(\d+)Sc(\d+)\]$', line)
        if m:
            if cur_key and cur: result[cur_key] = cur
            cur_key = 'Ch{}Sc{}'.format(m.group(1), m.group(2)); cur = {}; continue
        if line.lower() == '[cover]':
            if cur_key and cur: result[cur_key] = cur
            cur_key, cur = 'cover', {}; continue
        if '=' in line and cur_key:
            k, _, v = line.partition('='); cur[k.strip()] = v.strip()
    if cur_key and cur: result[cur_key] = cur
    return result


def start_generation(cfg):
    global _gen_proc
    with _gen_lock:
        if _gen_proc and _gen_proc.poll() is None:
            return {'error': 'already running'}
        slug   = cfg.get('slug', '')
        folder = _slug_folder(slug)
        if not folder.exists(): return {'error': 'folder not found: ' + slug}
        cmd = [sys.executable, str(SKILLS_DIR/'generate_images.py'),
               '--backend',    cfg.get('backend', 'comfyui'),
               '--folder',     str(folder),
               '--style-pick', str(cfg.get('style_pick', 2))]
        if cfg.get('overwrite'):     cmd.append('--overwrite')
        if cfg.get('comfyui_url'):   cmd += ['--comfyui-url',   cfg['comfyui_url']]
        if cfg.get('comfyui_model'): cmd += ['--comfyui-model', cfg['comfyui_model']]
        if cfg.get('hf_token'):      cmd += ['--hf-token',      cfg['hf_token']]
        if cfg.get('hf_model'):      cmd += ['--hf-model',      cfg['hf_model']]
        if cfg.get('width'):         cmd += ['--width',  str(cfg['width'])]
        if cfg.get('height'):        cmd += ['--height', str(cfg['height'])]
        if cfg.get('debug'):         cmd.append('--debug')
        if cfg.get('force_workflow'): cmd += ['--force-workflow', cfg['force_workflow']]
        _gen_proc = subprocess.Popen(cmd, stdout=subprocess.PIPE,
                                     stderr=subprocess.STDOUT, text=True, bufsize=1)
        threading.Thread(target=_stream_output, args=(_gen_proc, slug), daemon=True).start()
        return {'ok': True, 'pid': _gen_proc.pid}


def stop_generation():
    global _gen_proc
    with _gen_lock:
        if _gen_proc and _gen_proc.poll() is None: _gen_proc.terminate()


def _stream_sfx_output(proc):
    for raw in proc.stdout:
        line = raw.rstrip()
        _broadcast({'type': 'sfx_log', 'text': line})
    _broadcast({'type': 'sfx_log', 'text': '── done ──', 'done': True})


def start_sfx_generation(cfg):
    global _sfx_proc
    with _sfx_lock:
        if _sfx_proc and _sfx_proc.poll() is None:
            return {'error': 'already running'}
        slug   = cfg.get('slug', '')
        folder = _slug_folder(slug)
        if not folder.exists(): return {'error': 'folder not found: ' + slug}
        api_key = cfg.get('api_key', '').strip()
        if not api_key: return {'error': 'ElevenLabs API key is required'}
        cmd = [sys.executable,
               str(SKILLS_DIR.parent / 'scripts' / 'generate_elevenlabs_audio.py'),
               '--folder',  str(folder),
               '--api-key', api_key]
        if cfg.get('sfx_duration'):      cmd += ['--sfx-duration',      str(cfg['sfx_duration'])]
        if cfg.get('ambience_duration'): cmd += ['--ambience-duration', str(cfg['ambience_duration'])]
        _sfx_proc = subprocess.Popen(cmd, stdout=subprocess.PIPE,
                                     stderr=subprocess.STDOUT, text=True, bufsize=1)
        threading.Thread(target=_stream_sfx_output, args=(_sfx_proc,), daemon=True).start()
        return {'ok': True, 'pid': _sfx_proc.pid}


def stop_sfx_generation():
    global _sfx_proc
    with _sfx_lock:
        if _sfx_proc and _sfx_proc.poll() is None: _sfx_proc.terminate()


def list_workflows():
    # Return list of ComfyUI workflow JSON filenames (without extension)
    wf_dir_s = _SETTINGS.get('paths', {}).get('workflows_dir', '')
    wf_dir   = Path(wf_dir_s) if wf_dir_s else SKILLS_DIR / 'comfyui_workflows'
    if not wf_dir.exists():
        return []
    return [f.stem for f in sorted(wf_dir.glob('*.json'))]


def save_prompt(body):
    """Write an edited prompt back to the book's *_image_prompts.txt file."""
    slug   = body.get('slug', '')
    key    = body.get('key', '')
    prompt = body.get('prompt', '').strip()
    if not slug or not key or not prompt:
        return {'error': 'missing slug/key/prompt'}
    folder = _slug_folder(slug)
    if not folder.exists():
        return {'error': 'book not found'}
    files = list(folder.glob('*_image_prompts.txt'))
    if files:
        pf   = files[0]
        text = pf.read_text(encoding='utf-8')
    else:
        title = ''.join(w.capitalize() for w in slug.split('-'))
        pf    = folder / (title + '_image_prompts.txt')
        text  = ''
    block_pat = re.compile(r'^\[([A-Za-z0-9]+)\][ \t]*\n((?:(?!\[)[^\n]*\n)*)', re.M)
    blocks = {m.group(1): m.group(2) for m in block_pat.finditer(text)}
    old_block = blocks.get(key, '')
    if old_block:
        if 'prompt=' in old_block:
            new_block = re.sub(r'^prompt=.*$', 'prompt=' + prompt, old_block, flags=re.M)
        else:
            new_block = 'prompt={}\n'.format(prompt) + old_block
    else:
        new_block = 'prompt={}\n'.format(prompt)
    blocks[key] = new_block
    def _rewrite(m):
        k = m.group(1)
        return '[{}]\n{}'.format(k, blocks[k])
    new_text = block_pat.sub(_rewrite, text)
    if key not in blocks or key not in {m.group(1) for m in block_pat.finditer(text)}:
        new_text = new_text.rstrip('\n') + '\n\n[{}]\n{}'.format(key, new_block)
    pf.write_text(new_text, encoding='utf-8')
    return {'ok': True, 'file': pf.name}

def save_char_prompt(body):
    """Write an edited character prompt beside CHARACTER_REFS assets."""
    slug   = body.get('slug', '')
    name   = body.get('name', '').strip()
    prompt = body.get('prompt', '').strip()
    if not slug or not name or not prompt:
        return {'error': 'missing slug/name/prompt'}
    folder = _slug_folder(slug)
    if not folder.exists():
        return {'error': 'book not found'}
    safe = re.sub(r'[<>:"/\\\\|?*]+', '_', name).strip().strip('.')
    if not safe:
        return {'error': 'invalid character name'}
    ref_dir = folder / 'CHARACTER_REFS'
    ref_dir.mkdir(parents=True, exist_ok=True)
    pf = ref_dir / (safe + '.prompt.txt')
    pf.write_text(prompt + '\n', encoding='utf-8')
    return {'ok': True, 'file': _rel(pf)}


def _stream_output(proc, slug):
    cur_key = None
    for raw in proc.stdout:
        line = raw.rstrip()
        _broadcast({'type': 'log', 'text': line})
        m = re.match(r'Ch(\d+) Sc(\d+) ', line)
        if m:
            cur_key = 'Ch{}Sc{}'.format(m.group(1), m.group(2))
            _broadcast({'type': 'generating', 'key': cur_key})
        m2 = re.match(r'\s+Saved:\s+(\S+\.jpg)', line)
        if m2 and cur_key:
            fname   = m2.group(1)
            img_rel = '.casts/{}/images/{}'.format(slug, fname)
            _broadcast({'type': 'image_ready', 'key': cur_key, 'path': img_rel})
            cur_key = None
        if '[exists -- skipping]' in line and cur_key:
            _broadcast({'type': 'skipped', 'key': cur_key}); cur_key = None
        if re.search(r'Warning.*skip', line, re.I):
            _broadcast({'type': 'failed', 'key': cur_key})
        if 'cover.jpg  Saved' in line:
            _broadcast({'type': 'cover_ready', 'path': '.casts/{}/cover.jpg'.format(slug)})
    proc.wait()
    _broadcast({'type': 'done', 'exit_code': proc.returncode})


def get_sfx_data(slug):
    """Return SFX tags from scripts + which have downloaded files, grouped."""
    folder  = _slug_folder(slug)
    if not folder.exists(): return {'error': 'not found'}
    sfx_dir = folder / 'sfx'
    sfx_map = {}

    for txt in sorted(folder.glob('*_pagecast.txt')):
        text    = txt.read_text(encoding='utf-8', errors='replace')
        ch_list = list(re.compile(r'^#\s+(?:Chapter|CHAPTER|Bab|Episode|Castlet|Ep)\s+(\d+)', re.M|re.I).finditer(text))
        sc_list = list(re.compile(r'^##\s+(?:Scene|Adegan|Babak|Castlet|Sc)\s+(\d+)', re.M|re.I).finditer(text))
        ep_m   = re.search(r'[_-]Cl(\d+)[_-]', txt.name, re.I)
        ep_pfx = 'Cl{:02d}'.format(int(ep_m.group(1))) if ep_m else None
        def _key(pos):
            ch, sc = 1, 1
            for m in reversed(ch_list):
                if m.start() <= pos: ch = int(m.group(1)); break
            for m in reversed(sc_list):
                if m.start() <= pos: sc = int(m.group(1)); break
            key   = 'Ch{}Sc{}'.format(ch, sc)
            lbl   = '{}\u00b7Sc{}'.format(ep_pfx, sc) if ep_pfx else 'Ch{}\u00b7Sc{}'.format(ch, sc)
            return key, lbl
        for m in re.finditer(r'^\[SFX:\s*([^\]]+)\]', text, re.M):
            label = m.group(1).strip()
            key, lbl = _key(m.start())
            if label not in sfx_map:
                sfx_map[label] = {'label': label, 'scenes': [], 'has_file': False, 'file_path': None}
            if lbl not in sfx_map[label]['scenes']:
                sfx_map[label]['scenes'].append(lbl)

    for label, data in sfx_map.items():
        mp3 = sfx_dir / (label + '.mp3')
        if mp3.exists():
            data['has_file']  = True
            data['file_path'] = '.casts/{}/sfx/{}.mp3'.format(slug, label)

    return {'sfx':        sorted(sfx_map.values(), key=lambda x: x['label']),
            'total':      len(sfx_map),
            'downloaded': sum(1 for v in sfx_map.values() if v['has_file'])}


def get_voice_data(slug):
    """Return Supabase audio_url voices first, local MP3/WAV as fallback."""
    folder    = _slug_folder(slug)
    voice_dir = folder / 'voice'
    remote = _supabase_voice_files(slug)
    if remote:
        local_names = set()
        if voice_dir.exists():
            local_names = {f.name for f in list(voice_dir.glob('*.wav')) + list(voice_dir.glob('*.mp3'))}
        for item in remote:
            item['local_exists'] = item['fname'] in local_names
        return {'voice': remote, 'total': len(remote), 'source': 'supabase'}
    if not voice_dir.exists(): return {'voice': [], 'total': 0, 'source': 'local'}
    pat   = re.compile(r'Ch(\d+)_Sc(\d+)_(\d+)_([A-Za-z]+)_(.+?)\.(wav|mp3)', re.I)
    files = []
    for f in sorted(list(voice_dir.glob('*.wav')) + list(voice_dir.glob('*.mp3'))):
        m = pat.match(f.name)
        if m:
            files.append({'fname':   f.name,
                          'key':     'Ch{}Sc{}'.format(int(m.group(1)), int(m.group(2))),
                          'line':    int(m.group(3)),
                          'type':    m.group(4).lower(),
                          'speaker': m.group(5),
                          'format':  m.group(6).lower(),
                          'source':  'local',
                          'local_exists': True,
                          'path':    '.casts/{}/voice/{}'.format(slug, f.name),
                          'size':    round(f.stat().st_size / 1024)})
        else:
            files.append({'fname':   f.name, 'key': None, 'line': 0,
                          'type':    'unknown', 'speaker': 'unknown',
                          'format':  f.suffix.lower().lstrip('.'),
                          'source':  'local',
                          'local_exists': True,
                          'path':    '.casts/{}/voice/{}'.format(slug, f.name),
                          'size':    round(f.stat().st_size / 1024)})
    return {'voice': files, 'total': len(files), 'source': 'local'}


def get_manuscripts_data(slug):
    """Return .docx files for a book."""
    folder = _slug_folder(slug)
    if not folder.exists(): return {'manuscripts': []}
    return {'manuscripts': [{'name': f.name,
                              'path': '.casts/{}/{}'.format(slug, f.name),
                              'size': '{:.0f} KB'.format(f.stat().st_size / 1024)}
                             for f in sorted(folder.glob('*.docx'))]}


def get_script_data(slug):
    """Return parsed script blocks for the reader."""
    folder   = _slug_folder(slug)
    if not folder.exists(): return {'chapters': []}
    chapters = []
    for txt in sorted(folder.glob('*_pagecast.txt')):
        text = txt.read_text(encoding='utf-8', errors='replace')
        for ch_block in re.split(r'^(?=#(?!#)\s+\S)', text, flags=re.M):
            ch_block = ch_block.strip()
            if not ch_block: continue
            ch_m     = re.match(r'^#\s+(.+)$', ch_block, re.M)
            ch_title = ch_m.group(1).strip() if ch_m else txt.stem
            scenes   = []
            for sc_block in re.split(r'^(?=##(?!#)\s+\S)', ch_block, flags=re.M)[1:]:
                sc_m     = re.match(r'^##\s+(.+)$', sc_block, re.M)
                sc_title = sc_m.group(1).strip() if sc_m else 'Scene'
                sc_n_m   = re.search(r'(?:Scene|Adegan|Babak|Episode|Sc)\s+(\d+)', sc_title, re.I)
                sc_num   = int(sc_n_m.group(1)) if sc_n_m else 0
                blocks   = []
                for bm in re.finditer(r'^\[([^\]]+)\]\s*\n(.*?)(?=^\[|\Z)', sc_block, re.M|re.S):
                    tag, content = bm.group(1).strip(), bm.group(2).strip()
                    if content:
                        blocks.append({'tag':  tag,
                                       'type': tag.split(':')[0].strip().upper(),
                                       'content': content})
                if blocks: scenes.append({'title': sc_title, 'num': sc_num, 'blocks': blocks})
            if scenes: chapters.append({'title': ch_title, 'scenes': scenes})
    return {'chapters': chapters}


def get_dashboard_data():
    """Return production health stats for all books."""
    result = []
    for b in list_books():
        folder  = _slug_folder(b['slug'])
        sfx_tags, sfx_files = set(), set()
        sfx_dir  = folder / 'sfx'
        for txt in folder.glob('*_pagecast.txt'):
            t = txt.read_text(encoding='utf-8', errors='replace')
            sfx_tags.update(m.group(1).strip() for m in re.finditer(r'^\[SFX:\s*([^\]]+)\]', t, re.M))
        if sfx_dir.exists():
            sfx_files = {f.stem for f in sfx_dir.glob('*.mp3')}
        remote_voice = _supabase_voice_files(b['slug'])
        voice_dir = folder / 'voice'
        n_voice   = len(remote_voice) if remote_voice else (len(list(voice_dir.glob('*.wav')) + list(voice_dir.glob('*.mp3'))) if voice_dir.exists() else 0)
        result.append({
            **b,
            'img_pct':  round(b['images'] / b['scenes'] * 100) if b['scenes'] else 0,
            'sfx_tags': len(sfx_tags),
            'sfx_done': len(sfx_tags & sfx_files),
            'sfx_pct':  round(len(sfx_tags & sfx_files) / len(sfx_tags) * 100) if sfx_tags else 0,
            'voice':    n_voice,
            'docs':     len(list(folder.glob('*.docx'))),
        })
    return result

def browse_folder(start_path=''):
    # Open native folder picker via tkinter subprocess (topmost window).
    # Falls back to PowerShell if tkinter unavailable.
    init = start_path if start_path else 'C:\\'
    tk_script = '\n'.join([
        'import tkinter, sys',
        'from tkinter import filedialog',
        'root = tkinter.Tk()',
        'root.withdraw()',
        'root.wm_attributes("-topmost", True)',
        'root.lift()',
        'root.focus_force()',
        'path = filedialog.askdirectory(initialdir=' + repr(init) + ', title="Select folder")',
        'root.destroy()',
        'print(path, end="")',
    ])
    try:
        r = subprocess.run([sys.executable, '-c', tk_script],
                          capture_output=True, text=True, timeout=120)
        if r.returncode == 0:
            return r.stdout.strip()
        raise RuntimeError(r.stderr.strip())
    except Exception as tk_err:
        # Fallback: PowerShell
        safe = start_path.replace("'", "''") if start_path else ''
        ps_init = ("$d.SelectedPath='" + safe + "';") if safe else ''
        ps = ('Add-Type -AssemblyName System.Windows.Forms;'
              '$d=New-Object System.Windows.Forms.FolderBrowserDialog;'
              '$d.Description="Select folder";'
              '$d.ShowNewFolderButton=$true;'
              + ps_init +
              '$r=$d.ShowDialog();if($r -eq "OK"){Write-Output $d.SelectedPath}')
        try:
            r2 = subprocess.run(['powershell', '-NoProfile', '-Command', ps],
                               capture_output=True, text=True, timeout=120)
            return r2.stdout.strip()
        except Exception as ps_err:
            return 'ERR:tk=' + str(tk_err) + ' ps=' + str(ps_err)



def browse_debug():
    # Diagnostic: returns what browse_folder would do without showing dialog
    import shutil
    ps_found = bool(shutil.which('powershell'))
    try:
        r = subprocess.run([sys.executable, '-c', 'import tkinter; print("ok")'],
                          capture_output=True, text=True, timeout=10)
        tk_ok = r.returncode == 0
        tk_err = r.stderr.strip()
    except Exception as e:
        tk_ok = False; tk_err = str(e)
    return {
        'python': sys.executable,
        'platform': sys.platform,
        'tkinter_ok': tk_ok,
        'tkinter_err': tk_err,
        'powershell_found': ps_found,
    }

def get_settings_api():
    # Return current settings merged with defaults
    cfg = {}
    if SETTINGS_FILE.exists():
        try: cfg = json.loads(SETTINGS_FILE.read_text(encoding='utf-8'))
        except: pass
    defaults = {
        'paths': {
            'root':          str(ROOT.resolve()),
            'casts_dir':     str(CASTS_DIR.resolve()),
            'workflows_dir': str(SKILLS_DIR / 'comfyui_workflows'),
            'char_refs_dir': str(CASTS_DIR / 'CHARACTER_REFS'),
        },
        'comfyui': {
            'url':   'http://localhost:8000',
            'model': 'juggernaut_xl_v9_lightning.safetensors',
        },
        'generation': {
            'backend': 'comfyui',
            'width':   1024,
            'height':  576,
            'style':   2,
        },
        'hf':        {'token': '', 'model': 'dev'},
        'freesound': {'api_key': ''},
    }
    result = {}
    for sec, vals in defaults.items():
        result[sec] = dict(vals)
        if sec in cfg and isinstance(cfg[sec], dict):
            result[sec].update(cfg[sec])
    return result


def save_settings_api(data):
    # Persist settings to JSON; flag path changes as requiring restart
    try:
        SETTINGS_FILE.write_text(
            json.dumps(data, indent=2, ensure_ascii=False), encoding='utf-8')
        paths_changed = any(
            str(data.get('paths', {}).get(k, '')).strip()
            for k in ('root', 'casts_dir', 'workflows_dir', 'char_refs_dir')
        )
        return {'ok': True, 'restart_required': paths_changed}
    except Exception as e:
        return {'error': str(e)}


# ---------- Embedded HTML ---------------------------------------------------
HTML = '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>pageCast Media Platform</title>\n<style>\n*{box-sizing:border-box;margin:0;padding:0}\n:root{\n  --bg:#0d1117;--surf:#161b22;--surf2:#21262d;--bord:#30363d;\n  --text:#e6edf3;--muted:#8b949e;--dim:#484f58;\n  --blue:#58a6ff;--green:#3fb950;--yellow:#d29922;--red:#f85149;\n  --purple:#bc8cff;\n  --sidebar:290px;\n}\nhtml,body{height:100%;overflow:hidden}\nbody{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;\n     background:var(--bg);color:var(--text);display:flex;flex-direction:column}\n\n/* ---- header ---- */\n.hdr{display:flex;align-items:center;justify-content:space-between;\n     padding:10px 18px;background:var(--surf);border-bottom:1px solid var(--bord);flex-shrink:0}\n.hdr-logo{font-size:15px;font-weight:600;letter-spacing:.02em}\n.hdr-logo span{color:var(--blue)}\n.hdr-r{display:flex;align-items:center;gap:14px}\n.hdr-sel{display:flex;align-items:center;gap:8px}\n.hdr-sel label{font-size:11px;color:var(--muted);white-space:nowrap}\nselect,input{background:var(--surf2);border:1px solid var(--bord);color:var(--text);\n             padding:5px 8px;border-radius:6px;font-size:12px;width:100%}\nselect:focus,input:focus{outline:none;border-color:var(--blue)}\n#bookSel{width:280px}\n.status-pill{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted)}\n.dot{width:8px;height:8px;border-radius:50%;background:var(--dim);flex-shrink:0}\n.dot.run{background:var(--green);box-shadow:0 0 6px var(--green);animation:pulse 1.2s infinite}\n.dot.done{background:var(--blue)}\n@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}\n\n/* ---- tab nav ---- */\n.tab-nav{display:flex;align-items:center;gap:2px;padding:6px 12px;\n         background:var(--surf);border-bottom:1px solid var(--bord);flex-shrink:0;\n         overflow-x:auto}\n.tab-btn{background:none;border:none;color:var(--muted);cursor:pointer;\n         padding:6px 12px;border-radius:6px;font-size:12px;font-weight:500;\n         transition:background .15s,color .15s;white-space:nowrap;display:flex;\n         align-items:center;gap:5px}\n.tab-btn:hover{background:var(--surf2);color:var(--text)}\n.tab-btn.active{background:var(--surf2);color:var(--blue)}\n.tbadge{font-size:10px;background:var(--bg);color:var(--dim);border-radius:8px;\n        padding:1px 5px;min-width:18px;text-align:center}\n.tab-btn.active .tbadge{background:rgba(88,166,255,.15);color:var(--blue)}\n\n/* ---- layout ---- */\n.layout{display:flex;flex:1;overflow:hidden}\n.sidebar{width:var(--sidebar);flex-shrink:0;background:var(--surf);\n         border-right:1px solid var(--bord);display:flex;flex-direction:column;\n         overflow-y:auto}\n.tab-content{flex:1;overflow:hidden;display:flex;flex-direction:column}\n\n/* ---- sidebar sections ---- */\n.sec{padding:14px;border-bottom:1px solid var(--bord)}\n.sec-ttl{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;\n         color:var(--muted);margin-bottom:10px}\nlabel{display:block;font-size:11px;color:var(--muted);margin:8px 0 3px}\n.bstats{display:flex;gap:8px;margin-bottom:10px}\n.bstat{flex:1;background:var(--surf2);border-radius:6px;padding:6px 8px;text-align:center}\n.bstat-n{font-size:18px;font-weight:700;color:var(--blue)}\n.bstat-l{font-size:9px;color:var(--dim);margin-top:1px}\n.refs{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}\n.ref-card{cursor:pointer;border-radius:6px;overflow:hidden;width:56px}\n.ref-card img{width:56px;height:56px;object-fit:cover;display:block}\n.rname{font-size:8px;color:var(--muted);text-align:center;padding:2px;\n       white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.no-refs{font-size:11px;color:var(--dim)}\n.chk-row{display:flex;align-items:center;gap:7px;margin-top:8px;font-size:12px}\n.chk-row input{width:auto}\n.wf-note{font-size:10px;color:var(--dim);margin-top:6px;line-height:1.5;\n         background:rgba(88,166,255,.06);border-radius:5px;padding:7px 9px}\n.btn-row{display:flex;padding:12px 14px;gap:8px;border-top:1px solid var(--bord)}\n.btn{padding:8px 14px;border:none;border-radius:6px;font-size:12px;font-weight:600;\n     cursor:pointer;transition:opacity .15s}\n.btn:disabled{opacity:.35;cursor:not-allowed}\n.btn-run{background:var(--green);color:#000}\n.btn-run:hover:not(:disabled){opacity:.85}\n.btn-stop{background:var(--red);color:#fff}\n.btn-stop:hover:not(:disabled){opacity:.85}\n\n/* ---- tab panes ---- */\n.tab-pane{display:none;flex:1;overflow:hidden;flex-direction:column}\n.tab-pane.active{display:flex}\n\n/* ---- images tab ---- */\n.scenes{flex:1;overflow-y:auto;padding:14px;display:grid;\n        grid-template-columns:repeat(auto-fill,minmax(230px,1fr));\n        align-content:start;gap:12px}\n.empty{color:var(--dim);font-size:13px;padding:40px;text-align:center;\n       grid-column:1/-1}\n.ch-group{grid-column:1/-1}\n.ch-lbl{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;\n        color:var(--muted);padding:4px 0;margin-bottom:8px;border-bottom:1px solid var(--bord)}\n.scene-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}\n.card{background:var(--surf);border:1px solid var(--bord);border-radius:8px;overflow:hidden;\n      transition:border-color .15s}\n.card:hover{border-color:var(--blue)}\n.img-wrap{height:130px;overflow:hidden;background:var(--surf2);position:relative}\n.img-wrap img{width:100%;height:100%;object-fit:cover;cursor:zoom-in;display:block}\n.img-ph{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;\n        justify-content:center;gap:6px;color:var(--dim)}\n.ph-lbl{font-size:10px}\n.gen-overlay{position:absolute;inset:0;background:rgba(0,0,0,.45);\n             display:flex;align-items:center;justify-content:center}\n.spin{width:24px;height:24px;border:2px solid var(--bord);border-top-color:var(--blue);\n      border-radius:50%;animation:sp .7s linear infinite}\n@keyframes sp{to{transform:rotate(360deg)}}\n.cbody{padding:10px}\n.c-hdr{display:flex;align-items:baseline;gap:6px;margin-bottom:6px}\n.sc-num{font-size:10px;font-weight:700;background:rgba(88,166,255,.12);\n        color:var(--blue);padding:2px 6px;border-radius:4px}\n.sc-ttl{font-size:12px;font-weight:600;color:var(--text)}\n.meta-row{display:flex;flex-wrap:wrap;gap:3px;margin-bottom:5px}\n.mpill{background:var(--surf2);border:1px solid var(--bord);color:var(--muted);\n       font-size:9px;padding:1px 5px;border-radius:3px}\n.cpills{display:flex;flex-wrap:wrap;gap:3px;margin-bottom:5px}\n.cpill{background:rgba(188,140,255,.12);color:var(--purple);font-size:9px;\n       padding:1px 6px;border-radius:3px}\n.prompt-wrap{display:flex;align-items:flex-start;gap:4px;margin-top:4px}\n.prompt{font-size:10px;color:var(--dim);flex:1;line-height:1.4;\n        max-height:42px;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;\n        -webkit-line-clamp:3;-webkit-box-orient:vertical}\n.edit-btn{background:none;border:none;color:var(--dim);cursor:pointer;font-size:12px;\n          padding:2px 4px;border-radius:3px;flex-shrink:0}\n.edit-btn:hover{color:var(--blue);background:rgba(88,166,255,.1)}\n.sbadge{font-size:9px;font-weight:600;padding:2px 6px;border-radius:4px;margin-top:5px;\n        display:inline-block}\n.s-pend{background:rgba(72,79,88,.3);color:var(--dim)}\n.s-gen{background:rgba(63,185,80,.15);color:var(--green)}\n.s-done{background:rgba(88,166,255,.15);color:var(--blue)}\n.s-skip{background:rgba(210,153,34,.15);color:var(--yellow)}\n.s-fail{background:rgba(248,81,73,.15);color:var(--red)}\n\n/* ---- log ---- */\n.log{height:160px;flex-shrink:0;display:flex;flex-direction:column;\n     border-top:1px solid var(--bord)}\n.log-hdr{display:flex;align-items:center;justify-content:space-between;\n         padding:6px 14px;background:var(--surf);border-bottom:1px solid var(--bord);\n         font-size:11px;font-weight:600;color:var(--muted)}\n.log-clr{background:none;border:none;color:var(--dim);cursor:pointer;font-size:11px}\n.log-body{flex:1;overflow-y:auto;padding:8px 14px;font-size:11px;font-family:monospace}\n.ll{padding:1px 0;line-height:1.5}\n.ll.ok{color:var(--green)}.ll.err{color:var(--red)}.ll.warn{color:var(--yellow)}\n.ll.inf{color:var(--blue)}\n\n/* ---- audio shared ---- */\n.audio-btn{background:var(--surf2);border:1px solid var(--bord);color:var(--blue);\n           cursor:pointer;border-radius:5px;padding:3px 8px;font-size:12px;\n           transition:background .15s;flex-shrink:0}\n.audio-btn:hover{background:rgba(88,166,255,.1)}\n.audio-btn.playing{color:var(--yellow);border-color:var(--yellow)}\n.waveform{display:inline-block;vertical-align:middle;border-radius:3px;\n          background:rgba(255,255,255,.03);flex-shrink:0}\n\n/* ---- sfx tab ---- */\n.sfx-wrap{flex:1;display:flex;flex-direction:column;overflow:hidden}\n.sfx-bar{padding:8px 14px;background:var(--surf);border-bottom:1px solid var(--bord);\n         font-size:11px;color:var(--muted);flex-shrink:0;display:flex;\n         align-items:center;justify-content:space-between}\n.sfx-table-wrap{flex:1;overflow-y:auto}\n.sfx-table{width:100%;border-collapse:collapse;font-size:12px}\n.sfx-table th{text-align:left;padding:8px 10px;background:var(--surf2);\n              color:var(--muted);font-weight:500;border-bottom:1px solid var(--bord);\n              position:sticky;top:0;z-index:2}\n.sfx-table td{padding:6px 10px;border-bottom:1px solid rgba(48,54,61,.4);\n              vertical-align:middle}\n.sfx-table tr:hover td{background:rgba(255,255,255,.02)}\n.sfx-miss{color:var(--red);font-size:10px;font-weight:600;\n          background:rgba(248,81,73,.1);padding:2px 6px;border-radius:4px}\n.sfx-ok{color:var(--green);font-size:10px;font-weight:600}\n.sortable{cursor:pointer;user-select:none}\n.sortable:hover{color:var(--blue)}\n.sfx-sc{display:inline-block;background:rgba(88,166,255,.12);color:var(--blue);\n        border-radius:4px;padding:1px 5px;font-size:9px;margin:1px}\n\n/* ---- voice tab ---- */\n.voice-wrap{flex:1;display:flex;flex-direction:column;overflow:hidden}\n.voice-bar{padding:8px 14px;background:var(--surf);border-bottom:1px solid var(--bord);\n           font-size:11px;color:var(--muted);flex-shrink:0}\n.voice-list{flex:1;overflow-y:auto;padding:10px 14px}\n.voice-grp{margin-bottom:16px}\n.voice-grp-hdr{font-size:10px;font-weight:700;color:var(--muted);\n               text-transform:uppercase;letter-spacing:.08em;\n               padding:4px 0;margin-bottom:4px;border-bottom:1px solid var(--bord)}\n.voice-row{display:flex;align-items:center;gap:8px;padding:5px 6px;\n           border-radius:6px;transition:background .1s}\n.voice-row:hover{background:var(--surf2)}\n.vtype{font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px;\n       text-transform:uppercase;letter-spacing:.04em;min-width:66px;text-align:center}\n.vtype.narration{background:rgba(88,166,255,.15);color:var(--blue)}\n.vtype.dialogue{background:rgba(63,185,80,.15);color:var(--green)}\n.vtype.thought{background:rgba(210,153,34,.15);color:var(--yellow)}\n.vtype.unknown{background:rgba(72,79,88,.3);color:var(--dim)}\n.vfname{font-size:11px;color:var(--muted);flex:1;\n        white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.vsize{font-size:10px;color:var(--dim);flex-shrink:0}\n\n/* ---- script reader ---- */\n.script-wrap{flex:1;display:flex;flex-direction:column;overflow:hidden}\n.script-nav{display:flex;align-items:center;gap:8px;padding:8px 14px;\n            background:var(--surf);border-bottom:1px solid var(--bord);flex-shrink:0}\n.script-nav select{width:auto}\n.script-body{flex:1;overflow-y:auto;padding:20px 28px;max-width:840px}\n.sblk{margin-bottom:9px;line-height:1.65}\n.sblk-narr{color:var(--muted);font-style:italic;font-size:13px}\n.sblk-dial{display:flex;gap:10px}\n.sblk-who{font-size:10px;font-weight:700;color:var(--blue);min-width:88px;\n          padding-top:2px;text-transform:uppercase;flex-shrink:0}\n.sblk-line{font-size:13px;color:var(--text)}\n.sblk-thought{color:var(--dim);font-style:italic;font-size:12px;\n              border-left:2px solid var(--dim);padding-left:8px}\n.sblk-sfx{display:inline-flex;align-items:center;gap:4px;\n          background:rgba(210,153,34,.1);color:var(--yellow);\n          border-radius:5px;padding:2px 8px;font-size:11px;font-weight:500}\n.sblk-pause{text-align:center;color:var(--dim);font-size:11px;padding:4px 0;\n            letter-spacing:.2em}\n.sblk-trans{text-align:center;color:var(--dim);font-size:10px;\n            border-top:1px solid var(--bord);margin:10px 0;padding-top:6px;\n            font-style:italic}\n\n/* ---- characters tab ---- */\n.chars-wrap{flex:1;overflow-y:auto;padding:16px;\n            display:flex;flex-wrap:wrap;gap:14px;align-content:flex-start}\n.char-card{background:var(--surf);border:1px solid var(--bord);border-radius:8px;\n           overflow:hidden;width:130px;cursor:pointer;transition:border-color .15s}\n.char-card:hover{border-color:var(--blue)}\n.char-card img{width:130px;height:150px;object-fit:cover;display:block}\n.char-cname{padding:6px 8px;font-size:11px;font-weight:600;text-align:center;\n            color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.char-csrc{font-size:9px;color:var(--dim);text-align:center;padding-bottom:6px}\n\n/* ---- manuscripts tab ---- */\n.docs-wrap{flex:1;overflow-y:auto;padding:16px}\n.doc-row{display:flex;align-items:center;gap:12px;padding:12px 14px;\n         background:var(--surf);border:1px solid var(--bord);border-radius:8px;\n         margin-bottom:8px;transition:border-color .15s}\n.doc-row:hover{border-color:var(--blue)}\n.doc-ico{font-size:26px;flex-shrink:0}\n.doc-name{font-size:13px;font-weight:500;color:var(--text);flex:1}\n.doc-sz{font-size:11px;color:var(--muted)}\n.doc-dl{color:var(--blue);font-size:12px;text-decoration:none;\n        background:rgba(88,166,255,.1);padding:4px 10px;border-radius:5px}\n.doc-dl:hover{background:rgba(88,166,255,.2)}\n\n/* ---- dashboard tab ---- */\n.dash-wrap{flex:1;overflow-y:auto;padding:16px}\n/* -- dash toolbar -- */\n.dash-toolbar{display:flex;align-items:center;justify-content:space-between;\n  margin-bottom:12px}\n.dash-view-btns{display:flex;gap:4px}\n.dv-btn{background:var(--surf2);border:1px solid var(--bord);color:var(--muted);\n  border-radius:6px;padding:5px 10px;cursor:pointer;font-size:12px}\n.dv-btn.active{border-color:var(--blue);color:var(--blue)}\n/* -- icons grid -- */\n.dash-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px}\n.bk-card{background:var(--surf);border:1px solid var(--bord);border-radius:8px;\n  overflow:hidden;cursor:pointer;transition:border-color .15s}\n.bk-card:hover{border-color:var(--blue)}\n.bk-cover-wrap{width:100%;padding-top:150%;position:relative;background:var(--surf2);overflow:hidden}\n.bk-cover-wrap img{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover}\n.bk-cover-ph{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);\n  font-size:36px;color:var(--dim)}\n.bk-ic-body{padding:8px 10px 10px}\n.bk-ic-title{font-size:12px;font-weight:600;line-height:1.35;margin-bottom:6px;\n  color:var(--text);word-break:break-word}\n.bk-ic-pills{display:flex;flex-wrap:wrap;gap:3px}\n.bk-ic-pill{font-size:10px;background:var(--surf2);border-radius:4px;padding:2px 5px;color:var(--muted)}\n.bk-ic-pill.ok{color:var(--green)}.bk-ic-pill.miss{color:var(--red)}\n/* -- details table -- */\n.dash-table{width:100%;border-collapse:collapse;font-size:12px}\n.dash-table th{text-align:left;padding:8px 10px;background:var(--surf2);color:var(--muted);\n  font-weight:500;border-bottom:1px solid var(--bord);position:sticky;top:0;z-index:1;\n  cursor:pointer;user-select:none;white-space:nowrap}\n.dash-table th:hover{color:var(--blue)}\n.dash-table td{padding:7px 10px;border-bottom:1px solid var(--bord);vertical-align:middle}\n.dash-table tr:hover td{background:rgba(88,166,255,.05);cursor:pointer}\n.dt-thumb{width:32px;height:46px;object-fit:cover;border-radius:3px;display:block;\n  background:var(--surf2)}\n.dt-thumb-ph{width:32px;height:46px;background:var(--surf2);border-radius:3px;\n  display:flex;align-items:center;justify-content:center;font-size:16px}\n.dt-title{font-weight:500;color:var(--text)}\n.dt-muted{color:var(--muted)}\n.pct-bar{height:4px;border-radius:2px;background:var(--surf2);width:60px;display:inline-block;vertical-align:middle;margin-right:4px}\n.pct-fill{height:100%;border-radius:2px}\n\n/* ---- prompt modal ---- */\n.pm{display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:100;\n    align-items:center;justify-content:center}\n.pm.open{display:flex}\n.pm-box{background:var(--surf);border:1px solid var(--bord);border-radius:10px;\n        width:580px;max-width:95vw;display:flex;flex-direction:column}\n.pm-hdr{display:flex;align-items:center;justify-content:space-between;\n        padding:12px 16px;border-bottom:1px solid var(--bord);font-size:13px;font-weight:600}\n.pm-hdr button{background:none;border:none;color:var(--muted);cursor:pointer;font-size:16px}\n.pm-ta{resize:vertical;background:var(--bg);border:none;border-bottom:1px solid var(--bord);\n       color:var(--text);padding:14px 16px;font-size:13px;font-family:inherit;\n       line-height:1.6;width:100%}\n.pm-foot{display:flex;align-items:center;padding:10px 14px;gap:8px}\n.pm-info{font-size:10px;color:var(--dim);flex:1}\n\n/* ---- lightbox ---- */\n.lb{display:none;position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:200;\n    align-items:center;justify-content:center}\n.lb.open{display:flex}\n.lb img{max-width:90vw;max-height:90vh;border-radius:6px;object-fit:contain}\n.lb-x{position:absolute;top:16px;right:20px;background:none;border:none;\n      color:#fff;font-size:26px;cursor:pointer;z-index:201}\n\n/* ---- empty states ---- */\n.tab-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;\n           height:100%;color:var(--dim);gap:10px;text-align:center;padding:40px}\n.tab-empty-ico{font-size:48px;opacity:.3}\n.tab-empty-txt{font-size:13px}\n/* ---- settings ---- */\n.settings-wrap{padding:24px 28px;max-width:780px;overflow-y:auto;height:100%}\n.settings-hdr{margin-bottom:20px}\n.settings-title{font-size:16px;font-weight:600;color:var(--text);margin-bottom:10px}\n.settings-banner{background:rgba(210,153,34,.15);border:1px solid var(--yellow);color:var(--yellow);border-radius:6px;padding:8px 12px;font-size:12px;margin-top:8px}\n.settings-sec{background:var(--surf);border:1px solid var(--bord);border-radius:8px;padding:18px 20px;margin-bottom:14px}\n.settings-sec-title{font-size:11px;font-weight:600;color:var(--blue);text-transform:uppercase;letter-spacing:.06em;margin-bottom:12px}\n.settings-grid{display:grid;grid-template-columns:200px 1fr;gap:9px 14px;align-items:center}\n.settings-label{font-size:12px;color:var(--muted);text-align:right;padding-right:4px}\n.settings-input{width:100%}\n.path-row{display:flex;gap:6px;align-items:center}\n.path-row .path-inp{flex:1;min-width:0}\n.btn-browse{background:var(--surf2);border:1px solid var(--bord);color:var(--text);border-radius:6px;padding:5px 10px;cursor:pointer;font-size:14px;flex-shrink:0;white-space:nowrap}\n.btn-browse:hover{border-color:var(--blue)}\n.settings-footer{display:flex;align-items:center;gap:14px;margin-top:8px}\n.btn-save-cfg{background:var(--blue);color:#000;border:none;padding:8px 22px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer}\n.btn-save-cfg:hover{opacity:.85}\n.settings-msg{font-size:12px;color:var(--green)}\n.settings-msg.err{color:var(--red)}\n\n</style>\n</head>\n<body>\n\n<!-- ═══ HEADER ═══ -->\n<div class="hdr">\n  <div class="hdr-logo">page<span>Cast</span> Media Platform</div>\n  <div class="hdr-r">\n    <div class="hdr-sel">\n      <label>Book</label>\n      <select id="bookSel" onchange="loadBook(this.value)">\n        <option value="">— select a book —</option>\n      </select>\n    </div>\n    <div class="status-pill">\n      <div class="dot done" id="dot"></div>\n      <span id="st-txt">Idle</span>\n    </div>\n  </div>\n</div>\n\n<!-- ═══ TAB NAV ═══ -->\n<div class="tab-nav">\n  <button class="tab-btn active" id="tb-images" onclick="switchTab(\'images\')">🖼️ Images <span class="tbadge" id="tbadge-images">0</span></button>\n  <button class="tab-btn" id="tb-sfx"    onclick="switchTab(\'sfx\')">🔊 SFX <span class="tbadge" id="tbadge-sfx">0</span></button>\n  <button class="tab-btn" id="tb-voice"  onclick="switchTab(\'voice\')">🎙️ Voice <span class="tbadge" id="tbadge-voice">0</span></button>\n  <button class="tab-btn" id="tb-script" onclick="switchTab(\'script\')">📜 Script</button>\n  <button class="tab-btn" id="tb-chars"  onclick="switchTab(\'chars\')">🎭 Characters <span class="tbadge" id="tbadge-chars">0</span></button>\n  <button class="tab-btn" id="tb-docs"   onclick="switchTab(\'docs\')">📄 Manuscripts <span class="tbadge" id="tbadge-docs">0</span></button>\n  <button class="tab-btn" id="tb-dash"   onclick="switchTab(\'dash\')">📊 Dashboard</button>\n  <button class="tab-btn" id="tb-settings" onclick="switchTab(\'settings\')">⚙️ Settings</button>\n</div>\n\n<!-- ═══ MAIN LAYOUT ═══ -->\n<div class="layout">\n\n  <!-- ── SIDEBAR ── -->\n  <div class="sidebar">\n    <div class="sec">\n      <div class="sec-ttl">Book</div>\n      <div class="bstats" id="bstats" style="display:none">\n        <div class="bstat"><div class="bstat-n" id="ns">0</div><div class="bstat-l">Scenes</div></div>\n        <div class="bstat"><div class="bstat-n" id="ni">0</div><div class="bstat-l">Images</div></div>\n        <div class="bstat"><div class="bstat-n" id="nr">0</div><div class="bstat-l">Chars</div></div>\n      </div>\n      <img id="coverImg" alt="Cover" style="display:none;width:100%;border-radius:7px;margin-top:6px;border:1px solid var(--bord);object-fit:cover;max-height:190px;cursor:pointer" onclick="openLb(this.src)">\n    </div>\n\n    <div class="sec" id="sidebar-default">\n      <div class="sec-ttl">Character references</div>\n      <div class="refs" id="refs"><div class="no-refs">Load a book first</div></div>\n    </div>\n\n    <!-- SFX sidebar shown only on SFX tab -->\n    <div class="sec" id="sidebar-sfx" style="display:none">\n      <div class="sec-ttl">SFX &amp; Ambience</div>\n      <div class="bstats" id="sfx-sidebar-stats" style="display:none">\n        <div class="bstat"><div class="bstat-n" id="sfx-sb-total">0</div><div class="bstat-l">SFX tags</div></div>\n        <div class="bstat"><div class="bstat-n" id="sfx-sb-done">0</div><div class="bstat-l">Generated</div></div>\n        <div class="bstat"><div class="bstat-n" id="sfx-sb-amb">0</div><div class="bstat-l">Ambience</div></div>\n      </div>\n      <div id="sfx-sb-empty" style="font-size:11px;color:var(--muted);margin-top:6px">Select a book to view SFX</div>\n    </div>\n\n    <div class="sec" id="sidebar-voice" style="display:none">\n      <div class="sec-ttl">Voice recordings</div>\n      <div class="bstats" id="voice-sidebar-stats" style="display:none">\n        <div class="bstat"><div class="bstat-n" id="voice-sb-total">0</div><div class="bstat-l">Total</div></div>\n        <div class="bstat"><div class="bstat-n" id="voice-sb-narr">0</div><div class="bstat-l">Narration</div></div>\n        <div class="bstat"><div class="bstat-n" id="voice-sb-dial">0</div><div class="bstat-l">Dialogue</div></div>\n      </div>\n      <div id="voice-sb-empty" style="font-size:11px;color:var(--muted);margin-top:6px">No recordings yet</div>\n    </div>\n\n    <div class="sec" id="sidebar-script" style="display:none">\n      <div class="sec-ttl">Script</div>\n      <div class="bstats" id="script-sidebar-stats" style="display:none">\n        <div class="bstat"><div class="bstat-n" id="script-sb-ch">0</div><div class="bstat-l">Chapters</div></div>\n        <div class="bstat"><div class="bstat-n" id="script-sb-sc">0</div><div class="bstat-l">Scenes</div></div>\n      </div>\n      <div id="script-sb-empty" style="font-size:11px;color:var(--muted);margin-top:6px">No script loaded</div>\n    </div>\n\n    <div class="sec" id="sidebar-chars" style="display:none">\n      <div class="sec-ttl">Characters</div>\n      <div class="bstats" id="chars-sidebar-stats" style="display:none;flex-wrap:wrap;gap:6px">\n        <div class="bstat"><div class="bstat-n" id="chars-sb-total">0</div><div class="bstat-l">Total</div></div>\n        <div class="bstat"><div class="bstat-n" id="chars-sb-img">0</div><div class="bstat-l">Image</div></div>\n        <div class="bstat"><div class="bstat-n" id="chars-sb-voice">0</div><div class="bstat-l">Voice</div></div>\n        <div class="bstat"><div class="bstat-n" id="chars-sb-prompt">0</div><div class="bstat-l">Prompt</div></div>\n      </div>\n      <div id="chars-sb-empty" style="font-size:11px;color:var(--muted);margin-top:6px">No characters found</div>\n    </div>\n\n    <div class="sec" id="sidebar-docs" style="display:none">\n      <div class="sec-ttl">Manuscripts</div>\n      <div class="bstats" id="docs-sidebar-stats" style="display:none">\n        <div class="bstat"><div class="bstat-n" id="docs-sb-total">0</div><div class="bstat-l">Files</div></div>\n      </div>\n      <div id="docs-sb-empty" style="font-size:11px;color:var(--muted);margin-top:6px">No .docx files found</div>\n    </div>\n\n    <div class="sec" id="sidebar-dash" style="display:none">\n      <div class="sec-ttl">Library</div>\n      <div class="bstats" id="dash-sidebar-stats" style="display:none">\n        <div class="bstat"><div class="bstat-n" id="dash-sb-books">0</div><div class="bstat-l">Books</div></div>\n        <div class="bstat"><div class="bstat-n" id="dash-sb-scenes">0</div><div class="bstat-l">Scenes</div></div>\n        <div class="bstat"><div class="bstat-n" id="dash-sb-images">0</div><div class="bstat-l">Images</div></div>\n      </div>\n    </div>\n\n    <div class="sec" id="sidebar-settings" style="display:none">\n      <div class="sec-ttl">Settings</div>\n      <div style="font-size:11px;color:var(--muted);line-height:1.6;margin-top:4px">Configure image backends, API keys, and file paths.</div>\n    </div>\n\n    <!-- Config section — only relevant for Images tab -->\n    <div class="sec" id="cfgSec">\n      <div class="sec-ttl">Configuration</div>\n      <label>Backend</label>\n      <select id="cBk" onchange="onBk()">\n        <option value="comfyui">ComfyUI (local GPU)</option>\n        <option value="pollinations">Pollinations.ai (free)</option>\n        <option value="hf">HuggingFace Inference</option>\n      </select>\n      <div id="wfRow">\n        <label>ComfyUI Workflow</label>\n        <select id="cWf">\n          <option value="">Auto (by character count)</option>\n        </select>\n        <div class="wf-note">0 chars → txt2img &nbsp;|&nbsp; 1 char → IPAdapter &nbsp;|&nbsp; 2 chars → dual IPAdapter</div>\n      </div>\n      <label>Style preset</label>\n      <select id="cSt">\n        <option value="1">Cinematic photo</option>\n        <option value="2" selected>Concept art</option>\n        <option value="3">Movie poster</option>\n        <option value="4">Oil painting</option>\n        <option value="5">Watercolour</option>\n        <option value="6">3D render</option>\n      </select>\n      <div id="cuiOpts">\n        <label>ComfyUI URL</label>\n        <input type="url" id="cUrl" value="http://localhost:8000">\n        <label>Model checkpoint</label>\n        <input type="text" id="cMdl" value="juggernaut_xl_v9_lightning.safetensors">\n      </div>\n      <div id="hfOpts" style="display:none">\n        <label>HuggingFace token</label>\n        <input type="text" id="cHfT" placeholder="hf_...">\n        <label>HF model</label>\n        <select id="cHfM">\n          <option value="dev">FLUX.1-dev (best quality)</option>\n          <option value="schnell">FLUX.1-schnell (fastest)</option>\n        </select>\n      </div>\n      <label>Width <small style="color:var(--dim)">(px)</small></label>\n      <input type="number" id="cW" value="1024" min="256" step="64">\n      <label>Height <small style="color:var(--dim)">(px)</small></label>\n      <input type="number" id="cH" value="576" min="256" step="64">\n      <div class="chk-row"><input type="checkbox" id="cOvr"><span>Overwrite existing images</span></div>\n      <div class="chk-row"><input type="checkbox" id="cDbg"><span>Debug output</span></div>\n      <div class="btn-row" id="btnRow">\n        <button class="btn btn-run"  id="btnRun"  onclick="runPipeline()" disabled>&#9654; Run</button>\n        <button class="btn btn-stop" id="btnStop" onclick="stopPipeline()" disabled>&#9632; Stop</button>\n      </div>\n    </div>\n  </div>\n\n  <!-- ── TAB CONTENT ── -->\n  <div class="tab-content">\n\n    <!-- IMAGES TAB -->\n    <div class="tab-pane active" id="tab-images">\n      <div class="scenes" id="scenes">\n        <div class="empty">Select a book from the sidebar to begin</div>\n      </div>\n      <div class="log">\n        <div class="log-hdr">\n          <span>Output log</span>\n          <button class="log-clr" onclick="clearLog()">Clear</button>\n        </div>\n        <div class="log-body" id="logBody"></div>\n      </div>\n    </div>\n\n    <!-- SFX TAB -->\n    <div class="tab-pane" id="tab-sfx">\n      <div class="sfx-wrap">\n        <div class="sfx-bar" id="sfx-bar">Select a book to view SFX</div>\n        <div class="sfx-generate-bar" style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--surf2);border-bottom:1px solid var(--bord);flex-wrap:wrap">\n          <input id="sfx-api-key" type="password" placeholder="ElevenLabs API key" style="flex:1;min-width:160px;padding:5px 8px;background:var(--surf);border:1px solid var(--bord);border-radius:4px;color:var(--text);font-size:12px">\n          <label style="font-size:11px;color:var(--muted);white-space:nowrap">SFX&nbsp;sec\n            <input id="sfx-dur-sfx" type="number" value="5" min="1" max="22" style="width:46px;padding:4px 6px;background:var(--surf);border:1px solid var(--bord);border-radius:4px;color:var(--text);font-size:12px">\n          </label>\n          <label style="font-size:11px;color:var(--muted);white-space:nowrap">Ambience&nbsp;sec\n            <input id="sfx-dur-amb" type="number" value="10" min="1" max="22" style="width:46px;padding:4px 6px;background:var(--surf);border:1px solid var(--bord);border-radius:4px;color:var(--text);font-size:12px">\n          </label>\n          <button id="sfx-gen-btn" onclick="runSfxGen()" style="padding:5px 14px;background:var(--accent);border:none;border-radius:4px;color:#fff;font-size:12px;cursor:pointer;white-space:nowrap">&#9654; Generate</button>\n          <button id="sfx-stop-btn" onclick="stopSfxGen()" style="display:none;padding:5px 14px;background:#c0392b;border:none;border-radius:4px;color:#fff;font-size:12px;cursor:pointer">&#9646; Stop</button>\n        </div>\n        <div class="sfx-table-wrap" id="sfx-content">\n          <div class="tab-empty"><div class="tab-empty-ico">🔊</div><div class="tab-empty-txt">No book selected</div></div>\n        </div>\n        <div id="sfx-log-wrap" style="display:none;max-height:180px;overflow-y:auto;background:var(--surf);border-top:1px solid var(--bord);padding:8px 12px;font-size:11px;font-family:monospace">\n          <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="color:var(--muted)">ElevenLabs output</span><button onclick="document.getElementById(\'sfx-log-body\').innerHTML=\'\'" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:11px">Clear</button></div>\n          <div id="sfx-log-body"></div>\n        </div>\n      </div>\n    </div>\n\n    <!-- VOICE TAB -->\n    <div class="tab-pane" id="tab-voice">\n      <div class="voice-wrap">\n        <div class="voice-bar" id="voice-bar">Select a book to view voice recordings</div>\n        <div class="voice-list" id="voice-content">\n          <div class="tab-empty"><div class="tab-empty-ico">🎙️</div><div class="tab-empty-txt">No book selected</div></div>\n        </div>\n      </div>\n    </div>\n\n    <!-- SCRIPT TAB -->\n    <div class="tab-pane" id="tab-script">\n      <div class="script-wrap">\n        <div class="script-nav">\n          <select id="script-ch" onchange="scriptChChange()" style="min-width:200px">\n            <option value="">Select a book first</option>\n          </select>\n          <select id="script-sc" onchange="scriptScChange()" style="min-width:160px">\n            <option value="">— scene —</option>\n          </select>\n        </div>\n        <div class="script-body" id="script-body">\n          <div class="tab-empty"><div class="tab-empty-ico">📜</div><div class="tab-empty-txt">Select a chapter and scene</div></div>\n        </div>\n      </div>\n    </div>\n\n    <!-- CHARACTERS TAB -->\n    <div class="tab-pane" id="tab-chars">\n      <div class="chars-wrap" id="chars-content">\n        <div class="tab-empty"><div class="tab-empty-ico">🎭</div><div class="tab-empty-txt">No book selected</div></div>\n      </div>\n    </div>\n\n    <!-- MANUSCRIPTS TAB -->\n    <div class="tab-pane" id="tab-docs">\n      <div class="docs-wrap" id="docs-content">\n        <div class="tab-empty"><div class="tab-empty-ico">📄</div><div class="tab-empty-txt">No book selected</div></div>\n      </div>\n    </div>\n\n    <!-- DASHBOARD TAB -->\n    <div class="tab-pane" id="tab-dash">\n      <div class="dash-wrap">\n        <div class="dash-toolbar">\n          <span style="font-size:12px;color:var(--muted)" id="dash-count"></span>\n          <div class="dash-view-btns">\n            <button class="dv-btn active" id="dvIcons" onclick="setDashView(\'icons\')">⊞ Icons</button>\n            <button class="dv-btn" id="dvDetails" onclick="setDashView(\'details\')">☰ Details</button>\n          </div>\n        </div>\n        <div id="dash-content">\n          <div class="tab-empty"><div class="tab-empty-ico">📊</div><div class="tab-empty-txt">Loading…</div></div>\n        </div>\n      </div>\n    </div>\n\n    <!-- ═══ SETTINGS TAB ═══ -->\n    <div class="tab-pane" id="tab-settings">\n      <div class="settings-wrap">\n        <div class="settings-hdr">\n          <h2 class="settings-title">⚙️ Settings</h2>\n          <div id="settings-banner" class="settings-banner" style="display:none">\n            ⚠️ Path changes require a server restart to take effect.\n          </div>\n        </div>\n\n        <!-- Folder Paths -->\n        <div class="settings-sec">\n          <div class="settings-sec-title">📁 Folder Paths</div>\n          <div class="settings-grid">\n            <label class="settings-label">Root folder</label>\n            <div class="path-row"><input type="text" id="cfg-root" class="settings-input path-inp"><button class="btn-browse" onclick="browseFolderFor(\'cfg-root\')">📂</button></div>\n            <label class="settings-label">Casts folder</label>\n            <div class="path-row"><input type="text" id="cfg-casts_dir" class="settings-input path-inp"><button class="btn-browse" onclick="browseFolderFor(\'cfg-casts_dir\')">📂</button></div>\n            <label class="settings-label">Workflows folder</label>\n            <div class="path-row"><input type="text" id="cfg-workflows_dir" class="settings-input path-inp"><button class="btn-browse" onclick="browseFolderFor(\'cfg-workflows_dir\')">📂</button></div>\n            <label class="settings-label">Character refs folder</label>\n            <div class="path-row"><input type="text" id="cfg-char_refs_dir" class="settings-input path-inp"><button class="btn-browse" onclick="browseFolderFor(\'cfg-char_refs_dir\')">📂</button></div>\n          </div>\n        </div>\n\n        <!-- ComfyUI -->\n        <div class="settings-sec">\n          <div class="settings-sec-title">🖥️ ComfyUI</div>\n          <div class="settings-grid">\n            <label class="settings-label">Server URL</label>\n            <input type="text" id="cfg-comfyui-url" class="settings-input">\n            <label class="settings-label">Default model</label>\n            <input type="text" id="cfg-comfyui-model" class="settings-input">\n          </div>\n        </div>\n\n        <!-- Generation Defaults -->\n        <div class="settings-sec">\n          <div class="settings-sec-title">🎨 Generation Defaults</div>\n          <div class="settings-grid">\n            <label class="settings-label">Backend</label>\n            <select id="cfg-gen-backend" class="settings-input">\n              <option value="comfyui">ComfyUI (local)</option>\n              <option value="hf">HuggingFace Inference</option>\n              <option value="pollinations">Pollinations.ai (free)</option>\n            </select>\n            <label class="settings-label">Width (px)</label>\n            <input type="number" id="cfg-gen-width" min="256" max="2048" step="64" class="settings-input">\n            <label class="settings-label">Height (px)</label>\n            <input type="number" id="cfg-gen-height" min="256" max="2048" step="64" class="settings-input">\n            <label class="settings-label">Style preset</label>\n            <select id="cfg-gen-style" class="settings-input">\n              <option value="0">0 — Cinematic</option>\n              <option value="1">1 — Anime</option>\n              <option value="2">2 — Digital Art</option>\n              <option value="3">3 — Photographic</option>\n              <option value="4">4 — Fantasy</option>\n            </select>\n          </div>\n        </div>\n\n        <!-- HuggingFace -->\n        <div class="settings-sec">\n          <div class="settings-sec-title">🤗 HuggingFace</div>\n          <div class="settings-grid">\n            <label class="settings-label">Access token</label>\n            <input type="password" id="cfg-hf-token" class="settings-input">\n            <label class="settings-label">Model variant</label>\n            <select id="cfg-hf-model" class="settings-input">\n              <option value="dev">dev</option>\n              <option value="schnell">schnell</option>\n            </select>\n          </div>\n        </div>\n\n        <!-- Freesound -->\n        <div class="settings-sec">\n          <div class="settings-sec-title">🔊 Freesound</div>\n          <div class="settings-grid">\n            <label class="settings-label">API key</label>\n            <input type="password" id="cfg-freesound-api_key" class="settings-input">\n          </div>\n        </div>\n\n        <!-- Save -->\n        <div class="settings-footer">\n          <button class="btn btn-save-cfg" onclick="saveSettings()">💾 Save Settings</button>\n          <span id="settings-msg" class="settings-msg"></span>\n        </div>\n      </div>\n    </div>\n\n  </div><!-- /tab-content -->\n</div><!-- /layout -->\n\n<!-- ── PROMPT MODAL ── -->\n<div class="pm" id="pm">\n  <div class="pm-box">\n    <div class="pm-hdr">\n      <span id="pm-title">Edit Prompt</span>\n      <button onclick="closePm()">&#x2715;</button>\n    </div>\n    <textarea class="pm-ta" id="pm-ta" rows="8" spellcheck="false"></textarea>\n    <div class="pm-foot">\n      <span class="pm-info" id="pm-info"></span>\n      <button class="btn btn-stop" style="background:var(--surf2);color:var(--muted)" onclick="closePm()">Cancel</button>\n      <button class="btn btn-run" id="pm-save" onclick="savePrompt()">&#10003; Save</button>\n    </div>\n  </div>\n</div>\n\n<!-- ── LIGHTBOX ── -->\n<div class="lb" id="lb" onclick="closeLb()">\n  <button class="lb-x" onclick="closeLb()">&#x2715;</button>\n  <img id="lbImg" src="" alt="">\n</div>\n\n<script>\n// ── Global state ────────────────────────────────────────────────────────────\nvar book=null, scData={}, scSt={}, sse=null, running=false;\nvar _activeTab=\'images\', _tabLoaded={}, _scriptData=null;\n\n// ── Audio engine ─────────────────────────────────────────────────────────────\nvar _audio={ctx:null,src:null,el:null,anlzr:null,rafId:null,btn:null,cvId:null};\n\nfunction playAudio(btn, filePath, cvId) {\n  // Toggle same button\n  if(_audio.btn===btn && _audio.el && !_audio.el.paused){\n    _audio.el.pause();\n    btn.textContent=\'▶\'; btn.classList.remove(\'playing\');\n    if(_audio.rafId){cancelAnimationFrame(_audio.rafId);_audio.rafId=null;}\n    _clearWave(cvId);\n    _audio.btn=null; return;\n  }\n  // Stop previous\n  if(_audio.el) _audio.el.pause();\n  if(_audio.btn){_audio.btn.textContent=\'▶\';_audio.btn.classList.remove(\'playing\');}\n  if(_audio.rafId){cancelAnimationFrame(_audio.rafId);_audio.rafId=null;}\n  if(_audio.cvId) _clearWave(_audio.cvId);\n\n  if(!_audio.ctx) _audio.ctx=new(window.AudioContext||window.webkitAudioContext)();\n\n  var a=new Audio(\'/api/file?path=\'+encodeURIComponent(filePath));\n  a.crossOrigin=\'anonymous\';\n  if(_audio.src){try{_audio.src.disconnect();}catch(e){}}\n  var src=_audio.ctx.createMediaElementSource(a);\n  var anlzr=_audio.ctx.createAnalyser(); anlzr.fftSize=128;\n  src.connect(anlzr); anlzr.connect(_audio.ctx.destination);\n  _audio.el=a; _audio.src=src; _audio.anlzr=anlzr; _audio.btn=btn; _audio.cvId=cvId;\n\n  btn.textContent=\'⏸\'; btn.classList.add(\'playing\');\n  var cv=document.getElementById(cvId);\n  if(cv) _drawWave(cv, anlzr);\n\n  a.play().catch(function(e){log2(\'Audio: \'+e.message,\'err\');});\n  a.onended=function(){\n    btn.textContent=\'▶\'; btn.classList.remove(\'playing\'); _audio.btn=null;\n    if(_audio.rafId){cancelAnimationFrame(_audio.rafId);_audio.rafId=null;}\n    _clearWave(cvId);\n  };\n}\n\nfunction _clearWave(cvId){\n  var cv=document.getElementById(cvId);\n  if(cv){var c=cv.getContext(\'2d\');c.clearRect(0,0,cv.width,cv.height);}\n}\n\nfunction _drawWave(cv, anlzr){\n  var ctx=cv.getContext(\'2d\'), w=cv.width, h=cv.height;\n  var buf=new Uint8Array(anlzr.frequencyBinCount);\n  function draw(){\n    _audio.rafId=requestAnimationFrame(draw);\n    anlzr.getByteFrequencyData(buf);\n    ctx.clearRect(0,0,w,h);\n    var bw=w/buf.length;\n    for(var i=0;i<buf.length;i++){\n      var v=buf[i]/255, bh=v*h;\n      ctx.fillStyle=\'rgba(88,166,255,\'+(0.25+v*0.75)+\')\';\n      ctx.fillRect(i*bw,h-bh,Math.max(1,bw-1),bh);\n    }\n  }\n  draw();\n}\n\n// ── Tab switching ────────────────────────────────────────────────────────────\nfunction switchTab(name){\n  document.querySelectorAll(\'.tab-btn\').forEach(function(b){b.classList.remove(\'active\');});\n  var tb=document.getElementById(\'tb-\'+name); if(tb) tb.classList.add(\'active\');\n  document.querySelectorAll(\'.tab-pane\').forEach(function(p){p.classList.remove(\'active\');});\n  var tp=document.getElementById(\'tab-\'+name); if(tp) tp.classList.add(\'active\');\n  var cfg=document.getElementById(\'cfgSec\');\n  if(cfg) cfg.style.display=name===\'images\'?\'block\':\'none\';\n  _activeTab=name;\n  [\'sidebar-default\',\'sidebar-sfx\',\'sidebar-voice\',\'sidebar-script\',\'sidebar-chars\',\'sidebar-docs\',\'sidebar-dash\',\'sidebar-settings\',\'bstats\'].forEach(function(id){var e=document.getElementById(id);if(e)e.style.display=\'none\';});\n  var showDef=document.getElementById(\'sidebar-default\'),showBs=document.getElementById(\'bstats\');\n  if(name===\'images\'){if(showDef)showDef.style.display=\'\';if(showBs&&book)showBs.style.display=\'flex\';}\n  else if(name===\'sfx\'){var e2=document.getElementById(\'sidebar-sfx\');if(e2)e2.style.display=\'\';}\n  else if(name===\'voice\'){var e2=document.getElementById(\'sidebar-voice\');if(e2)e2.style.display=\'\';}\n  else if(name===\'script\'){var e2=document.getElementById(\'sidebar-script\');if(e2)e2.style.display=\'\';}\n  else if(name===\'chars\'){var e2=document.getElementById(\'sidebar-chars\');if(e2)e2.style.display=\'\';}\n  else if(name===\'docs\'){var e2=document.getElementById(\'sidebar-docs\');if(e2)e2.style.display=\'\';}\n  else if(name===\'dash\'){var e2=document.getElementById(\'sidebar-dash\');if(e2)e2.style.display=\'\';}\n  else if(name===\'settings\'){var e2=document.getElementById(\'sidebar-settings\');if(e2)e2.style.display=\'\';}\n  else{if(showDef)showDef.style.display=\'\';if(showBs&&book)showBs.style.display=\'flex\';}\n  if(name===\'dash\'){loadDashboard();return;}\n  if(name===\'settings\'){loadSettings();return;}\n  if(book && !_tabLoaded[name]) _loadTab(name);\n}\n\nfunction _loadTab(name){\n  if(!book) return;\n  var s=book.slug;\n  if(name===\'sfx\')    loadSfx(s);\n  else if(name===\'voice\')  loadVoice(s);\n  else if(name===\'script\') loadScript(s);\n  else if(name===\'chars\')  loadChars();\n  else if(name===\'docs\')   loadDocs(s);\n}\n\n// ── Init ────────────────────────────────────────────────────────────────────\nfunction init(){\n  var books=/*BOOKS_JSON*/;\n  var sel=document.getElementById(\'bookSel\');\n  // Group by \'group\': standalone books have group=\'\', series/packs have group=series name\n  var standalone=books.filter(function(b){return !b.group;});\n  var groups={};\n  books.filter(function(b){return b.group;}).forEach(function(b){\n    if(!groups[b.group]) groups[b.group]=[];\n    groups[b.group].push(b);\n  });\n  function makeOpt(b){\n    var o=document.createElement(\'option\');\n    o.value=b.slug;\n    var label=b.group ? (b.title.split(\' — \')[1]||b.title) : b.title;\n    o.textContent=label+\' (\'+b.scenes+\' sc, \'+b.images+\' img)\';\n    return o;\n  }\n  if(standalone.length){\n    var grp=document.createElement(\'optgroup\'); grp.label=\'── Books ──\';\n    standalone.forEach(function(b){grp.appendChild(makeOpt(b));});\n    sel.appendChild(grp);\n  }\n  Object.keys(groups).sort().forEach(function(gname){\n    var grp=document.createElement(\'optgroup\'); grp.label=\'── \'+gname+\' ──\';\n    groups[gname].forEach(function(b){grp.appendChild(makeOpt(b));});\n    sel.appendChild(grp);\n  });\n  log2(\'Loaded \'+books.length+\' books\',\'ok\');\n  fetch(\'/api/status\').then(function(r){return r.json();}).then(function(st){\n    if(st.running) setRunning(true);\n  });\n  connectSSE();\n  fetch(\'/api/workflows\').then(function(r){return r.json();}).then(function(wfs){\n    var ws=document.getElementById(\'cWf\');\n    wfs.forEach(function(wf){\n      var o=document.createElement(\'option\');\n      o.value=wf; o.textContent=wf.replace(/_/g,\' \');\n      ws.appendChild(o);\n    });\n  });\n}\n\n// ── Book loading ─────────────────────────────────────────────────────────────\nasync function loadBook(slug){\n  _tabLoaded={};\n  if(!slug){\n    book=null;\n    document.getElementById(\'scenes\').innerHTML=\'<div class="empty">Select a book from the sidebar to begin</div>\';\n    document.getElementById(\'bstats\').style.display=\'none\';\n    document.getElementById(\'refs\').innerHTML=\'<div class="no-refs">No book selected</div>\';\n    document.getElementById(\'btnRun\').disabled=true;\n    [\'sfx\',\'voice\',\'chars\',\'docs\'].forEach(function(t){\n      var el=document.getElementById(t+\'-content\'||\'chars-content\');\n      if(el) el.innerHTML=\'<div class="tab-empty"><div class="tab-empty-txt">No book selected</div></div>\';\n    });\n    return;\n  }\n  var r=await fetch(\'/api/book?slug=\'+slug), b=await r.json();\n  if(b.error){log2(b.error,\'err\');return;}\n  book=b; scData={}; scSt={};\n\n  document.getElementById(\'ns\').textContent=b.scenes.length;\n  document.getElementById(\'ni\').textContent=b.scenes.filter(function(s){return s.image;}).length;\n  document.getElementById(\'nr\').textContent=b.char_refs.length;\n  document.getElementById(\'bstats\').style.display=\'flex\';\n  document.getElementById(\'tbadge-images\').textContent=b.scenes.length;\n  document.getElementById(\'tbadge-chars\').textContent=b.char_refs.length;\n\n  var coverEl=document.getElementById(\'coverImg\');\n  if(b.cover){coverEl.src=\'/api/file?path=\'+encodeURIComponent(b.cover)+\'&t=\'+Date.now();coverEl.style.display=\'block\';}\n  else{coverEl.style.display=\'none\';}\n\n  var refsEl=document.getElementById(\'refs\');\n  if(!b.char_refs.length){\n    refsEl.innerHTML=\'<div class="no-refs">No character refs found</div>\';\n  }else{\n    refsEl.innerHTML=b.char_refs.map(function(r){\n      return \'<div class="ref-card"><img src="/api/file?path=\'+encodeURIComponent(r.path)+\'" alt="\'+esc(r.name)+\'" onerror="this.style.opacity=.2">\'+\n             \'<div class="rname">\'+esc(r.name)+\'</div></div>\';\n    }).join(\'\');\n  }\n\n  b.scenes.forEach(function(s){scData[s.key]=s; scSt[s.key]=s.image?\'done\':\'pend\';});\n  renderAll();\n  document.getElementById(\'btnRun\').disabled=false;\n\n  // If not on Images tab, load the active tab now\n  if(_activeTab!==\'images\') _loadTab(_activeTab);\n}\n\n// ── Images tab ───────────────────────────────────────────────────────────────\nfunction renderAll(){\n  if(!book) return;\n  var chs={};\n  book.scenes.forEach(function(s){\n    if(!chs[s.chapter]) chs[s.chapter]=[];\n    chs[s.chapter].push(s);\n  });\n  var html=Object.keys(chs).sort(function(a,b){return a-b;}).map(function(ch){\n    return \'<div class="ch-group"><div class="ch-lbl">Chapter \'+ch+\'</div>\'+\n           \'<div class="scene-grid">\'+chs[ch].map(cardHtml).join(\'\')+\'</div></div>\';\n  }).join(\'\');\n  document.getElementById(\'scenes\').innerHTML=html;\n}\n\nfunction cardHtml(s){\n  var st=scSt[s.key]||\'pend\';\n  var imgHtml;\n  if(s.image && st!==\'gen\'){\n    imgHtml=\'<img src="/api/file?path=\'+encodeURIComponent(s.image)+\'" alt="\'+esc(s.title)+\'" loading="lazy" onclick="openLb(this.src)" onerror="this.parentElement.innerHTML=phHtml()">\';\n  }else if(st===\'gen\'){\n    imgHtml=\'<div class="gen-overlay"><div class="spin"></div></div>\'+\n            \'<div class="img-ph"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg><div class="ph-lbl">Generating&#8230;</div></div>\';\n  }else{\n    imgHtml=\'<div class="img-ph"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg><div class="ph-lbl">Not generated</div></div>\';\n  }\n  var stMap={pend:[\'s-pend\',\'Pending\'],gen:[\'s-gen\',\'Generating\'],done:[\'s-done\',\'Done\'],skip:[\'s-skip\',\'Skipped\'],fail:[\'s-fail\',\'Failed\']};\n  var si=stMap[st]||stMap.pend;\n  var meta=[s.location,s.time,s.ambience].filter(Boolean).map(function(m){return \'<span class="mpill">\'+esc(m.substring(0,22))+\'</span>\';}).join(\'\');\n  var cpills=s.characters.length?\'<div class="cpills">\'+s.characters.map(function(c){return \'<span class="cpill">\'+esc(c)+\'</span>\';}).join(\'\')+\'</div>\':\'\';\n  return \'<div class="card \'+st+\'" id="card-\'+s.key+\'">\'+\n    \'<div class="img-wrap">\'+imgHtml+\'</div>\'+\n    \'<div class="cbody">\'+\n      \'<div class="c-hdr"><span class="sc-num">Sc\'+s.scene+\'</span><span class="sc-ttl">\'+esc(s.title)+\'</span></div>\'+\n      (meta?\'<div class="meta-row">\'+meta+\'</div>\':\'\')+\n      (cpills||\'\')+\n      \'<div class="prompt-wrap"><div class="prompt" id="prompt-\'+s.key+\'">\'+esc(s.prompt)+\'</div>\'+\n      \'<button class="edit-btn" data-key="\'+s.key+\'" onclick="openPm(event,this.dataset.key)" title="Edit prompt">&#9998;</button></div>\'+\n      \'<span class="sbadge \'+si[0]+\'">\'+si[1]+\'</span>\'+\n    \'</div></div>\';\n}\nfunction phHtml(){return \'<div class="img-ph"><div class="ph-lbl">Error</div></div>\';}\n\nfunction updateCard(key){\n  var el=document.getElementById(\'card-\'+key);\n  if(!el||!scData[key]) return;\n  var tmp=document.createElement(\'div\'); tmp.innerHTML=cardHtml(scData[key]);\n  el.replaceWith(tmp.firstChild);\n}\n\n// ── SSE ──────────────────────────────────────────────────────────────────────\nfunction connectSSE(){\n  if(sse) sse.close();\n  sse=new EventSource(\'/api/events\');\n  sse.onmessage=function(e){\n    var ev=JSON.parse(e.data);\n    if(ev.type===\'log\'){\n      var cls=ev.text.match(/saved|done|ready/i)?\'ok\':ev.text.match(/error|fail/i)?\'err\':ev.text.match(/warning|skip/i)?\'warn\':\'\';\n      log2(ev.text,cls);\n    }else if(ev.type===\'sfx_log\'){\n      var wrap=document.getElementById(\'sfx-log-wrap\');\n      var body=document.getElementById(\'sfx-log-body\');\n      if(wrap) wrap.style.display=\'\';\n      if(body){\n        var cls2=ev.text.match(/✓|done|skip/i)?\'ok\':ev.text.match(/✗|error|fail/i)?\'err\':\'\';\n        var d=document.createElement(\'div\'); d.className=\'ll \'+cls2; d.textContent=ev.text; body.appendChild(d); wrap.scrollTop=wrap.scrollHeight;\n      }\n      if(ev.done){\n        var btn=document.getElementById(\'sfx-gen-btn\'),sb=document.getElementById(\'sfx-stop-btn\');\n        if(btn){btn.disabled=false;btn.textContent=\'▶ Generate\';}\n        if(sb) sb.style.display=\'none\';\n        if(typeof _currentBook!==\'undefined\') loadSfx(_currentBook);\n      }\n    }else if(ev.type===\'generating\'){\n      scSt[ev.key]=\'gen\'; updateCard(ev.key);\n    }else if(ev.type===\'image_ready\'){\n      scSt[ev.key]=\'done\';\n      if(scData[ev.key]) scData[ev.key].image=ev.path;\n      updateCard(ev.key);\n      document.getElementById(\'ni\').textContent=Object.values(scSt).filter(function(v){return v===\'done\';}).length;\n    }else if(ev.type===\'skipped\'){\n      scSt[ev.key]=\'skip\'; updateCard(ev.key);\n    }else if(ev.type===\'failed\'){\n      if(ev.key){scSt[ev.key]=\'fail\'; updateCard(ev.key);}\n    }else if(ev.type===\'cover_ready\'){\n      log2(\'Cover ready\',\'ok\');\n      var ce=document.getElementById(\'coverImg\');\n      ce.src=\'/api/file?path=\'+encodeURIComponent(ev.path)+\'&t=\'+Date.now();\n      ce.style.display=\'block\';\n    }else if(ev.type===\'done\'){\n      setRunning(false);\n      log2(\'--- Finished (exit \'+ev.exit_code+\') ---\',ev.exit_code===0?\'ok\':\'err\');\n    }\n  };\n  sse.onerror=function(){setTimeout(connectSSE,3000);};\n}\n\n// ── Run / Stop ───────────────────────────────────────────────────────────────\nasync function runPipeline(){\n  if(!book) return;\n  var cfg={\n    slug:book.slug, backend:document.getElementById(\'cBk\').value,\n    style_pick:parseInt(document.getElementById(\'cSt\').value),\n    comfyui_url:document.getElementById(\'cUrl\').value,\n    comfyui_model:document.getElementById(\'cMdl\').value,\n    hf_token:document.getElementById(\'cHfT\').value,\n    hf_model:document.getElementById(\'cHfM\').value,\n    width:parseInt(document.getElementById(\'cW\').value),\n    height:parseInt(document.getElementById(\'cH\').value),\n    overwrite:document.getElementById(\'cOvr\').checked,\n    debug:document.getElementById(\'cDbg\').checked,\n    force_workflow:document.getElementById(\'cWf\').value\n  };\n  if(cfg.overwrite){\n    Object.keys(scSt).forEach(function(k){scSt[k]=\'pend\';});\n    Object.values(scData).forEach(function(s){s.image=null;});\n    renderAll();\n  }\n  var r=await fetch(\'/api/run\',{method:\'POST\',headers:{\'Content-Type\':\'application/json\'},body:JSON.stringify(cfg)});\n  var res=await r.json();\n  if(res.error){log2(\'Error: \'+res.error,\'err\');return;}\n  setRunning(true);\n  log2(\'--- Starting (pid \'+res.pid+\') ---\',\'inf\');\n}\nasync function stopPipeline(){await fetch(\'/api/stop\',{method:\'POST\'});log2(\'Stop requested…\',\'warn\');}\nfunction setRunning(v){\n  running=v;\n  document.getElementById(\'dot\').className=\'dot\'+(v?\' run\':\' done\');\n  document.getElementById(\'st-txt\').textContent=v?\'Running\':\'Idle\';\n  document.getElementById(\'btnRun\').disabled=v||!book;\n  document.getElementById(\'btnStop\').disabled=!v;\n}\nfunction onBk(){\n  var v=document.getElementById(\'cBk\').value;\n  document.getElementById(\'cuiOpts\').style.display=v===\'comfyui\'?\'block\':\'none\';\n  document.getElementById(\'hfOpts\').style.display=v===\'hf\'?\'block\':\'none\';\n  document.getElementById(\'wfRow\').style.display=v===\'comfyui\'?\'block\':\'none\';\n}\n\n// ── SFX tab ──────────────────────────────────────────────────────────────────\nasync function loadSfx(slug){\n  var bar=document.getElementById(\'sfx-bar\');\n  var el=document.getElementById(\'sfx-content\');\n  el.innerHTML=\'<div style="padding:20px;color:var(--muted)">Loading SFX data&#8230;</div>\';\n  var r=await fetch(\'/api/sfx?slug=\'+slug), d=await r.json();\n  if(d.error){el.innerHTML=\'<div class="tab-empty"><div class="tab-empty-txt">\'+esc(d.error)+\'</div></div>\';return;}\n  bar.textContent=d.downloaded+\' / \'+d.total+\' SFX files downloaded\';\n  document.getElementById(\'tbadge-sfx\').textContent=d.total;\n  var sbStats=document.getElementById(\'sfx-sidebar-stats\'),sbEmpty=document.getElementById(\'sfx-sb-empty\');\n  document.getElementById(\'sfx-sb-total\').textContent=d.total;\n  document.getElementById(\'sfx-sb-done\').textContent=d.downloaded;\n  document.getElementById(\'sfx-sb-amb\').textContent=d.ambience_total||0;\n  if(sbStats)sbStats.style.display=\'flex\';\n  if(sbEmpty)sbEmpty.style.display=\'none\';\n  if(!d.sfx.length){\n    el.innerHTML=\'<div class="tab-empty"><div class="tab-empty-ico">🔊</div><div class="tab-empty-txt">No SFX tags in this book</div></div>\';\n    _tabLoaded[\'sfx\']=true;\n  setTimeout(function(){_renderSfxRows(_sfxData);},0); return;\n  }\n  var html=\'<table class="sfx-table" id="sfxTbl"><thead><tr>\'\n    +\'<th class="sortable" onclick="sortSfx(0,this)">Label</th>\'\n    +\'<th class="sortable" onclick="sortSfx(1,this)">Castlets / Scenes</th>\'\n    +\'<th class="sortable" onclick="sortSfx(2,this)">Status</th>\'\n    +\'<th>Play</th><th style="width:150px">Waveform</th>\'\n    +\'</tr></thead><tbody>\';\n  _sfxData=d.sfx;\n  d.sfx.forEach(function(s,i){\n    var cvId=\'wv-sfx-\'+i;\n    html+=\'<tr>\';\n    html+=\'<td><code style="font-size:11px;color:var(--text)">\'+esc(s.label)+\'</code></td>\';\n    html+=\'<td>\'+s.scenes.map(function(k){return \'<span class="sfx-sc">\'+esc(k)+\'</span>\';}).join(\'\')+\'</td>\';\n    if(s.has_file){\n      html+=\'<td><span class="sfx-ok">&#10003; Ready</span></td>\';\n      html+=\'<td><button class="audio-btn" onclick="playAudio(this,\\\'\'+esc(s.file_path)+\'\\\',\\\'\'+cvId+\'\\\')">&#9654;</button></td>\';\n    }else{\n      html+=\'<td><span class="sfx-miss">&#10007; Missing</span></td>\';\n      html+=\'<td><span style="color:var(--dim);font-size:11px">&#8212;</span></td>\';\n    }\n    html+=\'<td><canvas class="waveform" id="\'+cvId+\'" width="140" height="26"></canvas></td>\';\n    html+=\'</tr>\';\n  });\n  html+=\'</tbody></table>\';\n  el.innerHTML=html;\n  _tabLoaded[\'sfx\']=true;\n  setTimeout(function(){_renderSfxRows(_sfxData);},0);\n}\n\n// ── Voice tab ────────────────────────────────────────────────────────────────\nasync function loadVoice(slug){\n  var bar=document.getElementById(\'voice-bar\');\n  var el=document.getElementById(\'voice-content\');\n  el.innerHTML=\'<div style="padding:20px;color:var(--muted)">Loading voice files&#8230;</div>\';\n  var r=await fetch(\'/api/voice?slug=\'+slug), d=await r.json();\n  document.getElementById(\'tbadge-voice\').textContent=d.total;\n  var vStats=document.getElementById(\'voice-sidebar-stats\'),vEmpty=document.getElementById(\'voice-sb-empty\');\n  document.getElementById(\'voice-sb-total\').textContent=d.total;\n  var vNarr=d.voice.filter(function(v){return v.type===\'narration\';}).length;\n  var vDial=d.voice.filter(function(v){return v.type===\'dialogue\';}).length;\n  document.getElementById(\'voice-sb-narr\').textContent=vNarr;\n  document.getElementById(\'voice-sb-dial\').textContent=vDial;\n  if(vStats)vStats.style.display=\'flex\';if(vEmpty)vEmpty.style.display=\'none\';\n  if(!d.voice.length){\n    bar.textContent=\'No voice recordings for this book\';\n    el.innerHTML=\'<div class="tab-empty"><div class="tab-empty-ico">🎙️</div><div class="tab-empty-txt">No .wav files in voice/ folder</div></div>\';\n    _tabLoaded[\'voice\']=true; return;\n  }\n  bar.textContent=d.total+\' voice recordings\';\n  var groups={};\n  d.voice.forEach(function(v){var k=v.key||\'Misc\';if(!groups[k])groups[k]=[];groups[k].push(v);});\n  var html=\'\', cnt=0;\n  Object.keys(groups).sort().forEach(function(gk){\n    html+=\'<div class="voice-grp"><div class="voice-grp-hdr">\'+esc(gk)+\'</div>\';\n    groups[gk].forEach(function(v){\n      var cvId=\'wv-v-\'+cnt;\n      var tc=[\'narration\',\'dialogue\',\'thought\'].includes(v.type)?v.type:\'unknown\';\n      html+=\'<div class="voice-row">\';\n      html+=\'<span class="vtype \'+tc+\'">\'+esc(v.type)+\'</span>\';\n      html+=\'<button class="audio-btn" onclick="playAudio(this,\\\'\'+esc(v.path)+\'\\\',\\\'\'+cvId+\'\\\')">&#9654;</button>\';\n      html+=\'<canvas class="waveform" id="\'+cvId+\'" width="100" height="26"></canvas>\';\n      html+=\'<span class="vfname" title="\'+esc(v.fname)+\'">\'+esc(v.fname)+\'</span>\';\n      html+=\'<span class="vsize">\'+v.size+\'KB</span>\';\n      html+=\'</div>\'; cnt++;\n    });\n    html+=\'</div>\';\n  });\n  el.innerHTML=html;\n  _tabLoaded[\'voice\']=true;\n}\n\n// ── Script reader ─────────────────────────────────────────────────────────────\nasync function loadScript(slug){\n  var chSel=document.getElementById(\'script-ch\');\n  var scSel=document.getElementById(\'script-sc\');\n  chSel.innerHTML=\'<option value="">Loading&#8230;</option>\';\n  scSel.innerHTML=\'<option value="">&#8212;</option>\';\n  var r=await fetch(\'/api/script?slug=\'+slug), d=await r.json();\n  _scriptData=d;\n  var sStats=document.getElementById(\'script-sidebar-stats\'),sEmpty=document.getElementById(\'script-sb-empty\');\n  if(d.chapters&&d.chapters.length){document.getElementById(\'script-sb-ch\').textContent=d.chapters.length;var totalSc=d.chapters.reduce(function(a,c){return a+(c.scenes?c.scenes.length:0);},0);document.getElementById(\'script-sb-sc\').textContent=totalSc;if(sStats)sStats.style.display=\'flex\';if(sEmpty)sEmpty.style.display=\'none\';}\n  if(!d.chapters||!d.chapters.length){\n    document.getElementById(\'script-body\').innerHTML=\'<div class="tab-empty"><div class="tab-empty-txt">No script found</div></div>\';\n    return;\n  }\n  chSel.innerHTML=\'\';\n  d.chapters.forEach(function(ch,i){\n    var o=document.createElement(\'option\'); o.value=i; o.textContent=ch.title; chSel.appendChild(o);\n  });\n  scriptChChange();\n  _tabLoaded[\'script\']=true;\n}\nfunction scriptChChange(){\n  if(!_scriptData) return;\n  var ci=parseInt(document.getElementById(\'script-ch\').value)||0;\n  var ch=_scriptData.chapters[ci]; if(!ch) return;\n  var scSel=document.getElementById(\'script-sc\'); scSel.innerHTML=\'\';\n  ch.scenes.forEach(function(sc,i){\n    var o=document.createElement(\'option\'); o.value=i; o.textContent=sc.title; scSel.appendChild(o);\n  });\n  scriptScChange();\n}\nfunction scriptScChange(){\n  if(!_scriptData) return;\n  var ci=parseInt(document.getElementById(\'script-ch\').value)||0;\n  var si=parseInt(document.getElementById(\'script-sc\').value)||0;\n  var ch=_scriptData.chapters[ci]; if(!ch) return;\n  var sc=ch.scenes[si]; if(!sc) return;\n  var body=document.getElementById(\'script-body\');\n  var html=\'<h3 style="font-size:14px;font-weight:600;margin-bottom:14px">\'+esc(sc.title)+\'</h3>\';\n  sc.blocks.forEach(function(b){\n    var t=b.type;\n    if(t===\'NARRATION\'){\n      html+=\'<div class="sblk sblk-narr">\'+esc(b.content)+\'</div>\';\n    }else if(t===\'DIALOGUE\'){\n      var nm=b.tag.match(/DIALOGUE:\\s*([^|]+)/i);\n      var name=nm?nm[1].trim():\'Character\';\n      var em=b.tag.match(/emotion=(\\S+)/i);\n      var emHtml=em?\'<span style="color:var(--dim);font-size:9px;font-style:italic"> \'+esc(em[1])+\'</span>\':\'\';\n      html+=\'<div class="sblk sblk-dial"><span class="sblk-who">\'+esc(name)+emHtml+\'</span><span class="sblk-line">&#8220;\'+esc(b.content)+\'&#8221;</span></div>\';\n    }else if(t===\'THOUGHT\'){\n      var tn=b.tag.match(/THOUGHT:\\s*(.+)/i);\n      var tname=tn?tn[1].trim():\'\';\n      html+=\'<div class="sblk sblk-thought">\'+(tname?\'<em style="color:var(--blue);font-size:10px">\'+esc(tname)+\'</em><br>\':\'\')+esc(b.content)+\'</div>\';\n    }else if(t===\'SFX\'){\n      var sm=b.tag.match(/SFX:\\s*(.+)/i);\n      html+=\'<div class="sblk"><span class="sblk-sfx">&#128266; \'+esc(sm?sm[1].trim():b.tag)+\'</span></div>\';\n    }else if(t===\'PAUSE\'){\n      html+=\'<div class="sblk sblk-pause">&#183; &#183; &#183;</div>\';\n    }else if(t===\'TRANSITION\'){\n      html+=\'<div class="sblk sblk-trans">&#8212; \'+esc(b.tag)+\' &#8212;</div>\';\n    }else if(b.content&&![\'LOCATION\',\'TIME\',\'AMBIENCE\',\'MUSIC\'].includes(t)){\n      html+=\'<div class="sblk" style="font-size:10px;color:var(--dim)">[\'+esc(b.tag)+\'] \'+esc(b.content)+\'</div>\';\n    }\n  });\n  body.innerHTML=html;\n}\n\n// ── Characters tab ────────────────────────────────────────────────────────────\nfunction loadChars(){\n  if(!book) return;\n  var el=document.getElementById(\'chars-content\');\n  var chars=book.characters||[];\n  var cStats=document.getElementById(\'chars-sidebar-stats\'),cEmpty=document.getElementById(\'chars-sb-empty\');\n  document.getElementById(\'chars-sb-total\').textContent=chars.length;\n  document.getElementById(\'chars-sb-img\').textContent=chars.filter(function(c){return c.image_status===\'ready\';}).length;\n  var vEl=document.getElementById(\'chars-sb-voice\');if(vEl)vEl.textContent=chars.filter(function(c){return c.voice_status===\'ready\';}).length;\n  var pEl=document.getElementById(\'chars-sb-prompt\');if(pEl)pEl.textContent=chars.filter(function(c){return c.prompt_status===\'draft\';}).length;\n  if(chars.length){if(cStats)cStats.style.display=\'flex\';if(cEmpty)cEmpty.style.display=\'none\';}\n  document.getElementById(\'tbadge-chars\').textContent=chars.length;\n  if(!chars.length){\n    el.innerHTML=\'<div class="tab-empty"><div class="tab-empty-ico">&#127917;</div><div class="tab-empty-txt">No characters found in script</div></div>\';\n    _tabLoaded[\'chars\']=true; return;\n  }\n  var html=\'<div class="chars-bar">\'+ chars.length +\' characters</div>\';\n  chars.forEach(function(c){\n    var imgUrl=c.image?\'/api/file?path=\'+encodeURIComponent(c.image):\'\';\n    var imgSt=c.image_status===\'ready\';\n    var voiSt=c.voice_status===\'ready\';\n    var prSt=c.prompt_status===\'draft\';\n    html+=\'<div class="char-row">\';\n    html+=imgUrl?\'<img class="char-row-img" src="\'+imgUrl+\'" alt="\'+esc(c.name)+\'" onclick="openLb(this.src)">\':\' <div class="char-row-ph">&#127917;</div>\';\n    html+=\'<div class="char-row-body">\';\n    html+=\'<div class="char-row-name">\'+esc(c.name)+\'</div>\';\n    html+=\'<div class="char-row-badges">\';\n    html+=\'<span class="char-badge \'+(imgSt?\'ok\':\'miss\')+\'">\'+( imgSt?\'&#10003; Image\':\'&#10007; No image\')+\'</span>\';\n    html+=\'<span class="char-badge \'+(voiSt?\'ok\':\'miss\')+\'">\'+( voiSt?\'&#10003; \'+c.voice_count+\' voice lines\':\'&#10007; No voice\')+\'</span>\';\n    html+=\'<span class="char-badge \'+(prSt?\'ok\':\'miss\')+\'">\'+( prSt?\'&#10003; Prompt\':\'&#10007; No prompt\')+\'</span>\';\n    if(c.scene_count)html+=\'<span class="char-badge dim">&#127916; \'+c.scene_count+\' scenes</span>\';\n    if(c.dialogue)html+=\'<span class="char-badge dim">&#128172; \'+c.dialogue+\' lines</span>\';\n    html+=\'</div>\';\n    if(c.prompt)html+=\'<div class="char-row-prompt">\'+esc(c.prompt)+\'</div>\';\n    html+=\'<div class="char-row-footer">\';\n    html+=\'<button class="ch-pm-btn" data-name="\'+esc(c.name)+\'" data-prompt="\'+esc(c.prompt||\'\')+\'">\'+( prSt?\'Edit prompt\':\'Add prompt\')+\'</button>\';\n    html+=\'</div></div></div>\';\n  });\n  el.innerHTML=html;\n  el.querySelectorAll(\'.ch-pm-btn\').forEach(function(btn){\n    btn.addEventListener(\'click\',function(e){openCharPm(e,btn.dataset.name,btn.dataset.prompt);});\n  });\n  _tabLoaded[\'chars\']=true;\n}\n\n// ── Manuscripts tab ───────────────────────────────────────────────────────────\nasync function loadDocs(slug){\n  var el=document.getElementById(\'docs-content\');\n  el.innerHTML=\'<div style="padding:20px;color:var(--muted)">Loading&#8230;</div>\';\n  var r=await fetch(\'/api/manuscripts?slug=\'+slug), d=await r.json();\n  document.getElementById(\'tbadge-docs\').textContent=d.manuscripts.length;\n  var dStats=document.getElementById(\'docs-sidebar-stats\'),dEmpty=document.getElementById(\'docs-sb-empty\');\n  document.getElementById(\'docs-sb-total\').textContent=d.manuscripts.length;\n  if(d.manuscripts.length){if(dStats)dStats.style.display=\'flex\';if(dEmpty)dEmpty.style.display=\'none\';}\n\n  if(!d.manuscripts.length){\n    el.innerHTML=\'<div class="tab-empty"><div class="tab-empty-ico">📄</div><div class="tab-empty-txt">No .docx files for this book</div></div>\';\n    _tabLoaded[\'docs\']=true; return;\n  }\n  var html=\'\';\n  d.manuscripts.forEach(function(f){\n    html+=\'<div class="doc-row">\'+\n          \'<div class="doc-ico">📝</div>\'+\n          \'<div class="doc-name">\'+esc(f.name)+\'</div>\'+\n          \'<div class="doc-sz">\'+f.size+\'</div>\'+\n          \'<a class="doc-dl" href="/api/file?path=\'+encodeURIComponent(f.path)+\'" download="\'+esc(f.name)+\'">&#11015; Download</a>\'+\n          \'</div>\';\n  });\n  el.innerHTML=html;\n  _tabLoaded[\'docs\']=true;\n}\n\n// ── Dashboard tab ─────────────────────────────────────────────────────────────\nasync function loadDashboard(){\n  var el=document.getElementById(\'dash-content\');\n  if(!el) return;\n  el.innerHTML=\'<div style="padding:20px;color:var(--muted)">Loading&#8230;</div>\';\n  fetch(\'/api/dashboard\').then(function(r){return r.json();}).then(function(books){\n    _dashData=books;\n    var dbStats=document.getElementById(\'dash-sidebar-stats\');\n    document.getElementById(\'dash-sb-books\').textContent=books.length;\n    var dbSc=books.reduce(function(a,b){return a+(b.scene_count||0);},0);\n    var dbIm=books.reduce(function(a,b){return a+(b.image_count||0);},0);\n    document.getElementById(\'dash-sb-scenes\').textContent=dbSc;\n    document.getElementById(\'dash-sb-images\').textContent=dbIm;\n    if(dbStats)dbStats.style.display=\'flex\';\n    _dashSort={col:-1,asc:true};\n    var cnt=document.getElementById(\'dash-count\');\n    if(cnt) cnt.textContent=books.length+\' book\'+(books.length!==1?\'s\':\'\');\n    _renderDash();\n  }).catch(function(e){\n    el.innerHTML=\'<div style="padding:20px;color:var(--red)">Error: \'+esc(e.message)+\'</div>\';\n  });\n}\nvar _dashData=[], _dashView=\'icons\', _dashSort={col:-1,asc:true};\nfunction setDashView(v){\n  _dashView=v;\n  document.getElementById(\'dvIcons\').classList.toggle(\'active\',v===\'icons\');\n  document.getElementById(\'dvDetails\').classList.toggle(\'active\',v===\'details\');\n  _renderDash();\n}\nfunction _renderDash(){\n  var el=document.getElementById(\'dash-content\'); if(!el) return;\n  if(!_dashData.length){\n    el.innerHTML=\'<div class="tab-empty"><div class="tab-empty-ico">📊</div><div class="tab-empty-txt">No books found</div></div>\';\n    return;\n  }\n  _dashView===\'icons\' ? _renderDashIcons(el) : _renderDashDetails(el);\n}\nfunction _coverImg(b,cls){\n  if(b.cover)\n    return \'<img class="\'+cls+\'" src="/api/file?path=\'+encodeURIComponent(b.cover)+\'" alt="\'+esc(b.title)+\'" onerror="this.style.display=\\\'none\\\'">\';\n  return \'\';\n}\nfunction _pct(val,color){\n  return \'<span class="pct-bar"><span class="pct-fill" style="width:\'+val+\'%;background:\'+color+\'"></span></span>\'+val+\'%\';\n}\nfunction _renderDashIcons(el){\n  var h=\'<div class="dash-grid">\';\n  _dashData.forEach(function(b){\n    h+=\'<div class="bk-card" onclick="selectBook(\\\'\'+esc(b.slug)+\'\\\')">\';\n    h+=\'<div class="bk-cover-wrap">\';\n    if(b.cover){\n      h+=\'<img src="/api/file?path=\'+encodeURIComponent(b.cover)+\'" alt="\'+esc(b.title)+\'" onerror="this.parentNode.innerHTML=\\\'<div class=bk-cover-ph>📚</div>\\\'" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover">\';\n    }else{\n      h+=\'<div class="bk-cover-ph">📚</div>\';\n    }\n    h+=\'</div>\';\n    h+=\'<div class="bk-ic-body">\';\n    h+=\'<div class="bk-ic-title">\'+esc(b.title)+\'</div>\';\n    h+=\'<div class="bk-ic-pills">\';\n    h+=\'<span class="bk-ic-pill">\'+b.scenes+\' sc</span>\';\n    h+=\'<span class="bk-ic-pill \'+(b.img_pct>=100?\'ok\':b.img_pct>0?\'\':\'miss\')+\'">🖼 \'+b.img_pct+\'%</span>\';\n    h+=\'<span class="bk-ic-pill \'+(b.sfx_pct>=100?\'ok\':b.sfx_pct>0?\'\':\'miss\')+\'">🔊 \'+b.sfx_pct+\'%</span>\';\n    if(b.voice>0) h+=\'<span class="bk-ic-pill ok">🎙 \'+b.voice+\'</span>\';\n    h+=\'<span class="bk-ic-pill \'+(b.cover?\'ok\':\'miss\')+\'">\'+(b.cover?\'✓\':\'✗\')+\' cover</span>\';\n    h+=\'</div></div></div>\';\n  });\n  h+=\'</div>\';\n  el.innerHTML=h;\n}\nfunction _renderDashDetails(el){\n  var data=_dashData.slice();\n  if(_dashSort.col>=0){\n    var cols=[\'title\',\'scenes\',\'img_pct\',\'sfx_pct\',\'voice\',\'docs\'];\n    var key=cols[_dashSort.col];\n    data.sort(function(a,b){\n      var va=a[key]||0, vb=b[key]||0;\n      if(key===\'title\'){va=a.title;vb=b.title;}\n      var r=typeof va===\'string\'?va.localeCompare(vb):va-vb;\n      return _dashSort.asc?r:-r;\n    });\n  }\n  var h=\'<table class="dash-table"><thead><tr>\';\n  var hdrs=[\'\',\'Title\',\'Scenes\',\'Images\',\'SFX\',\'Voice\',\'Docs\'];\n  hdrs.forEach(function(hdr,i){\n    if(i===0){h+=\'<th style="width:42px"></th>\';return;}\n    var arrow=_dashSort.col===(i-1)?(_dashSort.asc?\' ↑\':\' ↓\'):\'\';\n    h+=\'<th onclick="_dashSortBy(\'+(i-1)+\')">\'+(hdr+arrow)+\'</th>\';\n  });\n  h+=\'</tr></thead><tbody>\';\n  data.forEach(function(b){\n    h+=\'<tr onclick="selectBook(\\\'\'+esc(b.slug)+\'\\\')">\';\n    // Thumb\n    h+=\'<td>\';\n    if(b.cover) h+=\'<img class="dt-thumb" src="/api/file?path=\'+encodeURIComponent(b.cover)+\'" onerror="this.style.display=\\\'none\\\'">\';\n    else h+=\'<div class="dt-thumb-ph">📚</div>\';\n    h+=\'</td>\';\n    h+=\'<td class="dt-title">\'+esc(b.title)+\'</td>\';\n    h+=\'<td class="dt-muted">\'+b.scenes+\'</td>\';\n    h+=\'<td>\'+_pct(b.img_pct,\'var(--blue)\')+\'</td>\';\n    h+=\'<td>\'+_pct(b.sfx_pct,\'var(--purple)\')+\'</td>\';\n    h+=\'<td class="dt-muted">\'+(b.voice||\'—\')+\'</td>\';\n    h+=\'<td class="dt-muted">\'+b.docs+\'</td>\';\n    h+=\'</tr>\';\n  });\n  h+=\'</tbody></table>\';\n  el.innerHTML=h;\n}\nfunction _dashSortBy(col){\n  if(_dashSort.col===col) _dashSort.asc=!_dashSort.asc;\n  else {_dashSort.col=col;_dashSort.asc=true;}\n  _renderDashDetails(document.getElementById(\'dash-content\'));\n}\nfunction progRow(lbl,pct,cls,val){\n  return \'<div class="pr-row"><span class="pr-lbl">\'+lbl+\'</span>\'+\n         \'<div class="pr-bar"><div class="pr-fill \'+cls+\'" style="width:\'+pct+\'%"></div></div>\'+\n         \'<span class="pr-val">\'+val+\'</span></div>\';\n}\nfunction selectBook(slug){\n  var sel=document.getElementById(\'bookSel\'); sel.value=slug;\n  loadBook(slug); switchTab(\'images\');\n}\n\n// ── Prompt modal ──────────────────────────────────────────────────────────────\nvar _pmKey=null, _pmSlug=null;\nfunction openPm(e,key){\n  e.stopPropagation();\n  if(!book) return;\n  _pmKey=key; _pmSlug=book.slug;\n  var s=scData[key]; if(!s) return;\n  document.getElementById(\'pm-title\').textContent=\'Edit Prompt — Sc\'+s.scene+\': \'+s.title;\n  document.getElementById(\'pm-ta\').value=s.prompt||\'\';\n  document.getElementById(\'pm-info\').textContent=\'\';\n  document.getElementById(\'pm\').classList.add(\'open\');\n  document.getElementById(\'pm-ta\').focus();\n}\nfunction closePm(){document.getElementById(\'pm\').classList.remove(\'open\');}\nasync function savePrompt(){\n  var prompt=document.getElementById(\'pm-ta\').value.trim(); if(!prompt) return;\n  document.getElementById(\'pm-info\').textContent=\'Saving&#8230;\';\n  var r=await fetch(\'/api/save_prompt\',{method:\'POST\',headers:{\'Content-Type\':\'application/json\'},\n    body:JSON.stringify({slug:_pmSlug,key:_pmKey,prompt:prompt})});\n  var res=await r.json();\n  if(res.error){document.getElementById(\'pm-info\').textContent=\'Error: \'+res.error;return;}\n  if(scData[_pmKey]) scData[_pmKey].prompt=prompt;\n  var el=document.getElementById(\'prompt-\'+_pmKey); if(el) el.textContent=prompt;\n  document.getElementById(\'pm-info\').textContent=\'Saved to \'+res.file;\n  setTimeout(closePm,900);\n}\n\n// ── Lightbox ──────────────────────────────────────────────────────────────────\nfunction openLb(src){document.getElementById(\'lbImg\').src=src;document.getElementById(\'lb\').classList.add(\'open\');}\nfunction closeLb(){document.getElementById(\'lb\').classList.remove(\'open\');}\n\n// ── Utilities ─────────────────────────────────────────────────────────────────\nfunction log2(txt,cls){\n  var b=document.getElementById(\'logBody\'), d=document.createElement(\'div\');\n  d.className=\'ll \'+(cls||\'\'); d.textContent=txt; b.appendChild(d); b.scrollTop=b.scrollHeight;\n}\nasync function runSfxGen(){\n  var slug=_currentBook; if(!slug){alert(\'Select a book first.\');return;}\n  var key=document.getElementById(\'sfx-api-key\').value.trim();\n  if(!key){alert(\'Enter your ElevenLabs API key.\');return;}\n  var btn=document.getElementById(\'sfx-gen-btn\'),sb=document.getElementById(\'sfx-stop-btn\');\n  btn.disabled=true; btn.textContent=\'Generating\u2026\'; sb.style.display=\'\';\n  document.getElementById(\'sfx-log-body\').innerHTML=\'\';\n  document.getElementById(\'sfx-log-wrap\').style.display=\'\';\n  var r=await fetch(\'/api/run_sfx\',{method:\'POST\',headers:{\'Content-Type\':\'application/json\'},body:JSON.stringify({slug:slug,api_key:key,sfx_duration:parseFloat(document.getElementById(\'sfx-dur-sfx\').value)||5,ambience_duration:parseFloat(document.getElementById(\'sfx-dur-amb\').value)||10})});\n  var d=await r.json();\n  if(d.error){alert(d.error);btn.disabled=false;btn.textContent=\'\u25b6 Generate\';sb.style.display=\'none\';}\n}\nfunction stopSfxGen(){\n  fetch(\'/api/stop_sfx\',{method:\'POST\'});\n  var btn=document.getElementById(\'sfx-gen-btn\'),sb=document.getElementById(\'sfx-stop-btn\');\n  btn.disabled=false; btn.textContent=\'\u25b6 Generate\'; sb.style.display=\'none\';\n}\nfunction clearLog(){document.getElementById(\'logBody\').innerHTML=\'\';}\nfunction esc(s){return String(s).replace(/&/g,\'&amp;\').replace(/</g,\'&lt;\').replace(/>/g,\'&gt;\').replace(/"/g,\'&quot;\');}\n\n\n// ── Settings ──────────────────────────────────────────────────────────────\nfunction loadSettings(){\n  fetch(\'/api/settings\').then(function(r){return r.json();}).then(function(s){\n    // Paths\n    var paths = s.paths||{};\n    var el;\n    el=document.getElementById(\'cfg-root\');          if(el) el.value=paths.root||\'\';\n    el=document.getElementById(\'cfg-casts_dir\');     if(el) el.value=paths.casts_dir||\'\';\n    el=document.getElementById(\'cfg-workflows_dir\'); if(el) el.value=paths.workflows_dir||\'\';\n    el=document.getElementById(\'cfg-char_refs_dir\'); if(el) el.value=paths.char_refs_dir||\'\';\n    // ComfyUI\n    var cu = s.comfyui||{};\n    el=document.getElementById(\'cfg-comfyui-url\');   if(el) el.value=cu.url||\'\';\n    el=document.getElementById(\'cfg-comfyui-model\'); if(el) el.value=cu.model||\'\';\n    // Generation\n    var gen = s.generation||{};\n    el=document.getElementById(\'cfg-gen-backend\');   if(el) el.value=gen.backend||\'comfyui\';\n    el=document.getElementById(\'cfg-gen-width\');     if(el) el.value=gen.width||1024;\n    el=document.getElementById(\'cfg-gen-height\');    if(el) el.value=gen.height||576;\n    el=document.getElementById(\'cfg-gen-style\');     if(el) el.value=String(gen.style||2);\n    // HF\n    var hf = s.hf||{};\n    el=document.getElementById(\'cfg-hf-token\');      if(el) el.value=hf.token||\'\';\n    el=document.getElementById(\'cfg-hf-model\');      if(el) el.value=hf.model||\'dev\';\n    // Freesound\n    var fs = s.freesound||{};\n    el=document.getElementById(\'cfg-freesound-api_key\'); if(el) el.value=fs.api_key||\'\';\n  }).catch(function(e){console.error(\'Settings load error:\',e);});\n}\n\nfunction browseFolderFor(fieldId){\n  var current=document.getElementById(fieldId);\n  var cur=current?encodeURIComponent(current.value):\'\';\n  fetch(\'/api/browse_folder?current=\'+cur)\n    .then(function(r){return r.json();})\n    .then(function(res){\n      if(res.path && current) current.value=res.path;\n    })\n    .catch(function(e){console.error(\'Browse error:\',e);});\n}\n\nfunction saveSettings(){\n  function v(id){var el=document.getElementById(id);return el?el.value:\'\';}\n  var data = {\n    paths:{\n      root:          v(\'cfg-root\'),\n      casts_dir:     v(\'cfg-casts_dir\'),\n      workflows_dir: v(\'cfg-workflows_dir\'),\n      char_refs_dir: v(\'cfg-char_refs_dir\')\n    },\n    comfyui:{\n      url:   v(\'cfg-comfyui-url\'),\n      model: v(\'cfg-comfyui-model\')\n    },\n    generation:{\n      backend: v(\'cfg-gen-backend\'),\n      width:   parseInt(v(\'cfg-gen-width\'))||1024,\n      height:  parseInt(v(\'cfg-gen-height\'))||576,\n      style:   parseInt(v(\'cfg-gen-style\'))||2\n    },\n    hf:{\n      token: v(\'cfg-hf-token\'),\n      model: v(\'cfg-hf-model\')\n    },\n    freesound:{api_key: v(\'cfg-freesound-api_key\')}\n  };\n  fetch(\'/api/settings\',{method:\'POST\',headers:{\'Content-Type\':\'application/json\'},\n    body:JSON.stringify(data)\n  }).then(function(r){return r.json();}).then(function(res){\n    var msg=document.getElementById(\'settings-msg\');\n    var banner=document.getElementById(\'settings-banner\');\n    if(res.ok){\n      if(msg){msg.className=\'settings-msg\';msg.textContent=\'✓ Saved\';}\n      if(banner) banner.style.display=res.restart_required?\'block\':\'none\';\n      // Apply generation defaults to Images tab immediately\n      applySettingsToImagesTab(data);\n      setTimeout(function(){if(msg) msg.textContent=\'\';},3000);\n    } else {\n      if(msg){msg.className=\'settings-msg err\';msg.textContent=\'Error: \'+(res.error||\'unknown\');}\n    }\n  }).catch(function(e){\n    var msg=document.getElementById(\'settings-msg\');\n    if(msg){msg.className=\'settings-msg err\';msg.textContent=\'Save failed: \'+e.message;}\n  });\n}\n\nfunction applySettingsToImagesTab(data){\n  // Push generation defaults into the Images tab form fields\n  var gen = data.generation||{};\n  var el;\n  el=document.getElementById(\'selBackend\'); if(el) el.value=gen.backend||\'comfyui\';\n  el=document.getElementById(\'inpW\');       if(el) el.value=gen.width||1024;\n  el=document.getElementById(\'inpH\');       if(el) el.value=gen.height||576;\n  el=document.getElementById(\'inpStyle\');   if(el) el.value=gen.style||2;\n  // ComfyUI URL\n  var cu = data.comfyui||{};\n  el=document.getElementById(\'inpComfyUrl\'); if(el) el.value=cu.url||\'\';\n  el=document.getElementById(\'inpHfToken\');  if(el) el.value=(data.hf||{}).token||\'\';\n}\n\n\n// ── SFX sort ──\nvar _sfxSortCol=-1,_sfxSortAsc=true;\nfunction sortSfx(col,th){\n  _sfxSortAsc=(_sfxSortCol===col)?!_sfxSortAsc:true;\n  _sfxSortCol=col;\n  document.querySelectorAll(\'#sfxTbl .sortable\').forEach(function(e){\n    e.textContent=e.textContent.replace(/[\\u2191\\u2193]/g,\'\').trimEnd();});\n  th.textContent+=_sfxSortAsc?\' ↑\':\' ↓\';\n  _sfxData.sort(function(a,b){\n    var va,vb;\n    if(col===0){va=a.label;vb=b.label;return _sfxSortAsc?va.localeCompare(vb):vb.localeCompare(va);}\n    if(col===1){va=a.scenes.length;vb=b.scenes.length;return _sfxSortAsc?va-vb:vb-va;}\n    va=(a.has_file?\'1\':\'0\');vb=(b.has_file?\'1\':\'0\');\n    return _sfxSortAsc?va.localeCompare(vb):vb.localeCompare(va);});\n  _renderSfxRows(_sfxData);}\nfunction _renderSfxRows(sfx){\n  var tbody=document.querySelector(\'#sfxTbl tbody\');\n  if(!tbody) return;\n  var rows=\'\';\n  sfx.forEach(function(s,i){\n    var cvId=\'wv-sfxr-\'+i;\n    rows+=\'<tr>\';\n    rows+=\'<td><code style="font-size:11px;color:var(--text)">\'+esc(s.label)+\'</code></td>\';\n    rows+=\'<td>\'+s.scenes.map(function(k){return \'<span class="sfx-sc">\'+esc(k)+\'</span>\';}).join(\'\')+\'</td>\';\n    if(s.has_file){\n      rows+=\'<td><span class="sfx-ok">&#10003; Ready</span></td>\';\n      rows+=\'<td><button class="audio-btn" onclick="playAudio(this,\\\'\'+esc(s.file_path)+\'\\\',\\\'\'+cvId+\'\\\')">&#9654;</button></td>\';\n    }else{\n      rows+=\'<td><span class="sfx-miss">&#10007; Missing</span></td>\';\n      rows+=\'<td><span style="color:var(--dim)">&#8212;</span></td>\';}\n    rows+=\'<td><canvas id="\'+cvId+\'" class="waveform" width="140" height="32"></canvas></td>\';\n    rows+=\'</tr>\';\n  });\n  tbody.innerHTML=rows;\n}\ninit();\n</script>\n</body>\n</html>'


# ---------- Server subclass -------------------------------------------------
def _patch_html_runtime(html):
    """Small post-build patches for the embedded GUI string."""
    def _r(source, old, new):
        return source.replace(old.replace('\\n', '\n'), new.replace('\\n', '\n'))

    html = _r(html,
        ".ref-card{cursor:pointer;border-radius:6px;overflow:hidden;width:56px}",
        ".ref-card{cursor:pointer;border-radius:6px;overflow:hidden;width:56px;position:relative}"
    )
    html = _r(html,
        ".no-refs{font-size:11px;color:var(--dim)}",
        ".no-refs{font-size:11px;color:var(--dim)}\\n"
        ".ref-help{display:none;position:absolute;left:0;top:62px;width:260px;z-index:30;background:var(--bg);border:1px solid var(--bord);border-radius:7px;padding:8px 9px;color:var(--text);font-size:10px;line-height:1.45;box-shadow:0 8px 24px rgba(0,0,0,.35)}\\n"
        ".ref-card:hover .ref-help{display:block}"
    )
    html = _r(html,
        "/* ---- settings ---- */",
        "/* ---- workflow guide ---- */\n"
        ".guide-wrap{height:100%;overflow-y:auto;padding:22px 28px;max-width:1120px}\n"
        ".guide-title{font-size:18px;font-weight:650;margin-bottom:6px;color:var(--text)}\n"
        ".guide-sub{font-size:12px;color:var(--muted);margin-bottom:18px;line-height:1.5}\n"
        ".guide-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;margin-bottom:18px}\n"
        ".guide-card{background:var(--surf);border:1px solid var(--bord);border-radius:8px;padding:13px 14px}\n"
        ".guide-card h3{font-size:12px;color:var(--blue);margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em}\n"
        ".guide-card ul{padding-left:17px;margin:0;color:var(--muted);font-size:12px;line-height:1.55}\n"
        ".guide-card li{margin:3px 0}\n"
        ".guide-code{display:block;background:var(--bg);border:1px solid var(--bord);border-radius:6px;padding:7px 8px;margin:6px 0;color:var(--text);font:11px/1.45 monospace;white-space:pre-wrap;word-break:break-word}\n"
        ".guide-flow{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}\n"
        ".guide-flow th{text-align:left;background:var(--surf2);color:var(--muted);font-weight:600;padding:8px;border-bottom:1px solid var(--bord)}\n"
        ".guide-flow td{vertical-align:top;padding:8px;border-bottom:1px solid rgba(48,54,61,.55);color:var(--muted);line-height:1.45}\n"
        ".guide-flow code{color:var(--text);font-size:11px}\n\n"
        "/* ---- settings ---- */"
    )
    html = _r(html,
        "/* ---- characters tab ---- */\\n.chars-wrap{flex:1;overflow-y:auto;padding:16px;\\n            display:flex;flex-wrap:wrap;gap:14px;align-content:flex-start}\\n.char-card{background:var(--surf);border:1px solid var(--bord);border-radius:8px;\\n           overflow:hidden;width:130px;cursor:pointer;transition:border-color .15s}\\n.char-card:hover{border-color:var(--blue)}\\n.char-card img{width:130px;height:150px;object-fit:cover;display:block}\\n.char-cname{padding:6px 8px;font-size:11px;font-weight:600;text-align:center;\\n            color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\\n.char-csrc{font-size:9px;color:var(--dim);text-align:center;padding-bottom:6px}\\n",
        "/* ---- characters tab ---- */\\n.chars-wrap{flex:1;overflow-y:auto;padding:14px;display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;align-content:start}\\n.char-card{background:var(--surf);border:1px solid var(--bord);border-radius:8px;overflow:hidden;min-height:210px;transition:border-color .15s}\\n.char-card:hover{border-color:var(--blue)}\\n.char-img{height:132px;background:var(--surf2);display:flex;align-items:center;justify-content:center;color:var(--dim);font-size:11px}\\n.char-img img{width:100%;height:100%;object-fit:cover;display:block;cursor:zoom-in}\\n.char-body{padding:10px}\\n.char-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:7px}\\n.char-cname{font-size:13px;font-weight:650;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\\n.char-stat{font-size:9px;font-weight:700;border-radius:4px;padding:2px 6px;text-transform:uppercase}\\n.char-stat.ok{background:rgba(63,185,80,.15);color:var(--green)}\\n.char-stat.miss{background:rgba(248,81,73,.12);color:var(--red)}\\n.char-meta{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0}\\n.char-meta span{font-size:10px;background:var(--surf2);border:1px solid var(--bord);border-radius:4px;color:var(--muted);padding:2px 5px}\\n.char-prompt{font-size:10px;line-height:1.45;color:var(--dim);max-height:58px;overflow:hidden}\\n"
    )
    html = _r(html,
        "document.getElementById('nr').textContent=b.char_refs.length;",
        "document.getElementById('nr').textContent=(b.characters||[]).length;"
    )
    html = _r(html,
        "document.getElementById('tbadge-chars').textContent=b.char_refs.length;",
        "document.getElementById('tbadge-chars').textContent=(b.characters||[]).length;"
    )
    html = _r(html,
        "refsEl.innerHTML=b.char_refs.map(function(r){\\n      return '<div class=\"ref-card\"><img src=\"/api/file?path='+encodeURIComponent(r.path)+'\" alt=\"'+esc(r.name)+'\" onerror=\"this.style.opacity=.2\">'+\\n             '<div class=\"rname\">'+esc(r.name)+'</div></div>';\\n    }).join('');",
        "refsEl.innerHTML=b.char_refs.map(function(r){\\n      var note='Create/refine character image: open skills/comfyui_workflows/character_portrait_gen.json in ComfyUI, save output as .casts/'+book.slug+'/CHARACTER_REFS/'+r.name+'.png, then run python skills/generate_images.py --folder .casts/'+book.slug+' --backend comfyui';\\n      return '<div class=\"ref-card\" title=\"'+esc(note)+'\"><img src=\"/api/file?path='+encodeURIComponent(r.path)+'\" alt=\"'+esc(r.name)+'\" onerror=\"this.style.opacity=.2\">'+\\n             '<div class=\"rname\">'+esc(r.name)+'</div><div class=\"ref-help\">'+esc(note)+'</div></div>';\\n    }).join('');"
    )
    html = _r(html,
        "el.innerHTML='<div class=\"tab-empty\"><div class=\"tab-empty-ico\">🎙️</div><div class=\"tab-empty-txt\">No .wav files in voice/ folder</div></div>';",
        "el.innerHTML='<div class=\"tab-empty\"><div class=\"tab-empty-ico\">🎙️</div><div class=\"tab-empty-txt\">No .mp3 or .wav files in voice/ folder</div></div>';"
    )
    html = _r(html,
        "bar.textContent=d.total+' voice recordings';",
        "bar.textContent=d.total+' voice recordings - source: '+(d.source==='supabase'?'Supabase audio_url':'local voice folder');"
    )
    html = _r(html,
        "html+='<span class=\"vsize\">'+v.size+'KB</span>';",
        "html+='<span class=\"vsize\">'+(v.source==='supabase'?'SUPABASE':esc((v.format||'audio').toUpperCase())+' '+v.size+'KB')+'</span>';"
    )
    html = _r(html,
        "var a=new Audio('/api/file?path='+encodeURIComponent(filePath));",
        "var audioSrc=/^https?:\\/\\//i.test(filePath)?filePath:'/api/file?path='+encodeURIComponent(filePath);\n  var a=new Audio(audioSrc);"
    )
    html = _r(html,
        "  <button class=\"tab-btn\" id=\"tb-settings\" onclick=\"switchTab('settings')\">⚙️ Settings</button>\n</div>",
        "  <button class=\"tab-btn\" id=\"tb-guide\" onclick=\"switchTab('guide')\">Workflow Guide</button>\n  <button class=\"tab-btn\" id=\"tb-settings\" onclick=\"switchTab('settings')\">⚙️ Settings</button>\n</div>"
    )
    guide_html = (
        "    <!-- WORKFLOW GUIDE TAB -->\n"
        "    <div class=\"tab-pane\" id=\"tab-guide\">\n"
        "      <div class=\"guide-wrap\">\n"
        "        <div class=\"guide-title\">Workflow Guide</div>\n"
        "        <div class=\"guide-sub\">End-to-end PageCast production reference. Supabase is the source of truth for generated voice audio; local voice files are fallback only.</div>\n"
        "        <div class=\"guide-grid\">\n"
        "          <div class=\"guide-card\"><h3>Start</h3><ul><li>Run from repo root.</li><li>Open the local GUI.</li><li>Select a book from the header.</li></ul><code class=\"guide-code\">cd \"C:\\Users\\user\\Documents\\00 StoryBook\\pageCast\"\npython skills/pageCast_gui.py\nhttp://localhost:7823</code></div>\n"
        "          <div class=\"guide-card\"><h3>Script</h3><ul><li>Save PageCast scripts under .casts/&lt;book-slug&gt;/.</li><li>Characters come from dialogue and thought tags.</li><li>SFX and ambience are discovered from script tags.</li></ul><code class=\"guide-code\"># Chapter 1: Title\n## Scene 1: Title\n[LOCATION]\n...\n[DIALOGUE: Bertie | emotion=curious]\n...\n[THOUGHT: Bertie]\n...\n[SFX: door_creak]</code></div>\n"
        "          <div class=\"guide-card\"><h3>Characters</h3><ul><li>Characters tab is script-derived.</li><li>Edit character prompts in the Characters tab.</li><li>Prompts save beside character refs.</li><li>Image status is progress, not the source list.</li></ul><code class=\"guide-code\">.casts/&lt;book&gt;/CHARACTER_REFS/Bertie.prompt.txt\n.casts/&lt;book&gt;/CHARACTER_REFS/Bertie.png</code></div>\n"
        "          <div class=\"guide-card\"><h3>Images</h3><ul><li>Edit scene prompts in Images tab.</li><li>Generate scene images from prompt file.</li><li>Use ComfyUI for character reference consistency.</li></ul><code class=\"guide-code\">python skills/generate_images.py --folder \".casts/&lt;book-slug&gt;\" --style-pick 2\npython skills/generate_images.py --folder \".casts/&lt;book-slug&gt;\" --backend comfyui --style-pick 2</code></div>\n"
        "          <div class=\"guide-card\"><h3>Character Images</h3><ul><li>Use the portrait workflow in ComfyUI.</li><li>Save output into book-level CHARACTER_REFS.</li><li>Hover refs in Images tab for the reminder.</li></ul><code class=\"guide-code\">skills/comfyui_workflows/character_portrait_gen.json\n.casts/&lt;book&gt;/CHARACTER_REFS/&lt;Character&gt;.png</code></div>\n"
        "          <div class=\"guide-card\"><h3>SFX / Ambience</h3><ul><li>SFX tab checks required tags against local files.</li><li>Ambience files sit in the book ambience folder.</li></ul><code class=\"guide-code\">python skills/generate_sfx.py --folder \".casts/&lt;book-slug&gt;\"\npython skills/fetch_sfx.py --folder \".casts/&lt;book-slug&gt;\"\npython skills/generate_ambience.py --folder \".casts/&lt;book-slug&gt;\"\npython skills/fetch_ambience.py --folder \".casts/&lt;book-slug&gt;\"</code></div>\n"
        "          <div class=\"guide-card\"><h3>Voice</h3><ul><li>Creator Studio and Supabase are the source of truth.</li><li>GUI Voice tab reads blocks.audio_url directly.</li><li>Do not download local voice unless there is a special audit need.</li></ul><code class=\"guide-code\">python skills/voice_producer.py --book \"The Boy With the Grey Pebble\" --gemini-key YOUR_KEY\npython skills/voice_producer.py --book \"GLITCH\" --chapter 2 --scene 3 --gemini-key YOUR_KEY</code></div>\n"
        "          <div class=\"guide-card\"><h3>Supabase Audit</h3><ul><li>Audit remote voice coverage without downloading.</li><li>--download is explicit and should be avoided unless needed.</li></ul><code class=\"guide-code\">python skills/sync_supabase_voices.py --list-books\npython skills/sync_supabase_voices.py --book \"The Boy With the Grey Pebble\"\npython skills/sync_supabase_voices.py --book \"The Boy With the Grey Pebble\" --download</code></div>\n"
        "        </div>\n"
        "        <table class=\"guide-flow\"><thead><tr><th>Stage</th><th>Skill / Script</th><th>Output / Check</th></tr></thead><tbody>\n"
        "          <tr><td>Write/import story</td><td><code>storybook-writer.skill</code><br><code>storybook-importer.skill</code><br><code>castlet-writer.skill</code></td><td><code>*_pagecast.txt</code> inside <code>.casts/&lt;book&gt;/</code></td></tr>\n"
        "          <tr><td>Scene prompts</td><td><code>storybook-image-prompt.skill</code><br><code>scene-prompt-writer/scene_prompt_writer.py</code></td><td><code>*_image_prompts.txt</code>; editable in Images tab</td></tr>\n"
        "          <tr><td>Characters</td><td>Script tags plus Characters tab prompt editor</td><td>Character cards, prompt status, image status, voice count</td></tr>\n"
        "          <tr><td>Images</td><td><code>generate_images.py</code><br><code>scene-image-producer.skill</code></td><td><code>images/*.jpg</code> and <code>cover.jpg</code></td></tr>\n"
        "          <tr><td>SFX</td><td><code>sfx-producer.skill</code><br><code>generate_sfx.py</code><br><code>fetch_sfx.py</code></td><td><code>sfx/*.mp3</code>; checked in SFX tab</td></tr>\n"
        "          <tr><td>Ambience</td><td><code>ambience-producer.skill</code><br><code>generate_ambience.py</code><br><code>fetch_ambience.py</code></td><td><code>ambience/*.mp3</code></td></tr>\n"
        "          <tr><td>Voice</td><td><code>voice_producer.py</code></td><td>Supabase Storage <code>assets</code> bucket and <code>blocks.audio_url</code></td></tr>\n"
        "          <tr><td>Review</td><td><code>pageCast_gui.py</code></td><td>Images, SFX, Voice, Script, Characters, Manuscripts, Dashboard</td></tr>\n"
        "        </tbody></table>\n"
        "      </div>\n"
        "    </div>\n\n"
    )
    html = _r(html,
        "    <!-- ═══ SETTINGS TAB ═══ -->\n    <div class=\"tab-pane\" id=\"tab-settings\">",
        guide_html + "    <!-- ═══ SETTINGS TAB ═══ -->\n    <div class=\"tab-pane\" id=\"tab-settings\">"
    )
    html = _r(html,
        "var _pmKey=null, _pmSlug=null;",
        "var _pmKey=null, _pmSlug=null, _pmMode='scene', _pmChar=null;"
    )
    html = _r(html,
        "function openPm(e,key){\n  e.stopPropagation();",
        "function openPm(e,key){\n  _pmMode='scene'; _pmChar=null;\n  e.stopPropagation();"
    )
    html = _r(html,
        "function closePm(){document.getElementById('pm').classList.remove('open');}\nasync function savePrompt(){",
        "function closePm(){document.getElementById('pm').classList.remove('open');}\nfunction openCharPm(e,name,prompt){\n  e.stopPropagation();\n  if(!book) return;\n  _pmMode='char'; _pmSlug=book.slug; _pmChar=name; _pmKey=null;\n  document.getElementById('pm-title').textContent='Edit Character Prompt - '+name;\n  document.getElementById('pm-ta').value=prompt||'';\n  document.getElementById('pm-info').textContent='Saved to .casts/'+book.slug+'/CHARACTER_REFS/'+name+'.prompt.txt';\n  document.getElementById('pm').classList.add('open');\n  document.getElementById('pm-ta').focus();\n}\nasync function saveCharPrompt(){\n  var prompt=document.getElementById('pm-ta').value.trim(); if(!prompt) return;\n  document.getElementById('pm-info').textContent='Saving...';\n  var r=await fetch('/api/save_char_prompt',{method:'POST',headers:{'Content-Type':'application/json'},\n    body:JSON.stringify({slug:_pmSlug,name:_pmChar,prompt:prompt})});\n  var res=await r.json();\n  if(res.error){document.getElementById('pm-info').textContent='Error: '+res.error;return;}\n  if(book&&book.characters){book.characters.forEach(function(c){if(c.name===_pmChar){c.prompt=prompt;c.prompt_status='draft';}});}\n  document.getElementById('pm-info').textContent='Saved to '+res.file;\n  loadChars();\n  setTimeout(closePm,900);\n}\nasync function savePrompt(){\n  if(_pmMode==='char') return saveCharPrompt();"
    )

    html = _r(html,
        "/* ---- characters tab ---- */\\n.chars-wrap{flex:1;overflow-y:auto;padding:16px;\\n            display:flex;flex-wrap:wrap;gap:14px;align-content:flex-start}",
        "/* ---- characters tab ---- */\\n.chars-wrap{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:0}\\n.chars-bar{padding:6px 2px;font-size:12px;color:var(--muted);margin-bottom:10px;flex-shrink:0}\\n.char-row{display:flex;gap:14px;padding:12px 14px;background:var(--surf);border:1px solid var(--bord);border-radius:8px;margin-bottom:8px;align-items:flex-start;transition:border-color .15s}\\n.char-row:hover{border-color:var(--blue)}\\n.char-row-img{width:70px;min-width:70px;height:90px;border-radius:6px;object-fit:cover;cursor:zoom-in;display:block}\\n.char-row-ph{width:70px;min-width:70px;height:90px;border-radius:6px;background:var(--surf2);display:flex;align-items:center;justify-content:center;color:var(--dim);font-size:28px}\\n.char-row-body{flex:1;min-width:0}\\n.char-row-name{font-size:14px;font-weight:700;color:var(--text);margin-bottom:7px}\\n.char-row-badges{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px}\\n.char-badge{font-size:10px;font-weight:600;padding:2px 7px;border-radius:4px;border:1px solid transparent}\\n.char-badge.ok{background:rgba(63,185,80,.12);color:var(--green);border-color:rgba(63,185,80,.25)}\\n.char-badge.miss{background:rgba(248,81,73,.08);color:var(--red);border-color:rgba(248,81,73,.2)}\\n.char-badge.dim{background:var(--surf2);color:var(--muted);border-color:var(--bord)}\\n.char-row-prompt{font-size:11px;color:var(--muted);line-height:1.6;margin-bottom:8px;max-height:80px;overflow-y:auto;padding-right:4px;white-space:pre-wrap;word-break:break-word}\\n.char-row-footer{display:flex;gap:8px;align-items:center}\\n.ch-pm-btn{padding:3px 10px;background:var(--surf2);border:1px solid var(--bord);border-radius:4px;color:var(--text);font-size:11px;cursor:pointer}\\n.ch-pm-btn:hover{border-color:var(--blue);color:var(--blue)}"
    )

    html = _r(html,
        "/* ---- characters tab ---- */\\n.chars-wrap{flex:1;overflow-y:auto;padding:16px;\\n            display:flex;flex-wrap:wrap;gap:14px;align-content:flex-start}",
        "/* ---- characters tab ---- */\\n.chars-wrap{flex:1;overflow-y:auto;display:flex;flex-direction:column}\\n.chars-bar{padding:8px 12px;font-size:12px;color:var(--muted);border-bottom:1px solid var(--bord);flex-shrink:0}\\n.char-thumb{width:36px;height:36px;object-fit:cover;border-radius:4px;display:block;cursor:zoom-in}\\n.char-thumb-ph{width:36px;height:36px;background:var(--surf2);border-radius:4px;display:flex;align-items:center;justify-content:center;color:var(--dim);font-size:16px}\\n.ch-ok{color:var(--green);font-size:10px;font-weight:600}\\n.ch-miss{color:var(--red);font-size:10px;font-weight:600}\\n.ch-pm-btn{padding:2px 8px;background:var(--surf2);border:1px solid var(--bord);border-radius:4px;color:var(--text);font-size:10px;cursor:pointer;white-space:nowrap}\\n.ch-pm-btn:hover{border-color:var(--blue);color:var(--blue)}\\n.char-prompt-cell{font-size:10px;color:var(--dim);max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}"
    )

    return html

class _Server(socketserver.ThreadingTCPServer):
    daemon_threads      = True   # SSE threads won't block process exit
    allow_reuse_address = True

    def handle_error(self, request, client_address):
        """Suppress noisy Windows connection-abort errors on Ctrl+C."""
        exc = sys.exc_info()[1]
        if isinstance(exc, (ConnectionAbortedError, ConnectionResetError, BrokenPipeError)):
            return
        if isinstance(exc, OSError) and getattr(exc, 'winerror', None) in (10053, 10054):
            return
        super().handle_error(request, client_address)

# ---------- Main ------------------------------------------------------------
if __name__ == '__main__':
    import webbrowser
    server = _Server(('localhost', PORT), Handler)
    url = 'http://localhost:{}'.format(PORT)
    print('pageCast Image Pipeline GUI')
    print('ROOT     :', ROOT.resolve())
    print('CASTS    :', CASTS_DIR.resolve())
    import os
    books_found = [d.name for d in sorted(CASTS_DIR.iterdir())
                   if d.is_dir() and d.name.upper() != 'CHARACTER_REFS'
                   and list(d.glob('*_pagecast.txt'))] if CASTS_DIR.exists() else []
    print('Books    :', len(books_found), '->', ', '.join(books_found[:5]),
          '...' if len(books_found) > 5 else '')
    print('Running at: ' + url)
    print('Press Ctrl+C to stop.')
    threading.Timer(0.9, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        print('\nStopped.')
