#!/usr/bin/env python3
"""
storybook_pdf.py  --  pageCast Dark Storybook PDF Producer
===========================================================
Combines a pageCast .txt file + scene JPEGs into a dark-theme .docx / .pdf
using the PageCast_Dark_Template_v1.dotx template styles.

Usage:
  python skills/storybook_pdf.py --book "The Garden That Talked Back"
  python skills/storybook_pdf.py --txt ".casts/my-book/Ch1_pagecast.txt" --chapter 1
  python skills/storybook_pdf.py --book "My Book" --no-pdf   # docx only

Arguments:
  --book        Book title (looks up .casts/<slug>/ folder automatically)
  --txt         Direct path to the pageCast .txt file
  --chapter     Chapter number (default: 1)
  --out-dir     Output directory (default: same as .txt file)
  --no-pdf      Skip LibreOffice PDF conversion, output .docx only
  --template    Path to .dotx template (default: docs/PageCast_Dark_Template_v1.dotx)
"""

import argparse
import re
import struct
import subprocess
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

# ---------------------------------------------------------------------------
# CONSTANTS
# ---------------------------------------------------------------------------

# Page dimensions: A4 in EMU (1 inch = 914400 EMU, 1 twip = 635 EMU)
PAGE_W_EMU = 7560210
PAGE_H_EMU = 10692130
MARGIN_L_EMU = 719190
MARGIN_R_EMU = 719190
CONTENT_W_EMU = PAGE_W_EMU - MARGIN_L_EMU - MARGIN_R_EMU  # ~6121830

COVER_MAX_H_EMU = 5000000   # ~13.5 cm
SCENE_MAX_H_EMU = 3600000   # ~9.7 cm

REL_IMAGE_TYPE = (
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image'
)

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


def image_emu(path, max_w, max_h):
    try:
        px_w, px_h = image_dimensions(path)
    except Exception:
        return max_w, min(max_h, int(max_w * 0.6))
    ratio = px_w / px_h
    cx = max_w
    cy = int(cx / ratio)
    if cy > max_h:
        cy = max_h
        cx = int(cy * ratio)
    return cx, cy


def xml_escape(s):
    return (s.replace('&', '&amp;')
             .replace('<', '&lt;')
             .replace('>', '&gt;')
             .replace('"', '&quot;'))

# ---------------------------------------------------------------------------
# PAGECAST .TXT PARSER
# ---------------------------------------------------------------------------

def parse_pagecast(txt_path):
    text = txt_path.read_text(encoding='utf-8', errors='replace')
    lines = text.splitlines()

    book = {
        'title': '', 'author': '', 'language': 'en', 'genre': '',
        'cast': {}, 'chapters': []
    }

    in_header = False
    in_cast = False
    chapter = None
    scene = None
    block = None

    i = 0
    while i < len(lines):
        stripped = lines[i].strip()

        # Header / cast delimiters
        if stripped == '::PAGECAST_BOOK':
            in_header = True
            i += 1
            continue
        if stripped == '::CAST':
            in_header = False
            in_cast = True
            i += 1
            continue
        if stripped == '::' and (in_header or in_cast):
            in_header = False
            in_cast = False
            i += 1
            continue

        if in_header:
            if ':' in stripped:
                key, _, val = stripped.partition(':')
                k = key.strip().lower()
                v = val.strip()
                if k == 'title':    book['title'] = v
                elif k == 'author': book['author'] = v
                elif k == 'language': book['language'] = v
                elif k == 'genre':  book['genre'] = v
            i += 1
            continue

        if in_cast:
            if stripped and '|' in stripped:
                parts = [p.strip() for p in stripped.split('|')]
                name_id = parts[0]
                if ':' in name_id:
                    display_name, _, char_id = name_id.partition(':')
                    display_name = display_name.strip()
                    char_id = char_id.strip()
                else:
                    display_name = name_id
                    char_id = name_id.lower().replace(' ', '_')
                meta = {
                    'name': display_name, 'id': char_id,
                    'role': '', 'voice': '', 'color': '#FFFFFF'
                }
                for p in parts[1:]:
                    if '=' in p:
                        kk, _, vv = p.partition('=')
                        meta[kk.strip()] = vv.strip()
                book['cast'][char_id] = meta
            i += 1
            continue

        # Chapter heading  (#)
        m = re.match(r'^#\s+CHAPTER\s+(\d+)\s*:\s*(.+)$', stripped, re.IGNORECASE)
        if not m:
            m = re.match(r'^#\s+(.+)$', stripped)
        if m and not stripped.startswith('##'):
            chapter = {
                'number': int(m.group(1)) if len(m.groups()) > 1
                          else len(book['chapters']) + 1,
                'title': m.group(2).strip() if len(m.groups()) > 1
                         else m.group(1).strip(),
                'scenes': []
            }
            book['chapters'].append(chapter)
            scene = None
            block = None
            i += 1
            continue

        # Scene heading  (##)
        m = re.match(r'^##\s+SCENE\s+(\d+)\s*:\s*(.+)$', stripped, re.IGNORECASE)
        if not m:
            m = re.match(r'^##\s+(.+)$', stripped)
        if m:
            if chapter is None:
                chapter = {'number': 1, 'title': 'Chapter 1', 'scenes': []}
                book['chapters'].append(chapter)
            num = int(m.group(1)) if len(m.groups()) > 1 else len(chapter['scenes']) + 1
            title = m.group(2).strip() if len(m.groups()) > 1 else m.group(1).strip()
            sc_slug = re.sub(r'[^\w\s-]', '', title.lower())
            sc_slug = re.sub(r'[\s_]+', '-', sc_slug).strip('-')
            scene = {
                'number': num, 'title': title, 'slug': sc_slug,
                'ambience': '', 'music': '', 'location': '', 'time': '',
                'blocks': []
            }
            chapter['scenes'].append(scene)
            block = None
            i += 1
            continue

        # Scene metadata
        if scene and re.match(r'^(Ambience|Music|Location|Time)\s*:', stripped, re.IGNORECASE):
            key, _, val = stripped.partition(':')
            scene[key.strip().lower()] = val.strip()
            i += 1
            continue

        # Block tags  [TAG], [TAG: arg], [TAG | attr=val], [TAG: arg | attr=val]
        tag_m = re.match(r'^\[([^\]|]+?)(?:\s*\|([^\]]*))?\]$', stripped)
        if tag_m:
            tag_full = tag_m.group(1).strip()
            tag_attrs_str = tag_m.group(2) or ''

            if ':' in tag_full:
                tag_type, _, tag_arg = tag_full.partition(':')
                tag_name = tag_type.strip().upper()
                tag_speaker = tag_arg.strip()
            else:
                tag_name = tag_full.upper()
                tag_speaker = ''

            attrs = {}
            for part in tag_attrs_str.split('|'):
                part = part.strip()
                if '=' in part:
                    kk, _, vv = part.partition('=')
                    attrs[kk.strip()] = vv.strip()

            # Self-closing — skip in PDF
            if tag_name in ('PAUSE', 'SFX', 'TRANSITION', 'MUSIC'):
                i += 1
                continue

            if tag_name == 'NARRATION':
                block = {'type': 'narration', 'speaker': '',
                         'emotion': attrs.get('tone', ''), 'text': ''}
            elif tag_name == 'DIALOGUE':
                block = {'type': 'dialogue', 'speaker': tag_speaker,
                         'emotion': attrs.get('emotion', 'neutral'), 'text': ''}
            elif tag_name == 'THOUGHT':
                block = {'type': 'thought', 'speaker': tag_speaker,
                         'emotion': attrs.get('emotion', ''), 'text': ''}
            else:
                block = None

            if block and scene:
                scene['blocks'].append(block)
            i += 1
            continue

        # Block body text
        if block and stripped:
            block['text'] = (block['text'] + ' ' + stripped).strip() if block['text'] else stripped
            i += 1
            continue

        # Blank line — end block
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
            result['cover'] = p
            break

    for sc in scenes:
        sc_num = sc['number']
        slug = sc['slug'].replace('-', '_')
        found = False
        for ext in ('.jpg', '.jpeg', '.png'):
            p = images_dir / ('Ch%d_Sc%d_%s%s' % (chapter_num, sc_num, slug, ext))
            if p.exists():
                result[sc_num] = p
                found = True
                break
        if not found:
            candidates = list(images_dir.glob('Ch%d_Sc%d_*' % (chapter_num, sc_num)))
            if candidates:
                result[sc_num] = candidates[0]

    return result

# ---------------------------------------------------------------------------
# DOCX BUILDER  (delegates to gen_storybook_dark.js via Node.js)
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
    # Also check outputs dir (sandbox path)
    alt = Path('/sessions/funny-great-hamilton/mnt/pageCast/skills/gen_storybook_dark.js')
    if alt.exists():
        return alt
    return None


def build_docx(book, chapter_idx, image_map, out_path):
    import json, tempfile

    node_cmd = find_node()
    if not node_cmd:
        print('  [!] Node.js not found. Install Node.js to generate dark-theme docx.')
        sys.exit(1)

    gen_script = find_gen_script()
    if not gen_script:
        print('  [!] gen_storybook_dark.js not found next to storybook_pdf.py')
        sys.exit(1)

    ch = book['chapters'][chapter_idx]

    # Build scene list for the job
    scenes = []
    for sc in ch['scenes']:
        sc_num = sc['number']
        img = image_map.get(sc_num)
        blocks = []
        for blk in sc['blocks']:
            if blk['text'].strip():
                blocks.append({
                    'type':    blk['type'],
                    'speaker': blk.get('speaker', ''),
                    'text':    blk['text'].strip()
                })
        scenes.append({
            'number':     sc_num,
            'title':      sc['title'],
            'location':   sc.get('location', ''),
            'time':       sc.get('time', ''),
            'image_path': str(img) if img else None,
            'blocks':     blocks
        })

    job = {
        'title':         book['title'],
        'author':        book['author'] or 'pageCast Studio',
        'genre':         book.get('genre', "Children's Fantasy"),
        'chapter_num':   ch['number'],
        'chapter_title': ch['title'],
        'cover_image':   str(image_map['cover']) if image_map.get('cover') else None,
        'out_path':      str(out_path),
        'scenes':        scenes
    }

    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        json.dump(job, f, ensure_ascii=False, indent=2)
        job_file = f.name

    try:
        r = subprocess.run(
            [node_cmd, str(gen_script), job_file],
            capture_output=True, text=True, timeout=120
        )
        if r.returncode != 0 or 'ERROR:' in r.stdout:
            print('  [!] Node error: ' + (r.stderr or r.stdout).strip())
            return False
        print('  Saved: ' + out_path.name)
        return True
    finally:
        Path(job_file).unlink(missing_ok=True)


# ---------------------------------------------------------------------------
# PDF CONVERTER
# ---------------------------------------------------------------------------

def _ensure_docx2pdf():
    try:
        import docx2pdf  # noqa
        return True
    except ImportError:
        print('  Installing docx2pdf...')
        r = subprocess.run(
            [sys.executable, '-m', 'pip', 'install', 'docx2pdf', '-q'],
            capture_output=True
        )
        return r.returncode == 0


def convert_to_pdf(docx_path):
    out_dir = docx_path.parent
    pdf_path = out_dir / (docx_path.stem + '.pdf')
    if _ensure_docx2pdf():
        try:
            from docx2pdf import convert
            print('  Converting to PDF via Word...')
            convert(str(docx_path), str(pdf_path))
            if pdf_path.exists():
                print('  PDF saved: ' + pdf_path.name)
                return pdf_path
        except Exception as e:
            print('  [!] docx2pdf: ' + str(e))
    lo_cmd = None
    for candidate in ('soffice', 'libreoffice'):
        try:
            r = subprocess.run([candidate, '--version'], capture_output=True, timeout=10)
            if r.returncode == 0:
                lo_cmd = candidate
                break
        except (FileNotFoundError, subprocess.TimeoutExpired):
            continue
    if lo_cmd is None:
        print('  [!] PDF conversion unavailable. Run: pip install docx2pdf')
        return None
    r = subprocess.run([lo_cmd, '--headless', '--convert-to', 'pdf',
                        '--outdir', str(out_dir), str(docx_path)],
                       capture_output=True, text=True, timeout=120)
    if r.returncode != 0:
        print('  [!] LibreOffice: ' + r.stderr.strip())
        return None
    if pdf_path.exists():
        print('  PDF saved: ' + pdf_path.name)
        return pdf_path
    return None


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
    parser.add_argument('--book',     help='Book title')
    parser.add_argument('--txt',      help='Direct path to pageCast .txt file')
    parser.add_argument('--chapter',  type=int, default=1)
    parser.add_argument('--out-dir',  help='Output directory')
    parser.add_argument('--no-pdf',   action='store_true')
    args = parser.parse_args()

    root = find_pagecast_root()

    if args.txt:
        txt_path = Path(args.txt).resolve()
        casts_folder = txt_path.parent
    elif args.book:
        slug = slugify(args.book)
        casts_folder = root / '.casts' / slug
        if not casts_folder.exists():
            print('Error: Cast folder not found: ' + str(casts_folder))
            sys.exit(1)
        candidates = list(casts_folder.glob('*_Ch%d_pagecast.txt' % args.chapter))
        if not candidates:
            candidates = list(casts_folder.glob('*_pagecast.txt'))
        if not candidates:
            candidates = list(casts_folder.glob('*.txt'))
        if not candidates:
            print('Error: No pageCast .txt file found in ' + str(casts_folder))
            sys.exit(1)
        txt_path = candidates[0]
        for c in candidates:
            if ('Ch%d' % args.chapter) in c.name:
                txt_path = c
                break
    else:
        parser.print_help()
        sys.exit(1)

    if not txt_path.exists():
        print('Error: File not found: ' + str(txt_path))
        sys.exit(1)

    out_dir = Path(args.out_dir).resolve() if args.out_dir else casts_folder
    out_dir.mkdir(parents=True, exist_ok=True)

    print('')
    print('  pageCast Dark PDF Producer')
    print('  -----------------------------------------')
    print('  Source  : ' + txt_path.name)

    book = parse_pagecast(txt_path)
    if not book['chapters']:
        print('Error: No chapters found.')
        sys.exit(1)

    print('  Title   : ' + (book['title'] or '(no title)'))

    ch_idx = 0
    for idx, ch in enumerate(book['chapters']):
        if ch['number'] == args.chapter:
            ch_idx = idx
            break

    ch = book['chapters'][ch_idx]
    print('  Chapter : %d -- %s (%d scenes)' % (ch['number'], ch['title'], len(ch['scenes'])))

    image_map = find_images(casts_folder, ch['number'], ch['scenes'])
    img_count = sum(1 for v in image_map.values() if v is not None)
    print('  Images  : %d found (cover: %s)' % (img_count, 'yes' if image_map.get('cover') else 'no'))

    safe = re.sub(r'[^\w\s-]', '', book['title']).strip().replace(' ', '')
    docx_path = out_dir / ('%s_Ch%d_PageCast.docx' % (safe, ch['number']))

    print('')
    print('  Building dark-theme document...')
    ok = build_docx(book, ch_idx, image_map, docx_path)
    if not ok:
        sys.exit(1)

    pdf_path = None
    if not args.no_pdf:
        pdf_path = convert_to_pdf(docx_path)

    print('')
    print('  -----------------------------------------')
    print('  Done!')
    if pdf_path:
        print('  PDF  --> ' + str(pdf_path))
    print('  DOCX --> ' + str(docx_path))
    print('')


if __name__ == '__main__':
    main()
