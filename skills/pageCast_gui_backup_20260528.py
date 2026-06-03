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

# ---------- State -----------------------------------------------------------
_gen_proc  = None
_gen_lock  = threading.Lock()
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
            elif rt == '/api/workflows': self._json(list_workflows())
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
        elif p.path == '/api/save_prompt':  self._json(save_prompt(body))
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

def list_books():
    books = []
    if not CASTS_DIR.exists(): return books
    for d in sorted(CASTS_DIR.iterdir()):
        if not d.is_dir() or d.name.upper() == 'CHARACTER_REFS': continue
        txts = list(d.glob('*_pagecast.txt'))
        if not txts: continue
        img_dir = d / 'images'
        n_img   = len(list(img_dir.glob('*.jpg'))) if img_dir.exists() else 0
        n_sc    = sum(len(re.findall(r'^## Scene', f.read_text(encoding='utf-8',errors='replace'), re.M|re.I)) for f in txts)
        cover   = '.casts/{}/cover.jpg'.format(d.name) if (d/'cover.jpg').exists() else None
        books.append({'slug': d.name, 'title': d.name.replace('-',' ').title(),
                      'scenes': n_sc, 'images': n_img, 'cover': cover})
    return books


def get_book(slug):
    folder = CASTS_DIR / slug
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

        ch_pat = re.compile(r'^#\s+(?:Chapter|Bab|CHAPTER)\s+(\d+):\s*(.+)$', re.M | re.I)
        sc_pat = re.compile(r'^##\s+Scene\s+(\d+):\s*(.+)$',                  re.M | re.I)
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
    char_refs = {}
    for ref_dir in (CASTS_DIR/'CHARACTER_REFS', folder/'CHARACTER_REFS'):
        if ref_dir.exists():
            for f in sorted(ref_dir.iterdir()):
                if f.suffix.lower() in ('.jpg','.jpeg','.png','.webp'):
                    rel = str(f.relative_to(ROOT)).replace('\\', '/')
                    char_refs[f.stem] = rel   # book overrides series

    return {'slug': slug, 'genre': genre, 'scenes': scenes,
            'char_refs': [{'name': k, 'path': v} for k, v in sorted(char_refs.items())],
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
        folder = CASTS_DIR / slug
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


def list_workflows():
    """Return list of ComfyUI workflow JSON filenames (without extension)."""
    wf_dir = SKILLS_DIR / 'comfyui_workflows'
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
    folder = CASTS_DIR / slug
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

# ---------- Embedded HTML ---------------------------------------------------
HTML = '''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>pageCast Image Pipeline</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0d1117;--surf:#161b22;--surf2:#21262d;--bord:#30363d;
  --text:#e6edf3;--muted:#8b949e;--dim:#484f58;
  --blue:#58a6ff;--green:#3fb950;--yellow:#d29922;--red:#f85149;
  --sidebar:290px;
}
html,body{height:100%;overflow:hidden}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
     background:var(--bg);color:var(--text);display:flex;flex-direction:column}

/* ---- header ---- */
.hdr{display:flex;align-items:center;justify-content:space-between;
     padding:10px 18px;background:var(--surf);border-bottom:1px solid var(--bord);flex-shrink:0}
.hdr-logo{font-size:15px;font-weight:600;letter-spacing:.02em}
.hdr-logo span{color:var(--blue)}
.hdr-status{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--muted)}
.dot{width:8px;height:8px;border-radius:50%;background:var(--dim)}
.dot.run{background:var(--yellow);animation:pulse 1.2s ease-in-out infinite}
.dot.done{background:var(--green)}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}

/* ---- layout ---- */
.layout{display:flex;flex:1;overflow:hidden}

/* ---- sidebar ---- */
.side{width:var(--sidebar);flex-shrink:0;background:var(--surf);
      border-right:1px solid var(--bord);display:flex;flex-direction:column;overflow-y:auto}
.sec{padding:14px 16px;border-bottom:1px solid var(--bord)}
.sec-ttl{font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;
         color:var(--dim);margin-bottom:10px}
label{display:block;font-size:11px;color:var(--muted);margin-bottom:3px;margin-top:8px}
label:first-child{margin-top:0}
select,input[type=text],input[type=url],input[type=number]{
  width:100%;background:var(--bg);border:1px solid var(--bord);color:var(--text);
  padding:6px 9px;border-radius:6px;font-size:12px;outline:none;margin-bottom:2px}
select:focus,input:focus{border-color:var(--blue)}
.chk-row{display:flex;align-items:center;gap:7px;font-size:12px;margin:6px 0}
input[type=checkbox]{accent-color:var(--blue)}

/* ---- book stats ---- */
.b-stats{display:flex;gap:18px;margin-top:10px}
.stat strong{display:block;font-size:22px;font-weight:700;line-height:1}
.stat span{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}

/* ---- char refs ---- */
.refs{display:flex;flex-wrap:wrap;gap:8px}
.ref-card{display:flex;flex-direction:column;align-items:center;gap:4px}
.ref-card img{width:50px;height:64px;object-fit:cover;border-radius:5px;
              border:2px solid var(--bord);background:var(--surf2)}
.ref-card .rname{font-size:9px;color:var(--muted);max-width:50px;
                 overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center}
.no-refs{font-size:12px;color:var(--dim);font-style:italic}

/* ---- run buttons ---- */
.btn-row{padding:14px 16px;display:flex;gap:8px;flex-shrink:0;margin-top:auto}
.btn{flex:1;padding:8px;border:none;border-radius:6px;font-size:12px;
     font-weight:600;cursor:pointer;transition:opacity .15s}
.btn:disabled{opacity:.3;cursor:not-allowed}
.btn:not(:disabled):hover{opacity:.8}
.btn-run{background:var(--blue);color:#fff}
.btn-stop{background:var(--red);color:#fff}

/* ---- content ---- */
.content{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0}
.scenes{flex:1;overflow-y:auto;padding:18px}
.empty{display:flex;align-items:center;justify-content:center;
       height:100%;color:var(--dim);font-size:14px}

/* ---- chapter group ---- */
.ch-group{margin-bottom:28px}
.ch-lbl{font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;
        color:var(--dim);margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--bord)}
.scene-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:12px}

/* ---- scene card ---- */
.card{background:var(--surf);border:1px solid var(--bord);border-radius:10px;
      overflow:hidden;display:flex;flex-direction:column}
.card.gen{border-color:var(--yellow)}
.card.done{border-color:#2ea043}
.card.fail{border-color:var(--red)}

/* image area */
.img-wrap{width:100%;aspect-ratio:16/9;background:var(--bg);position:relative;
          overflow:hidden;cursor:pointer;display:flex;align-items:center;justify-content:center}
.img-wrap img{width:100%;height:100%;object-fit:cover;display:block}
.img-ph{display:flex;flex-direction:column;align-items:center;gap:6px;color:var(--dim)}
.img-ph svg{opacity:.4}
.img-ph .ph-lbl{font-size:10px}
.gen-overlay{position:absolute;inset:0;background:rgba(210,153,34,.06);
             display:flex;align-items:center;justify-content:center}
.spin{width:28px;height:28px;border:3px solid rgba(210,153,34,.2);
      border-top-color:var(--yellow);border-radius:50%;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}

/* card body */
.cbody{padding:11px;display:flex;flex-direction:column;gap:5px}
.c-hdr{display:flex;align-items:flex-start;justify-content:space-between;gap:6px}
.sc-num{font-size:9px;font-weight:700;letter-spacing:.05em;color:var(--blue);
        background:rgba(88,166,255,.1);padding:2px 6px;border-radius:3px;flex-shrink:0}
.sc-ttl{font-size:12px;font-weight:600;line-height:1.3;flex:1}
.meta-row{display:flex;flex-wrap:wrap;gap:3px}
.mpill{background:var(--surf2);padding:2px 6px;border-radius:3px;
       font-size:9px;color:var(--muted);max-width:120px;overflow:hidden;
       text-overflow:ellipsis;white-space:nowrap}
.cpills{display:flex;flex-wrap:wrap;gap:3px}
.cpill{background:rgba(88,166,255,.1);color:#79c0ff;
       padding:2px 7px;border-radius:3px;font-size:9px;font-weight:500}
.prompt{font-size:10px;color:var(--muted);line-height:1.5;
        overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical}
.sbadge{display:inline-flex;align-items:center;gap:4px;font-size:9px;font-weight:600;
        padding:2px 8px;border-radius:3px;letter-spacing:.04em;align-self:flex-start}
.s-pend{background:rgba(72,79,88,.2);color:var(--dim)}
.s-gen{background:rgba(210,153,34,.15);color:var(--yellow)}
.s-done{background:rgba(63,185,80,.15);color:var(--green)}
.s-skip{background:rgba(72,79,88,.1);color:var(--dim)}
.s-fail{background:rgba(248,81,73,.15);color:var(--red)}

/* ---- log panel ---- */
.log{height:160px;flex-shrink:0;background:var(--bg);border-top:1px solid var(--bord);
     display:flex;flex-direction:column}
.log-hdr{display:flex;align-items:center;justify-content:space-between;
         padding:5px 14px;border-bottom:1px solid var(--bord);flex-shrink:0}
.log-hdr span{font-size:10px;font-weight:600;letter-spacing:.08em;
              text-transform:uppercase;color:var(--dim)}
.log-clr{font-size:10px;color:var(--dim);background:none;border:none;
         cursor:pointer;padding:2px 5px}
.log-clr:hover{color:var(--muted)}
.log-body{flex:1;overflow-y:auto;padding:6px 14px;
          font-family:"Cascadia Code","SF Mono","Consolas",monospace;font-size:10px;line-height:1.6}
.ll{color:var(--dim)}
.ll.inf{color:var(--muted)}
.ll.ok{color:var(--green)}
.ll.warn{color:var(--yellow)}
.ll.err{color:var(--red)}

/* ---- prompt modal ---- */
.pm{display:none;position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:998;
    align-items:center;justify-content:center}
.pm.open{display:flex}
.pm-box{background:var(--surf);border:1px solid var(--bord);border-radius:10px;
        width:min(640px,94vw);display:flex;flex-direction:column;overflow:hidden}
.pm-hdr{display:flex;align-items:center;justify-content:space-between;
        padding:12px 16px;border-bottom:1px solid var(--bord)}
.pm-hdr span{font-size:13px;font-weight:600}
.pm-hdr button{background:none;border:none;color:var(--muted);cursor:pointer;font-size:18px}
.pm-hdr button:hover{color:var(--text)}
.pm-ta{width:100%;background:var(--bg);border:none;color:var(--text);
       font-family:"Cascadia Code","SF Mono","Consolas",monospace;font-size:11px;
       line-height:1.6;padding:14px;resize:vertical;min-height:160px;outline:none}
.pm-foot{display:flex;align-items:center;justify-content:space-between;
         padding:10px 14px;border-top:1px solid var(--bord);gap:8px}
.pm-info{font-size:10px;color:var(--dim);flex:1}
.pm-foot .btn{flex:0 0 auto;padding:7px 18px}
.wf-note{font-size:10px;color:var(--dim);margin-top:6px;line-height:1.5;
         background:rgba(88,166,255,.06);border-radius:5px;padding:7px 9px}

/* ---- edit button on prompt ---- */
.prompt-wrap{position:relative}
.prompt-wrap:hover .edit-btn{opacity:1}
.edit-btn{position:absolute;top:0;right:0;opacity:0;background:var(--surf2);
          border:1px solid var(--bord);color:var(--muted);font-size:9px;
          padding:2px 6px;border-radius:3px;cursor:pointer;transition:opacity .15s}
.edit-btn:hover{color:var(--blue);border-color:var(--blue)}

/* ---- lightbox ---- */
.lb{display:none;position:fixed;inset:0;background:rgba(0,0,0,.92);
    z-index:999;align-items:center;justify-content:center}
.lb.open{display:flex}
.lb img{max-width:90vw;max-height:90vh;border-radius:8px}
.lb-x{position:fixed;top:18px;right:20px;font-size:22px;color:#fff;
      background:none;border:none;cursor:pointer;line-height:1}
</style>
</head>
<body>

<div class="hdr">
  <div class="hdr-logo">page<span>Cast</span> image pipeline</div>
  <div class="hdr-status">
    <div class="dot" id="dot"></div>
    <span id="st-txt">Idle</span>
  </div>
</div>

<div class="layout">
  <!-- sidebar -->
  <div class="side">
    <div class="sec">
      <div class="sec-ttl">Book</div>
      <select id="bookSel" onchange="loadBook(this.value)">
        <option value="">— select a book —</option>
      </select>
      <div class="b-stats" id="bstats" style="display:none">
        <div class="stat"><strong id="ns">0</strong><span>Scenes</span></div>
        <div class="stat"><strong id="ni">0</strong><span>Images</span></div>
        <div class="stat"><strong id="nr">0</strong><span>Refs</span></div>
      </div>
      <img id="coverImg" alt="Cover" style="display:none;width:100%;border-radius:7px;margin-top:12px;border:1px solid var(--bord);object-fit:cover;max-height:200px;cursor:pointer" onclick="openLb(this.src)">
    </div>

    <div class="sec">
      <div class="sec-ttl">Character references</div>
      <div class="refs" id="refs"><div class="no-refs">Load a book first</div></div>
    </div>

    <div class="sec">
      <div class="sec-ttl">Configuration</div>
      <label>Backend</label>
      <select id="cBk" onchange="onBk()">
        <option value="comfyui">ComfyUI (local GPU)</option>
        <option value="pollinations">Pollinations.ai (free)</option>
        <option value="hf">HuggingFace Inference</option>
      </select>
      <div id="wfRow">
        <label>ComfyUI Workflow</label>
        <select id="cWf">
          <option value="">Auto (by character count)</option>
        </select>
        <div class="wf-note">0 chars → txt2img &nbsp;|&nbsp; 1 char → IPAdapter &nbsp;|&nbsp; 2 chars → dual IPAdapter</div>
      </div>
      <label>Style preset</label>
      <select id="cSt">
        <option value="1">Cinematic photo</option>
        <option value="2" selected>Concept art</option>
        <option value="3">Movie poster</option>
        <option value="4">Oil painting</option>
        <option value="5">Watercolour</option>
        <option value="6">3D render</option>
      </select>
      <div id="cuiOpts">
        <label>ComfyUI URL</label>
        <input type="url" id="cUrl" value="http://localhost:8000">
        <label>Model checkpoint</label>
        <input type="text" id="cMdl" value="juggernaut_xl_v9_lightning.safetensors">
      </div>
      <div id="hfOpts" style="display:none">
        <label>HuggingFace token</label>
        <input type="text" id="cHfT" placeholder="hf_...">
        <label>HF model</label>
        <select id="cHfM">
          <option value="dev">FLUX.1-dev (best quality)</option>
          <option value="schnell">FLUX.1-schnell (fastest)</option>
        </select>
      </div>
      <label>Width &nbsp;<small style="color:var(--dim)">(px)</small></label>
      <input type="number" id="cW" value="1024" min="256" step="64">
      <label>Height &nbsp;<small style="color:var(--dim)">(px)</small></label>
      <input type="number" id="cH" value="576" min="256" step="64">
      <div class="chk-row"><input type="checkbox" id="cOvr"><span>Overwrite existing images</span></div>
      <div class="chk-row"><input type="checkbox" id="cDbg"><span>Debug output</span></div>
    </div>

    <div class="btn-row">
      <button class="btn btn-run"  id="btnRun"  onclick="runPipeline()" disabled>&#9654; Run</button>
      <button class="btn btn-stop" id="btnStop" onclick="stopPipeline()" disabled>&#9632; Stop</button>
    </div>
  </div>

  <!-- content -->
  <div class="content">
    <div class="scenes" id="scenes">
      <div class="empty">Select a book from the sidebar to begin</div>
    </div>
    <div class="log">
      <div class="log-hdr">
        <span>Output log</span>
        <button class="log-clr" onclick="clearLog()">Clear</button>
      </div>
      <div class="log-body" id="logBody"></div>
    </div>
  </div>
</div>

<div class="pm" id="pm">
  <div class="pm-box">
    <div class="pm-hdr">
      <span id="pm-title">Edit Prompt</span>
      <button onclick="closePm()">&#x2715;</button>
    </div>
    <textarea class="pm-ta" id="pm-ta" rows="8" spellcheck="false"></textarea>
    <div class="pm-foot">
      <span class="pm-info" id="pm-info"></span>
      <button class="btn btn-stop" style="background:var(--surf2);color:var(--muted)" onclick="closePm()">Cancel</button>
      <button class="btn btn-run" id="pm-save" onclick="savePrompt()">&#10003; Save</button>
    </div>
  </div>
</div>

<div class="lb" id="lb" onclick="closeLb()">
  <button class="lb-x" onclick="closeLb()">&#x2715;</button>
  <img id="lbImg" src="" alt="">
</div>

<script>
var book=null, scData={}, scSt={}, sse=null, running=false;

function init(){
  var books=/*BOOKS_JSON*/;
  var sel=document.getElementById('bookSel');
  books.forEach(function(b){
    var o=document.createElement('option');
    o.value=b.slug;
    o.textContent=b.title+' ('+b.scenes+' scenes, '+b.images+' images)';
    sel.appendChild(o);
  });
  log2('Loaded '+books.length+' books','ok');
  fetch('/api/status').then(function(r){return r.json()}).then(function(st){
    if(st.running) setRunning(true);
  });
  connectSSE();
  fetch('/api/workflows').then(function(r){return r.json()}).then(function(wfs){
    var sel=document.getElementById('cWf');
    wfs.forEach(function(wf){
      var o=document.createElement('option');
      o.value=wf; o.textContent=wf.replace(/_/g,' ');
      sel.appendChild(o);
    });
  });
}

async function loadBook(slug){
  if(!slug){
    book=null;
    document.getElementById('scenes').innerHTML='<div class="empty">Select a book from the sidebar to begin</div>';
    document.getElementById('bstats').style.display='none';
    document.getElementById('refs').innerHTML='<div class="no-refs">No book selected</div>';
    document.getElementById('btnRun').disabled=true;
    return;
  }
  var r=await fetch('/api/book?slug='+slug), b=await r.json();
  if(b.error){log2(b.error,'err');return}
  book=b; scData={}; scSt={};

  document.getElementById('ns').textContent=b.scenes.length;
  document.getElementById('ni').textContent=b.scenes.filter(function(s){return s.image}).length;
  document.getElementById('nr').textContent=b.char_refs.length;
  document.getElementById('bstats').style.display='flex';
  var coverEl=document.getElementById('coverImg');
  if(b.cover){coverEl.src='/api/file?path='+encodeURIComponent(b.cover)+'&t='+Date.now();coverEl.style.display='block';}
  else{coverEl.style.display='none';}

  var refsEl=document.getElementById('refs');
  if(!b.char_refs.length){
    refsEl.innerHTML='<div class="no-refs">No character refs found</div>';
  } else {
    refsEl.innerHTML=b.char_refs.map(function(r){
      return '<div class="ref-card"><img src="/api/file?path='+encodeURIComponent(r.path)+'" alt="'+esc(r.name)+'" onerror="this.style.opacity=.2">'+
             '<div class="rname">'+esc(r.name)+'</div></div>';
    }).join('');
  }

  b.scenes.forEach(function(s){
    scData[s.key]=s;
    scSt[s.key]=s.image?'done':'pend';
  });

  renderAll();
  document.getElementById('btnRun').disabled=false;
}

function renderAll(){
  if(!book){return}
  var chs={};
  book.scenes.forEach(function(s){
    if(!chs[s.chapter]) chs[s.chapter]=[];
    chs[s.chapter].push(s);
  });
  var html=Object.keys(chs).sort(function(a,b){return a-b}).map(function(ch){
    return '<div class="ch-group"><div class="ch-lbl">Chapter '+ch+'</div>'+
           '<div class="scene-grid">'+chs[ch].map(cardHtml).join('')+'</div></div>';
  }).join('');
  document.getElementById('scenes').innerHTML=html;
}

function cardHtml(s){
  var st=scSt[s.key]||'pend';
  var imgHtml;
  if(s.image && st!=='gen'){
    imgHtml='<img src="/api/file?path='+encodeURIComponent(s.image)+'" alt="'+esc(s.title)+'" loading="lazy" onclick="openLb(this.src)" onerror="this.parentElement.innerHTML=phHtml()">';
  } else if(st==='gen'){
    imgHtml='<div class="gen-overlay"><div class="spin"></div></div>'+
            '<div class="img-ph"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg><div class="ph-lbl">Generating…</div></div>';
  } else {
    imgHtml='<div class="img-ph"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg><div class="ph-lbl">Not yet generated</div></div>';
  }
  var stMap={pend:['s-pend','Pending'],gen:['s-gen','Generating'],done:['s-done','Done'],skip:['s-skip','Skipped'],fail:['s-fail','Failed']};
  var stInfo=stMap[st]||stMap.pend;
  var meta=[s.location,s.time,s.ambience].filter(Boolean).map(function(m){
    return '<span class="mpill">'+esc(m.substring(0,22))+'</span>';
  }).join('');
  var cpills=s.characters.length?'<div class="cpills">'+s.characters.map(function(c){return '<span class="cpill">'+esc(c)+'</span>'}).join('')+'</div>':'';
  return '<div class="card '+st+'" id="card-'+s.key+'">'+
    '<div class="img-wrap">'+imgHtml+'</div>'+
    '<div class="cbody">'+
      '<div class="c-hdr"><span class="sc-num">Sc'+s.scene+'</span><span class="sc-ttl">'+esc(s.title)+'</span></div>'+
      (meta?'<div class="meta-row">'+meta+'</div>':'')+
      (cpills||'')+
      '<div class="prompt-wrap"><div class="prompt" id="prompt-'+s.key+'">'+esc(s.prompt)+'</div>'+'<button class="edit-btn" data-key="'+s.key+'" onclick="openPm(event,this.dataset.key)" title="Edit prompt">&#9998; edit</button></div>'+
      '<span class="sbadge '+stInfo[0]+'">'+stInfo[1]+'</span>'+
    '</div></div>';
}

function phHtml(){
  return '<div class="img-ph"><div class="ph-lbl">Error loading image</div></div>';
}

function updateCard(key){
  var el=document.getElementById('card-'+key);
  if(!el||!scData[key]) return;
  var tmp=document.createElement('div');
  tmp.innerHTML=cardHtml(scData[key]);
  el.replaceWith(tmp.firstChild);
}

function connectSSE(){
  if(sse) sse.close();
  sse=new EventSource('/api/events');
  sse.onmessage=function(e){
    var ev=JSON.parse(e.data);
    if(ev.type==='log'){
      var cls=ev.text.match(/saved|done|ready/i)?'ok':ev.text.match(/error|fail/i)?'err':ev.text.match(/warning|skip/i)?'warn':'';
      log2(ev.text,cls);
    } else if(ev.type==='generating'){
      scSt[ev.key]='gen'; updateCard(ev.key);
    } else if(ev.type==='image_ready'){
      scSt[ev.key]='done';
      if(scData[ev.key]) scData[ev.key].image=ev.path;
      updateCard(ev.key);
      document.getElementById('ni').textContent=Object.values(scSt).filter(function(v){return v==='done'}).length;
    } else if(ev.type==='skipped'){
      scSt[ev.key]='skip'; updateCard(ev.key);
    } else if(ev.type==='failed'){
      if(ev.key) { scSt[ev.key]='fail'; updateCard(ev.key); }
    } else if(ev.type==='cover_ready'){
      log2('Cover image ready','ok');
      var ce=document.getElementById('coverImg');
      ce.src='/api/file?path='+encodeURIComponent(ev.path)+'&t='+Date.now();
      ce.style.display='block';
    } else if(ev.type==='done'){
      setRunning(false);
      log2('--- Generation finished (exit '+ev.exit_code+') ---',ev.exit_code===0?'ok':'err');
    }
  };
  sse.onerror=function(){ setTimeout(connectSSE,3000); };
}

async function runPipeline(){
  if(!book) return;
  var cfg={
    slug:book.slug, backend:document.getElementById('cBk').value,
    style_pick:parseInt(document.getElementById('cSt').value),
    comfyui_url:document.getElementById('cUrl').value,
    comfyui_model:document.getElementById('cMdl').value,
    hf_token:document.getElementById('cHfT').value,
    hf_model:document.getElementById('cHfM').value,
    width:parseInt(document.getElementById('cW').value),
    height:parseInt(document.getElementById('cH').value),
    overwrite:document.getElementById('cOvr').checked,
    debug:document.getElementById('cDbg').checked,
    force_workflow:document.getElementById('cWf').value
  };
  if(cfg.overwrite){
    Object.keys(scSt).forEach(function(k){scSt[k]='pend'});
    Object.values(scData).forEach(function(s){s.image=null});
    renderAll();
  }
  var r=await fetch('/api/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(cfg)});
  var res=await r.json();
  if(res.error){log2('Error: '+res.error,'err');return}
  setRunning(true);
  log2('--- Starting (pid '+res.pid+') ---','inf');
}

async function stopPipeline(){
  await fetch('/api/stop',{method:'POST'});
  log2('Stop requested…','warn');
}

function setRunning(v){
  running=v;
  document.getElementById('dot').className='dot'+(v?' run':' done');
  document.getElementById('st-txt').textContent=v?'Running':'Idle';
  document.getElementById('btnRun').disabled=v||!book;
  document.getElementById('btnStop').disabled=!v;
}

function onBk(){
  var v=document.getElementById('cBk').value;
  document.getElementById('cuiOpts').style.display=v==='comfyui'?'block':'none';
  document.getElementById('hfOpts').style.display=v==='hf'?'block':'none';
  document.getElementById('wfRow').style.display=v==='comfyui'?'block':'none';
}

function log2(txt,cls){
  var b=document.getElementById('logBody');
  var d=document.createElement('div');
  d.className='ll '+(cls||'');
  d.textContent=txt;
  b.appendChild(d);
  b.scrollTop=b.scrollHeight;
}

function clearLog(){ document.getElementById('logBody').innerHTML=''; }

var _pmKey=null, _pmSlug=null;
function openPm(e,key){
  e.stopPropagation();
  if(!book) return;
  _pmKey=key; _pmSlug=book.slug;
  var s=scData[key];
  if(!s) return;
  document.getElementById('pm-title').textContent='Edit Prompt — Sc'+s.scene+': '+s.title;
  document.getElementById('pm-ta').value=s.prompt||'';
  document.getElementById('pm-info').textContent='';
  document.getElementById('pm').classList.add('open');
  document.getElementById('pm-ta').focus();
}
function closePm(){ document.getElementById('pm').classList.remove('open'); }
async function savePrompt(){
  var prompt=document.getElementById('pm-ta').value.trim();
  if(!prompt) return;
  document.getElementById('pm-info').textContent='Saving…';
  var r=await fetch('/api/save_prompt',{method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({slug:_pmSlug,key:_pmKey,prompt:prompt})});
  var res=await r.json();
  if(res.error){ document.getElementById('pm-info').textContent='Error: '+res.error; return; }
  // Update local data
  if(scData[_pmKey]) scData[_pmKey].prompt=prompt;
  var el=document.getElementById('prompt-'+_pmKey);
  if(el) el.textContent=prompt;
  document.getElementById('pm-info').textContent='Saved to '+res.file;
  setTimeout(closePm,900);
}

function openLb(src){ document.getElementById('lbImg').src=src; document.getElementById('lb').classList.add('open'); }
function closeLb(){ document.getElementById('lb').classList.remove('open'); }

function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

init();
</script>
</body>
</html>'''

# ---------- Server subclass -------------------------------------------------
# ---------- Server subclass -------------------------------------------------
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
