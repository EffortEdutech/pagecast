#!/usr/bin/env python3
"""
storybook_pdf.py  --  pageCast Dark Storybook PDF Producer
Combines pageCast .txt files + scene JPEGs into a dark-theme .docx / .pdf.

Usage:
  python skills/storybook_pdf.py --book "Algoritma Tuhan"
  python skills/storybook_pdf.py --book "The Garden That Talked Back" --chapter 1
  python skills/storybook_pdf.py --txt ".casts/my-book/Ch1_pagecast.txt"
  python skills/storybook_pdf.py --book "My Book" --no-pdf
"""

import argparse
import re
import struct
import subprocess
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# UTILITIES
# ---------------------------------------------------------------------------

def slugify(title):
    slug = title.lower()
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[\s_]+', '-', slug)
    slug = re.sub(r'-+', '-', slug).strip('-')
    return slug


def jpeg_dimensions(path):
    with open(path, 'rb') as f:
        data = f.read()
    if data[0:2] != b'\xff\xd8':
        raise ValueError('Not a JPEG: ' + str(path))
    i = 2
    while i < len(data) - 3:
        if data[i] != 0xff:
            break
        marker = data[i + 1]
        if marker in (0xC0, 0xC1, 0xC2, 0xC3):
            h = struct.unpack('>H', data[i + 5:i + 7])[0]
            w = struct.unpack('>H', data[i + 7:i + 9])[0]
            return w, h
        length = struct.unpack('>H', data[i + 2:i + 4])[0]
        i += 2 + length
    raise ValueError('No SOF marker in ' + str(path))


def png_dimensions(path):
    with open(path, 'rb') as f:
        f.read(16)
        w = struct.unpack('>I', f.read(4))[0]
        h = struct.unpack('>I', f.read(4))[0]
    return w, h


def image_dimensions(path):
    ext = path.suffix.lower()
    if ext in ('.jpg', '.jpeg'):
        return jpeg_dimensions(path)
    if ext == '.png':
        return png_dimensions(path)
    raise ValueError('Unsupported image type: ' + ext)

# ---------------------------------------------------------------------------
# PAGECAST .TXT PARSER
# ---------------------------------------------------------------------------

def parse_pagecast(txt_path):
    try:
        text = txt_path.read_text(encoding='utf-8')
    except UnicodeDecodeError:
        text = txt_path.read_text(encoding='cp1252')

    lines = text.splitlines()
    book = {'title': '', 'author': '', 'language': 'en', 'genre': '', 'cast': {}, 'chapters': []}
    in_header = False
    in_cast = False
    chapter = None
    scene = None
    block = None
    i = 0

    while i < len(lines):
        stripped = lines[i].strip()

        if stripped == '::PAGECAST_BOOK':
            in_header = True; i += 1; continue
        if stripped == '::CAST':
            in_header = False; in_cast = True; i += 1; continue
        if stripped == '::' and (in_header or in_cast):
            in_header = False; in_cast = False; i += 1; continue

        if in_header:
            if ':' in stripped:
                key, _, val = stripped.partition(':')
                k = key.strip().lower(); v = val.strip()
                if k == 'title':      book['title'] = v
                elif k == 'author':   book['author'] = v
                elif k == 'language': book['language'] = v
                elif k == 'genre':    book['genre'] = v
            i += 1; continue

        if in_cast:
            if stripped and '|' in stripped:
                parts = [p.strip() for p in stripped.split('|')]
                name_id = parts[0]
                if ':' in name_id:
                    display_name, _, char_id = name_id.partition(':')
                    display_name = display_name.strip(); char_id = char_id.strip()
                else:
                    display_name = name_id
                    char_id = name_id.lower().replace(' ', '_')
                meta = {'name': display_name, 'id': char_id, 'role': '', 'voice': '', 'color': '#FFFFFF'}
                for p in parts[1:]:
                    if '=' in p:
                        kk, _, vv = p.partition('=')
                        meta[kk.strip()] = vv.strip()
                book['cast'][char_id] = meta
            i += 1; continue

        m = re.match(r'^#\s+(?:BAB|CHAPTER)\s+(\d+)\s*:\s*(.+)$', stripped, re.IGNORECASE)
        if not m:
            m = re.match(r'^#\s+(.+)$', stripped)
        if m and not stripped.startswith('##'):
            chapter = {
                'number': int(m.group(1)) if len(m.groups()) > 1 else len(book['chapters']) + 1,
                'title':  m.group(2).strip() if len(m.groups()) > 1 else m.group(1).strip(),
                'scenes': []
            }
            book['chapters'].append(chapter)
            scene = None; block = None; i += 1; continue

        m = re.match(r'^##\s+(?:SCENE|ADEGAN)\s+(\d+)\s*:\s*(.+)$', stripped, re.IGNORECASE)
        if not m:
            m = re.match(r'^##\s+(.+)$', stripped)
        if m:
            if chapter is None:
                chapter = {'number': 1, 'title': 'Chapter 1', 'scenes': []}
                book['chapters'].append(chapter)
            num   = int(m.group(1)) if len(m.groups()) > 1 else len(chapter['scenes']) + 1
            title = m.group(2).strip() if len(m.groups()) > 1 else m.group(1).strip()
            sc_slug = re.sub(r'[^\w\s-]', '', title.lower())
            sc_slug = re.sub(r'[\s_]+', '-', sc_slug).strip('-')
            scene = {'number': num, 'title': title, 'slug': sc_slug,
                     'ambience': '', 'music': '', 'location': '', 'time': '', 'blocks': []}
            chapter['scenes'].append(scene)
            block = None; i += 1; continue

        if scene and re.match(r'^(Ambience|Music|Location|Time)\s*:', stripped, re.IGNORECASE):
            key, _, val = stripped.partition(':')
            scene[key.strip().lower()] = val.strip()
            i += 1; continue

        tag_m = re.match(r'^\[([^\]|]+?)(?:\s*\|([^\]]*))?\]$', stripped)
        if tag_m:
            tag_full = tag_m.group(1).strip()
            tag_attrs_str = tag_m.group(2) or ''
            if ':' in tag_full:
                tag_type, _, tag_arg = tag_full.partition(':')
                tag_name = tag_type.strip().upper(); tag_speaker = tag_arg.strip()
            else:
                tag_name = tag_full.upper(); tag_speaker = ''
            attrs = {}
            for part in tag_attrs_str.split('|'):
                part = part.strip()
                if '=' in part:
                    kk, _, vv = part.partition('=')
                    attrs[kk.strip()] = vv.strip()
            if tag_name in ('PAUSE', 'SFX', 'TRANSITION', 'MUSIC'):
                i += 1; continue
            if tag_name == 'NARRATION':
                block = {'type': 'narration',  'speaker': '',          'emotion': attrs.get('tone', ''),    'text': ''}
            elif tag_name == 'DIALOGUE':
                block = {'type': 'dialogue',   'speaker': tag_speaker, 'emotion': attrs.get('emotion', 'neutral'), 'text': ''}
            elif tag_name == 'THOUGHT':
                block = {'type': 'thought',    'speaker': tag_speaker, 'emotion': attrs.get('emotion', ''),  'text': ''}
            else:
                block = None
            if block and scene:
                scene['blocks'].append(block)
            i += 1; continue

        if block and stripped:
            block['text'] = (block['text'] + ' ' + stripped).strip() if block['text'] else stripped
            i += 1; continue

        if not stripped:
            block = None
        i += 1

    return book

# ---------------------------------------------------------------------------
# IMAGE FINDER
# ---------------------------------------------------------------------------

def find_images(casts_folder, chapter_num, scenes):
    images_dir = casts_folder / 'images'
    result = {'cover': None}
    if not images_dir.exists():
        return result
    for ext in ('.jpg', '.jpeg', '.png'):
        p = images_dir / ('cover' + ext)
        if p.exists():
            result['cover'] = p; break
    for sc in scenes:
        sc_num = sc['number']
        slug = sc['slug'].replace('-', '_')
        found = False
        for ext in ('.jpg', '.jpeg', '.png'):
            p = images_dir / ('Ch%d_Sc%d_%s%s' % (chapter_num, sc_num, slug, ext))
            if p.exists():
                result[sc_num] = p; found = True; break
        if not found:
            candidates = list(images_dir.glob('Ch%d_Sc%d_*' % (chapter_num, sc_num)))
            if candidates:
                result[sc_num] = candidates[0]
    return result

# ---------------------------------------------------------------------------
# NODE.JS HELPERS
# ---------------------------------------------------------------------------

def find_node():
    for candidate in ('node', 'nodejs'):
        try:
            r = subprocess.run([candidate, '--version'], capture_output=True, timeout=5)
            if r.returncode == 0:
                return candidate
        except (FileNotFoundError, subprocess.TimeoutExpired):
            continue
    return None


def find_gen_script():
    here = Path(__file__).resolve().parent
    p = here / 'gen_storybook_dark.js'
    if p.exists():
        return p
    return None

# ---------------------------------------------------------------------------
# DOCX BUILDER
# ---------------------------------------------------------------------------

def _scenes_for_chapter(ch, image_map):
    scenes = []
    for sc in ch['scenes']:
        sc_num = sc['number']
        img = image_map.get(sc_num)
        blocks = []
        for blk in sc['blocks']:
            if blk['text'].strip():
                blocks.append({'type': blk['type'], 'speaker': blk.get('speaker', ''), 'text': blk['text'].strip()})
        scenes.append({'number': sc_num, 'title': sc['title'], 'location': sc.get('location', ''),
                       'time': sc.get('time', ''), 'image_path': str(img) if img else None, 'blocks': blocks})
    return scenes


def build_docx(book, chapter_indices, image_maps, out_path):
    import json, tempfile
    node_cmd = find_node()
    if not node_cmd:
        print('  [!] Node.js not found.'); sys.exit(1)
    gen_script = find_gen_script()
    if not gen_script:
        print('  [!] gen_storybook_dark.js not found'); sys.exit(1)

    chapters_json = []
    for idx in chapter_indices:
        ch = book['chapters'][idx]
        img_map = image_maps.get(idx, {'cover': None})
        chapters_json.append({'number': ch['number'], 'title': ch['title'],
                               'scenes': _scenes_for_chapter(ch, img_map)})

    first_img_map = image_maps.get(chapter_indices[0], {'cover': None})
    job = {'title': book['title'], 'author': book['author'] or 'pageCast Studio',
           'genre': book.get('genre', "Children's Fantasy"),
           'cover_image': str(first_img_map['cover']) if first_img_map.get('cover') else None,
           'out_path': str(out_path), 'chapters': chapters_json}

    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as f:
        json.dump(job, f, ensure_ascii=False, indent=2)
        job_file = f.name

    try:
        r = subprocess.run([node_cmd, str(gen_script), job_file],
                           capture_output=True, text=True, timeout=180)
        if r.returncode != 0 or 'ERROR:' in r.stdout:
            print('  [!] Node error: ' + (r.stderr or r.stdout).strip())
            return False
        print('  Saved: ' + out_path.name)
        return True
    finally:
        Path(job_file).unlink(missing_ok=True)

# ---------------------------------------------------------------------------
# PDF CONVERTER  (safe COM — never closes your open Word windows)
# ---------------------------------------------------------------------------

def _convert_via_word_com(docx_path, pdf_path):
    """
    Use Word COM on Windows. Attaches to an already-running Word instance so it
    NEVER closes your open documents. Word only quits if we were the ones who started it.
    """
    try:
        import pythoncom, win32com.client
    except ImportError:
        print('  Installing pywin32...')
        r = subprocess.run([sys.executable, '-m', 'pip', 'install', 'pywin32', '-q'], capture_output=True)
        if r.returncode != 0:
            return False
        import pythoncom, win32com.client

    pythoncom.CoInitialize()
    word_was_running = False
    word = None
    try:
        try:
            word = win32com.client.GetActiveObject('Word.Application')
            word_was_running = True
        except Exception:
            word = win32com.client.Dispatch('Word.Application')
            word_was_running = False

        word.Visible = False
        doc = word.Documents.Open(str(docx_path.resolve()))
        try:
            doc.SaveAs(str(pdf_path.resolve()), FileFormat=17)   # 17 = wdFormatPDF
        finally:
            doc.Close(False)   # close this doc only — NOT Word itself
        return True
    except Exception as e:
        print('  [!] Word COM: ' + str(e))
        return False
    finally:
        if word and not word_was_running:
            try: word.Quit()
            except Exception: pass
        try: pythoncom.CoUninitialize()
        except Exception: pass


def convert_to_pdf(docx_path):
    out_dir  = docx_path.parent
    pdf_path = out_dir / (docx_path.stem + '.pdf')

    if sys.platform == 'win32':
        print('  Converting to PDF via Word (your open docs stay open)...')
        if _convert_via_word_com(docx_path, pdf_path):
            if pdf_path.exists():
                print('  PDF saved: ' + pdf_path.name)
                return pdf_path

    # Fallback: LibreOffice (Linux / macOS / no Word)
    lo_cmd = None
    for candidate in ('soffice', 'libreoffice'):
        try:
            r = subprocess.run([candidate, '--version'], capture_output=True, timeout=10)
            if r.returncode == 0:
                lo_cmd = candidate; break
        except (FileNotFoundError, subprocess.TimeoutExpired):
            continue
    if lo_cmd is None:
        print('  [!] PDF conversion unavailable (Windows needs pywin32; others need LibreOffice)')
        return None
    r = subprocess.run([lo_cmd, '--headless', '--convert-to', 'pdf',
                        '--outdir', str(out_dir), str(docx_path)],
                       capture_output=True, text=True, timeout=180)
    if r.returncode != 0:
        print('  [!] LibreOffice: ' + r.stderr.strip())
        return None
    if pdf_path.exists():
        print('  PDF saved: ' + pdf_path.name)
        return pdf_path
    return None

# ---------------------------------------------------------------------------
# CHAPTER FILE DISCOVERY
# ---------------------------------------------------------------------------

def discover_chapter_files(casts_folder):
    found = []
    for p in casts_folder.glob('*.txt'):
        m = re.search(r'[Cc]h(?:apter)?[\s_-]*(\d+)', p.stem)
        num = int(m.group(1)) if m else 0
        found.append((num, p))
    found.sort(key=lambda x: x[0])
    return found

# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------

def find_pagecast_root():
    script_dir = Path(__file__).resolve().parent
    for candidate in (script_dir.parent, script_dir, Path.cwd()):
        if (candidate / 'docs').exists() or (candidate / '.casts').exists():
            return candidate
    return Path.cwd()


def main():
    parser = argparse.ArgumentParser(description='pageCast Dark Storybook PDF Producer')
    parser.add_argument('--book',    help='Book title (combines all chapters by default)')
    parser.add_argument('--txt',     help='Direct path to a single pageCast .txt file')
    parser.add_argument('--chapter', type=int, default=None)
    parser.add_argument('--out-dir', help='Output directory')
    parser.add_argument('--no-pdf',  action='store_true')
    args = parser.parse_args()

    root = find_pagecast_root()

    if args.txt:
        txt_path = Path(args.txt).resolve()
        casts_folder = txt_path.parent
        txt_files = [(1, txt_path)]
    elif args.book:
        slug = slugify(args.book)
        casts_folder = root / '.casts' / slug
        if not casts_folder.exists():
            print('Error: Cast folder not found: ' + str(casts_folder)); sys.exit(1)
        if args.chapter is not None:
            candidates = list(casts_folder.glob('*Ch%d*.txt' % args.chapter))
            if not candidates:
                print('Error: No .txt file for chapter %d' % args.chapter); sys.exit(1)
            txt_files = [(args.chapter, candidates[0])]
        else:
            txt_files = discover_chapter_files(casts_folder)
            if not txt_files:
                print('Error: No pageCast .txt files found in ' + str(casts_folder)); sys.exit(1)
    else:
        parser.print_help(); sys.exit(1)

    out_dir = Path(args.out_dir).resolve() if args.out_dir else casts_folder
    out_dir.mkdir(parents=True, exist_ok=True)

    print('\n  pageCast Dark PDF Producer')
    print('  -----------------------------------------')

    merged_book = None
    image_maps  = {}

    for ch_num, txt_path in txt_files:
        print('  Parsing : ' + txt_path.name)
        b = parse_pagecast(txt_path)
        if merged_book is None:
            merged_book = b
        else:
            merged_book['chapters'].extend(b['chapters'])

    if not merged_book or not merged_book['chapters']:
        print('Error: No chapters found.'); sys.exit(1)

    print('  Title   : ' + (merged_book['title'] or '(no title)'))
    print('  Chapters: %d' % len(merged_book['chapters']))

    for idx, ch in enumerate(merged_book['chapters']):
        img_map   = find_images(casts_folder, ch['number'], ch['scenes'])
        image_maps[idx] = img_map
        img_count = sum(1 for v in img_map.values() if v is not None)
        print('  Ch%d     : %s  (%d scenes, %d images)' % (ch['number'], ch['title'], len(ch['scenes']), img_count))

    chapter_indices = list(range(len(merged_book['chapters'])))

    safe = re.sub(r'[^\w\s-]', '', merged_book['title']).strip().replace(' ', '')
    if len(chapter_indices) == 1:
        docx_name = '%s_Ch%d_PageCast.docx' % (safe, merged_book['chapters'][0]['number'])
    else:
        docx_name = '%s_Complete_PageCast.docx' % safe
    docx_path = out_dir / docx_name

    print('\n  Building dark-theme document...')
    ok = build_docx(merged_book, chapter_indices, image_maps, docx_path)
    if not ok:
        sys.exit(1)

    pdf_path = None
    if not args.no_pdf:
        pdf_path = convert_to_pdf(docx_path)

    print('\n  -----------------------------------------')
    print('  Done!')
    if pdf_path:
        print('  PDF  --> ' + str(pdf_path))
    print('  DOCX --> ' + str(docx_path))
    print('')


if __name__ == '__main__':
    main()
