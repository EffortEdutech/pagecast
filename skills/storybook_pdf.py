#!/usr/bin/env python3
"""
storybook_pdf.py  --  pageCast Dark Storybook PDF Producer
Source: _manuscript.docx files (proper prose)
Theme:  PageCast Dark (dark background, gold headings, etc.)

Usage:
  python skills/storybook_pdf.py --book "Algoritma Tuhan"
  python skills/storybook_pdf.py --book "The Garden That Talked Back" --chapter 1
  python skills/storybook_pdf.py --book "My Book" --no-pdf
"""

import argparse
import re
import subprocess
import sys
from pathlib import Path

# Force UTF-8 output on Windows (no-op on Linux)
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', line_buffering=True)

# ---------------------------------------------------------------------------
# UTILITIES
# ---------------------------------------------------------------------------

def slugify(title):
    slug = title.lower()
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[\s_]+', '-', slug)
    return re.sub(r'-+', '-', slug).strip('-')


def find_node():
    for c in ('node', 'nodejs'):
        try:
            r = subprocess.run([c, '--version'], capture_output=True, timeout=5)
            if r.returncode == 0:
                return c
        except (FileNotFoundError, subprocess.TimeoutExpired):
            pass
    return None


def find_gen_script():
    p = Path(__file__).resolve().parent / 'gen_storybook_dark.js'
    return p if p.exists() else None


def find_pagecast_root():
    for c in (Path(__file__).resolve().parent.parent, Path(__file__).resolve().parent, Path.cwd()):
        if (c / 'docs').exists() or (c / '.casts').exists():
            return c
    return Path.cwd()

# ---------------------------------------------------------------------------
# MANUSCRIPT PARSER  (reads _manuscript.docx, classifies each paragraph)
# ---------------------------------------------------------------------------

def _is_center(p):
    """True if paragraph is explicitly center-aligned."""
    try:
        from docx.enum.text import WD_ALIGN_PARAGRAPH
        return p.alignment == WD_ALIGN_PARAGRAPH.CENTER
    except Exception:
        return p.alignment is not None and '1' in str(p.alignment)


def classify_paragraph(p):
    """
    Returns (ptype, text) where ptype is one of:
      title | subtitle | chapter_heading | scene_number |
      scene_break | centered | body | thought | empty
    """
    text = p.text.strip()
    if not text:
        return 'empty', ''

    italic = any(r.italic for r in p.runs if r.text.strip())
    bold   = any(r.bold   for r in p.runs if r.text.strip())
    center = _is_center(p)
    style  = p.style.name if p.style else ''

    if style == 'Heading 1' or style == 'Heading1':
        return 'chapter_heading', text

    if style == 'Heading 2' or style == 'Heading2':
        # "Scene One: ...", "Scene Two: ...", or "Scene 1: ..." etc.
        ORDINALS = {'ONE':1,'TWO':2,'THREE':3,'FOUR':4,'FIVE':5,
                    'SIX':6,'SEVEN':7,'EIGHT':8,'NINE':9,'TEN':10}
        m = re.search(r'\b(\d+)\b', text)
        if m:
            return 'scene_number', str(int(m.group(1)))
        m = re.search(r'\b(ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN)\b', text.upper())
        if m and m.group(1) in ORDINALS:
            return 'scene_number', str(ORDINALS[m.group(1)])
        return 'scene_number', '0'

    # Scene heading: bold + italic + center  (e.g. "I. The Town That Remembers")
    # This is the primary format the storybook-writer skill produces for scenes.
    if center and bold and italic:
        roman = {
            'I':1,'II':2,'III':3,'IV':4,'V':5,'VI':6,'VII':7,
            'VIII':8,'IX':9,'X':10,'XI':11,'XII':12,'XIII':13,
            'XIV':14,'XV':15,'XVI':16,'XVII':17,'XVIII':18,
        }
        # Try Arabic digit first: "1. Title" or "1 Title"
        m_arab = re.match(r'^(\d+)[.\s]', text)
        if m_arab:
            return 'scene_number', str(int(m_arab.group(1)))
        # Try Roman numeral at start: "I. Title" or "II. Title"
        m_rom = re.match(r'^(X{0,3}(?:IX|IV|V?I{0,3}))[.\s]', text.upper())
        if m_rom and m_rom.group(1) in roman:
            return 'scene_number', str(roman[m_rom.group(1)])
        # Bold+italic+center without a number → treat as scene break label
        return 'scene_break', text

    if center and bold and len(text) > 4:
        return 'title', text                          # title-case or ALL CAPS heading

    if center and italic and re.match(r'^[~*\-–—]', text) and re.search(r'[~*\-–—]$', text):
        # Scene markers: ~ 1 ~  or  ~ I. Title ~  or  ~ III. Something ~
        # Try Arabic digit first
        m = re.search(r'\d+', text)
        if m:
            return 'scene_number', str(int(m.group()))
        # Try Roman numeral (I, II, III, IV, V, VI, VII, VIII, IX, X)
        roman = {'I':1,'II':2,'III':3,'IV':4,'V':5,'VI':6,'VII':7,'VIII':8,'IX':9,'X':10}
        rm = re.search(r'\b(X{0,3}I{0,3}|IV|VI{0,3}|IX|X)\b', text.upper())
        if rm and rm.group() in roman:
            return 'scene_number', str(roman[rm.group()])
        return 'scene_number', '0'

    if center and re.match(r'^[\*✦~\-\s]+$', text):
        return 'scene_break', text                    # * * *  or  ✦ ✦ ✦

    if center and italic:
        return 'subtitle', text                       # "Algoritma yang Menemukan Tuhan"

    if center:
        return 'centered', text                       # chapter ref, page number filler, etc.

    if italic:
        return 'thought', text                        # internal monologue

    return 'body', text


def parse_manuscript(docx_path):
    """
    Read a _manuscript.docx and return a list of paragraph dicts:
      [{type, text, number(for scene_number)}]
    Also extracts book_title and chapter_title from the first headings found.
    """
    try:
        from docx import Document
    except ImportError:
        print('  Installing python-docx...')
        subprocess.run([sys.executable, '-m', 'pip', 'install', 'python-docx', '-q'], capture_output=True)
        from docx import Document

    doc = Document(str(docx_path))
    paragraphs = []
    book_title    = ''
    chapter_title = ''

    for p in doc.paragraphs:
        ptype, text = classify_paragraph(p)
        if ptype == 'empty':
            continue
        if ptype == 'title' and not book_title:
            # Convert ALL CAPS title back to title case for display
            book_title = text.title()
        elif ptype == 'title' and not chapter_title:
            # Chapter uses all-caps bold for its heading (no Heading 1 style)
            chapter_title = text.title()
        if ptype == 'chapter_heading' and not chapter_title:
            chapter_title = text

        entry = {'type': ptype, 'text': text}
        if ptype == 'scene_number':
            try:
                entry['number'] = int(text)
            except ValueError:
                entry['number'] = 0
        paragraphs.append(entry)

    return {'book_title': book_title, 'chapter_title': chapter_title, 'paragraphs': paragraphs}

# ---------------------------------------------------------------------------
# IMAGE FINDER  (matches scene images to scene numbers)
# ---------------------------------------------------------------------------

def find_scene_images(casts_folder, chapter_num):
    """
    Returns dict: {scene_num -> Path, 'cover' -> Path|None}
    Cover image is looked up in (in priority order):
      1. <casts_folder>/cover.jpg   (root — where generate_images.py saves it)
      2. <casts_folder>/images/cover.jpg  (legacy location)
    """
    images_dir = casts_folder / 'images'
    result = {'cover': None}

    # Cover image: check cast folder root first, then images/ subfolder
    for search_dir in (casts_folder, images_dir):
        if not search_dir.exists():
            continue
        for ext in ('.jpg', '.jpeg', '.png'):
            p = search_dir / ('cover' + ext)
            if p.exists():
                result['cover'] = p
                break
        if result['cover']:
            break

    # Scene images: always in images/ subfolder
    if images_dir.exists():
        for img in sorted(images_dir.iterdir()):
            m = re.match(r'Ch(\d+)_Sc(\d+)_', img.name)
            if m and int(m.group(1)) == chapter_num:
                result[int(m.group(2))] = img

    return result

# ---------------------------------------------------------------------------
# DOCX BUILDER  (delegates to gen_storybook_dark.js)
# ---------------------------------------------------------------------------

def build_docx(title, author, genre, cover_image, chapters_json, out_path):
    import json, tempfile

    node_cmd = find_node()
    if not node_cmd:
        print('  [!] Node.js not found.'); sys.exit(1)
    gen_script = find_gen_script()
    if not gen_script:
        print('  [!] gen_storybook_dark.js not found'); sys.exit(1)

    job = {
        'title':       title,
        'author':      author or 'pageCast Studio',
        'genre':       genre or '',
        'cover_image': str(cover_image) if cover_image else None,
        'out_path':    str(out_path),
        'chapters':    chapters_json,
    }

    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as f:
        json.dump(job, f, ensure_ascii=False, indent=2)
        job_file = f.name

    try:
        r = subprocess.run([node_cmd, str(gen_script), job_file],
                           capture_output=True, text=True, timeout=240)
        if r.returncode != 0 or 'ERROR:' in r.stdout:
            print('  [!] Node error: ' + (r.stderr or r.stdout).strip())
            return False
        # Pick up actual saved path (may differ if original was locked)
        actual_path = out_path
        for line in r.stdout.splitlines():
            if line.startswith('NOTE:'):
                print('  [i] ' + line[5:])
            if line.startswith('OK:'):
                actual_path = Path(line[3:])
        print('  Saved: ' + actual_path.name)
        return actual_path
    finally:
        Path(job_file).unlink(missing_ok=True)

# ---------------------------------------------------------------------------
# PDF CONVERTER  (safe COM -- never closes open Word windows)
# ---------------------------------------------------------------------------

def _convert_via_word_com(docx_path, pdf_path):
    try:
        import pythoncom, win32com.client
    except ImportError:
        print('  Installing pywin32...')
        subprocess.run([sys.executable, '-m', 'pip', 'install', 'pywin32', '-q'], capture_output=True)
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
            doc.SaveAs(str(pdf_path.resolve()), FileFormat=17)
        finally:
            doc.Close(False)
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

    for candidate in ('soffice', 'libreoffice'):
        try:
            r = subprocess.run([candidate, '--version'], capture_output=True, timeout=10)
            if r.returncode == 0:
                r2 = subprocess.run([candidate, '--headless', '--convert-to', 'pdf',
                                     '--outdir', str(out_dir), str(docx_path)],
                                    capture_output=True, text=True, timeout=240)
                if r2.returncode == 0 and pdf_path.exists():
                    print('  PDF saved: ' + pdf_path.name)
                    return pdf_path
                break
        except (FileNotFoundError, subprocess.TimeoutExpired):
            pass

    print('  [!] PDF conversion unavailable (Windows: needs pywin32; others: install LibreOffice)')
    return None

# ---------------------------------------------------------------------------
# MANUSCRIPT DISCOVERY
# ---------------------------------------------------------------------------

def discover_manuscripts(casts_folder, chapter=None):
    """Return sorted list of (chapter_num, Path) for all _manuscript.docx files."""
    found = []
    for p in casts_folder.glob('*manuscript*.docx'):
        if p.name.startswith('~$'):
            continue
        m = re.search(r'[Cc]h(?:apter)?[\s_-]*(\d+)', p.stem)
        num = int(m.group(1)) if m else 0
        found.append((num, p))
    found.sort(key=lambda x: x[0])
    if chapter is not None:
        found = [(n, p) for n, p in found if n == chapter]
    return found

# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description='pageCast Dark Storybook PDF Producer')
    parser.add_argument('--book',     help='Book title (builds DOCX + PDF from manuscripts)')
    parser.add_argument('--chapter',  type=int, default=None, help='Single chapter number (default: all)')
    parser.add_argument('--out-dir',  help='Output directory')
    parser.add_argument('--no-pdf',   action='store_true', help='Build DOCX only, skip PDF conversion')
    parser.add_argument('--pdf-from', metavar='DOCX',
                        help='Convert an existing .docx directly to PDF (skips manuscript build). '
                             'Use this after manually editing a DOCX produced with --no-pdf.')
    args = parser.parse_args()

    # ── Mode: convert an existing edited DOCX to PDF ────────────────────────
    if args.pdf_from:
        docx_path = Path(args.pdf_from).resolve()
        if not docx_path.exists():
            print(f'Error: File not found: {docx_path}'); sys.exit(1)
        if not docx_path.suffix.lower() == '.docx':
            print(f'Error: Expected a .docx file, got: {docx_path.name}'); sys.exit(1)
        print(f'\n  pageCast PDF Converter')
        print(f'  Source: {docx_path.name}')
        pdf_path = convert_to_pdf(docx_path)
        if pdf_path:
            print(f'\n  ✅  PDF --> {pdf_path}')
        else:
            print(f'\n  ❌  PDF conversion failed.')
            sys.exit(1)
        return

    if not args.book:
        parser.print_help(); sys.exit(1)

    root = find_pagecast_root()
    slug = slugify(args.book)
    casts_folder = root / '.casts' / slug
    if not casts_folder.exists():
        print('Error: Cast folder not found: ' + str(casts_folder)); sys.exit(1)

    manuscripts = discover_manuscripts(casts_folder, args.chapter)
    if not manuscripts:
        print('Error: No _manuscript.docx files found in ' + str(casts_folder)); sys.exit(1)

    out_dir = Path(args.out_dir).resolve() if args.out_dir else casts_folder
    out_dir.mkdir(parents=True, exist_ok=True)

    print('\n  pageCast Dark PDF Producer  (manuscript mode)')
    print('  -----------------------------------------')

    book_title  = ''
    book_author = ''
    book_genre  = ''
    cover_image = None
    chapters_json = []

    for ch_num, ms_path in manuscripts:
        print('  Reading  : ' + ms_path.name)
        parsed = parse_manuscript(ms_path)

        if not book_title and parsed['book_title']:
            book_title = parsed['book_title']

        # Extract chapter title: prefer explicit chapter_heading, then check if
        # parsed book_title is actually a chapter heading (happens when a chapter
        # uses ALL-CAPS bold for its own header but has no Heading 1 style --
        # the parser then mistakes it for the book title)
        ch_title = parsed['chapter_title']
        if not ch_title and book_title and parsed['book_title']:
            ch_title = parsed['book_title']
        if not ch_title:
            ch_title = 'Chapter ' + str(ch_num)

        # Find images for this chapter
        img_map = find_scene_images(casts_folder, ch_num)
        if not cover_image and img_map.get('cover'):
            cover_image = img_map['cover']

        # Inject image_path into scene_number paragraphs
        paragraphs = parsed['paragraphs']
        for p in paragraphs:
            if p['type'] == 'scene_number':
                sc_num = p.get('number', 0)
                img = img_map.get(sc_num)
                p['image_path'] = str(img) if img else None

        sc_count  = sum(1 for p in paragraphs if p['type'] == 'scene_number')
        img_count = sum(1 for p in paragraphs if p['type'] == 'scene_number' and p.get('image_path'))
        print('  Ch%d      : %s  (%d scenes, %d images)' % (ch_num, ch_title, sc_count, img_count))

        chapters_json.append({
            'number':     ch_num,
            'title':      ch_title,
            'paragraphs': paragraphs,
        })

    if not book_title:
        book_title = args.book.title()

    print('  Title    : ' + book_title)
    print('  Chapters : %d' % len(chapters_json))

    safe = re.sub(r'[^\w\s-]', '', book_title).strip().replace(' ', '')
    if len(chapters_json) == 1:
        docx_name = '%s_Ch%d_PageCast.docx' % (safe, chapters_json[0]['number'])
    else:
        docx_name = '%s_Complete_PageCast.docx' % safe
    docx_path = out_dir / docx_name

    print('\n  Building dark-theme document...')
    result = build_docx(book_title, book_author, book_genre, cover_image, chapters_json, docx_path)
    if not result:
        sys.exit(1)
    actual_docx = result if isinstance(result, Path) else docx_path

    pdf_path = None
    if not args.no_pdf:
        pdf_path = convert_to_pdf(actual_docx)

    print('\n  -----------------------------------------')
    print('  Done!')
    if pdf_path:
        print('  PDF  --> ' + str(pdf_path))
    print('  DOCX --> ' + str(actual_docx))
    print()


if __name__ == '__main__':
    main()
