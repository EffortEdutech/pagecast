#!/usr/bin/env python3
"""
storybook_pdf.py  —  pageCast Dark Storybook PDF Producer
==========================================================
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
import os
import re
import shutil
import struct
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

# ─────────────────────────────────────────────────────────────────────────────
# CONSTANTS
# ─────────────────────────────────────────────────────────────────────────────

# Page dimensions: A4 in EMU (1 inch = 914400 EMU, 1 twip = 635 EMU)
# A4: 11906 twips wide, 16838 twips tall → 7560210 × 10692130 EMU
PAGE_W_EMU = 7560210
PAGE_H_EMU = 10692130
# Margins: 1134 twips left/right, 1247 twips top/bottom
MARGIN_L_EMU = 719190
MARGIN_R_EMU = 719190
MARGIN_T_EMU = 791545
MARGIN_B_EMU = 791545
CONTENT_W_EMU = PAGE_W_EMU - MARGIN_L_EMU - MARGIN_R_EMU  # ≈ 6121830

# Image height limits
COVER_MAX_H_EMU  = 5000000   # ~13.5 cm
SCENE_MAX_H_EMU  = 3600000   # ~9.7 cm

# OOXML namespaces
NS = {
    'w':   'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    'r':   'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'wp':  'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
    'a':   'http://schemas.openxmlformats.org/drawingml/2006/main',
    'pic': 'http://schemas.openxmlformats.org/drawingml/2006/picture',
    'mc':  'http://schemas.openxmlformats.org/markup-compatibility/2006',
    'v':   'urn:schemas-microsoft-com:vml',
}

REL_IMAGE_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image'

MIME = {'.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png'}

# ─────────────────────────────────────────────────────────────────────────────
# UTILITIES
# ─────────────────────────────────────────────────────────────────────────────

def slugify(title: str) -> str:
    slug = title.lower()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug


def jpeg_dimensions(path: Path):
    """Return (width, height) in pixels by parsing raw JPEG SOF markers."""
    with open(path, 'rb') as f:
        data = f.read()
    i = 0
    if data[0:2] != b'\xff\xd8':
        raise ValueError(f"Not a JPEG: {path}")
    i = 2
    while i < len(data) - 3:
        if data[i] != 0xff:
            break
        marker = data[i+1]
        if marker in (0xC0, 0xC1, 0xC2, 0xC3):          # SOF0–SOF3
            h = struct.unpack('>H', data[i+5:i+7])[0]
            w = struct.unpack('>H', data[i+7:i+9])[0]
            return w, h
        length = struct.unpack('>H', data[i+2:i+4])[0]
        i += 2 + length
    raise ValueError(f"Could not find SOF marker in {path}")


def png_dimensions(path: Path):
    """Return (width, height) from PNG IHDR."""
    with open(path, 'rb') as f:
        f.read(8)           # PNG signature
        f.read(4)           # IHDR length
        f.read(4)           # 'IHDR'
        w = struct.unpack('>I', f.read(4))[0]
        h = struct.unpack('>I', f.read(4))[0]
    return w, h


def image_dimensions(path: Path):
    ext = path.suffix.lower()
    if ext in ('.jpg', '.jpeg'):
        return jpeg_dimensions(path)
    elif ext == '.png':
        return png_dimensions(path)
    else:
        raise ValueError(f"Unsupported image type: {ext}")


def image_emu(path: Path, max_w: int, max_h: int):
    """Return (cx, cy) in EMU, preserving aspect ratio within max bounds."""
    try:
        px_w, px_h = image_dimensions(path)
    except Exception:
        # Fallback: full width, estimate height
        return max_w, min(max_h, int(max_w * 0.6))
    ratio = px_w / px_h
    cx = max_w
    cy = int(cx / ratio)
    if cy > max_h:
        cy = max_h
        cx = int(cy * ratio)
    return cx, cy


def xml_escape(s: str) -> str:
    return (s.replace('&', '&amp;')
             .replace('<', '&lt;')
             .replace('>', '&gt;')
             .replace('"', '&quot;'))


# ─────────────────────────────────────────────────────────────────────────────
# PAGECAST .TXT PARSER
# ─────────────────────────────────────────────────────────────────────────────

def parse_pagecast(txt_path: Path) -> dict:
    """
    Returns:
      {
        'title': str, 'author': str, 'language': str, 'genre': str,
        'cast': {id: {name, role, voice, color}},
        'chapters': [{
            'number': int, 'title': str,
            'scenes': [{
                'number': int, 'title': str, 'slug': str,
                'ambience': str, 'music': str, 'location': str, 'time': str,
                'blocks': [{'type': str, 'speaker': str, 'emotion': str, 'text': str}]
            }]
        }]
      }
    """
    text = txt_path.read_text(encoding='utf-8', errors='replace')
    lines = text.splitlines()

    book = {'title': '', 'author': '', 'language': 'en', 'genre': '',
            'cast': {}, 'chapters': []}

    # Parse ::PAGECAST_BOOK header
    in_header = False
    in_cast = False
    chapter = None
    scene = None
    block = None

    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        # ── HEADER BLOCK ──────────────────────────────────────────────────
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
                key = key.strip().lower()
                val = val.strip()
                if key == 'title':   book['title'] = val
                elif key == 'author': book['author'] = val
                elif key == 'language': book['language'] = val
                elif key == 'genre': book['genre'] = val
            i += 1
            continue

        # ── CAST BLOCK ────────────────────────────────────────────────────
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
                meta = {'name': display_name, 'id': char_id, 'role': '', 'voice': '', 'color': '#FFFFFF'}
                for p in parts[1:]:
                    if '=' in p:
                        k, _, v = p.partition('=')
                        meta[k.strip()] = v.strip()
                book['cast'][char_id] = meta
            i += 1
            continue

        # ── CHAPTER HEADING  (#) ──────────────────────────────────────────
        m = re.match(r'^#\s+CHAPTER\s+(\d+)\s*:\s*(.+)$', stripped, re.IGNORECASE)
        if not m:
            m = re.match(r'^#\s+(.+)$', stripped)
        if m:
            chapter = {
                'number': int(m.group(1)) if len(m.groups()) > 1 else len(book['chapters']) + 1,
                'title': m.group(2).strip() if len(m.groups()) > 1 else m.group(1).strip(),
                'scenes': []
            }
            book['chapters'].append(chapter)
            scene = None
            block = None
            i += 1
            continue

        # ── SCENE HEADING  (##) ───────────────────────────────────────────
        m = re.match(r'^##\s+SCENE\s+(\d+)\s*:\s*(.+)$', stripped, re.IGNORECASE)
        if not m:
            m = re.match(r'^##\s+(.+)$', stripped)
        if m:
            if chapter is None:
                chapter = {'number': 1, 'title': 'Chapter 1', 'scenes': []}
                book['chapters'].append(chapter)
            num = int(m.group(1)) if len(m.groups()) > 1 else len(chapter['scenes']) + 1
            title = m.group(2).strip() if len(m.groups()) > 1 else m.group(1).strip()
            scene_slug = re.sub(r'[^\w\s-]', '', title.lower())
            scene_slug = re.sub(r'[\s_]+', '-', scene_slug).strip('-')
            scene = {
                'number': num, 'title': title, 'slug': scene_slug,
                'ambience': '', 'music': '', 'location': '', 'time': '',
                'blocks': []
            }
            chapter['scenes'].append(scene)
            block = None
            i += 1
            continue

        # ── SCENE METADATA (Ambience:, Music:, Location:, Time:) ──────────
        if scene and re.match(r'^(Ambience|Music|Location|Time)\s*:', stripped, re.IGNORECASE):
            key, _, val = stripped.partition(':')
            scene[key.strip().lower()] = val.strip()
            i += 1
            continue

        # ── BLOCK TAGS ────────────────────────────────────────────────────
        # Match [TAG], [TAG: arg], [TAG | attr=val], [TAG: arg | attr=val]
        tag_match = re.match(r'^\[([^\]|]+?)(?:\s*\|([^\]]*))?\]$', stripped)
        if tag_match:
            tag_full = tag_match.group(1).strip()
            tag_attrs_str = tag_match.group(2) or ''

            # Split tag_full on first ':' to separate tag type from argument
            if ':' in tag_full:
                tag_type, _, tag_arg = tag_full.partition(':')
                tag_name = tag_type.strip().upper()
                tag_speaker = tag_arg.strip()
            else:
                tag_name = tag_full.upper()
                tag_speaker = ''

            # Parse attribute key=value pairs from after '|'
            attrs = {}
            for part in tag_attrs_str.split('|'):
                part = part.strip()
                if '=' in part:
                    k, _, v = part.partition('=')
                    attrs[k.strip()] = v.strip()

            # Self-closing tags — skip, not rendered in PDF
            if tag_name in ('PAUSE', 'SFX', 'TRANSITION', 'MUSIC', 'NARRATION | TONE'):
                i += 1
                continue

            if tag_name == 'NARRATION':
                block = {'type': 'narration', 'speaker': '', 'emotion': attrs.get('tone', ''), 'text': ''}
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

        # ── BLOCK BODY TEXT ───────────────────────────────────────────────
        if block and stripped:
            if block['text']:
                block['text'] += ' ' + stripped
            else:
                block['text'] = stripped
            i += 1
            continue

        # Blank line resets block collection
        if not stripped:
            block = None

        i += 1

    return book


# ─────────────────────────────────────────────────────────────────────────────
# IMAGE FINDER
# ─────────────────────────────────────────────────────────────────────────────

def find_images(casts_folder: Path, chapter_num: int, scenes: list) -> dict:
    """
    Returns {'cover': Path|None, scene_num: Path|None, ...}
    Looks in <casts_folder>/images/
    Pattern: Ch<N>_Sc<N>_<slug>.(jpg|jpeg|png)
    Also checks for cover.(jpg|jpeg|png)
    """
    images_dir = casts_folder / 'images'
    result = {'cover': None}

    if not images_dir.exists():
        return result

    # Find cover
    for ext in ('.jpg', '.jpeg', '.png'):
        p = images_dir / f'cover{ext}'
        if p.exists():
            result['cover'] = p
            break

    # Find scene images
    for sc in scenes:
        sc_num = sc['number']
        # Try exact slug first
        slug = sc['slug'].replace('-', '_')
        found = False
        for ext in ('.jpg', '.jpeg', '.png'):
            pattern_exact = images_dir / f"Ch{chapter_num}_Sc{sc_num}_{slug}{ext}"
            if pattern_exact.exists():
                result[sc_num] = pattern_exact
                found = True
                break
        if found:
            continue
        # Glob fallback: Ch<N>_Sc<N>_*
        candidates = list(images_dir.glob(f"Ch{chapter_num}_Sc{sc_num}_*"))
        if candidates:
            result[sc_num] = candidates[0]

    return result


# ─────────────────────────────────────────────────────────────────────────────
# DOCUMENT XML BUILDER
# ─────────────────────────────────────────────────────────────────────────────

def para(style: str, text: str) -> str:
    """Generate a <w:p> with the given paragraph style and text."""
    return (
        f'<w:p>'
        f'<w:pPr><w:pStyle w:val="{style}"/></w:pPr>'
        f'<w:r><w:t xml:space="preserve">{xml_escape(text)}</w:t></w:r>'
        f'</w:p>'
    )


def para_empty(style: str = 'Normal') -> str:
    return f'<w:p><w:pPr><w:pStyle w:val="{style}"/></w:pPr></w:p>'


def inline_image(rId: str, cx: int, cy: int, title: str = '') -> str:
    """Return the OOXML drawing XML for an inline image."""
    safe_title = xml_escape(title)
    return (
        '<w:p>'
        '<w:pPr><w:jc w:val="center"/></w:pPr>'
        '<w:r><w:drawing>'
        '<wp:inline distT="0" distB="0" distL="0" distR="0"'
        ' xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">'
        f'<wp:extent cx="{cx}" cy="{cy}"/>'
        '<wp:docPr id="1" name="image" descr=""/>'
        '<wp:cNvGraphicFramePr>'
        '<a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"'
        ' noChangeAspect="1"/>'
        '</wp:cNvGraphicFramePr>'
        '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
        '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
        '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">'
        '<pic:nvPicPr>'
        f'<pic:cNvPr id="0" name="{safe_title}"/>'
        '<pic:cNvPicPr/>'
        '</pic:nvPicPr>'
        '<pic:blipFill>'
        f'<a:blip r:embed="{rId}"'
        ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>'
        '<a:stretch><a:fillRect/></a:stretch>'
        '</pic:blipFill>'
        '<pic:spPr>'
        '<a:xfrm><a:off x="0" y="0"/>'
        f'<a:ext cx="{cx}" cy="{cy}"/>'
        '</a:xfrm>'
        '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>'
        '</pic:spPr>'
        '</pic:pic>'
        '</a:graphicData>'
        '</a:graphic>'
        '</wp:inline>'
        '</w:drawing></w:r>'
        '</w:p>'
    )


def build_document_xml(book: dict, chapter_idx: int, image_map: dict,
                        image_rids: dict) -> str:
    """
    Build the full word/document.xml content.
    image_map: {scene_num: Path}  (cover at key 'cover')
    image_rids: {scene_num: rId_str, 'cover': rId_str}
    """
    ch = book['chapters'][chapter_idx]
    ch_num = ch['number']
    title = book['title']
    author = book['author'] or 'pageCast Studio'

    parts = []

    # ── XML declaration + document wrapper ───────────────────────────────
    parts.append(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<w:document'
        ' xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"'
        ' xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"'
        ' xmlns:o="urn:schemas-microsoft-com:office:office"'
        ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
        ' xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"'
        ' xmlns:v="urn:schemas-microsoft-com:vml"'
        ' xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing"'
        ' xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"'
        ' xmlns:w10="urn:schemas-microsoft-com:office:word"'
        ' xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
        ' xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"'
        ' xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"'
        ' xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"'
        ' xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"'
        ' xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"'
        ' mc:Ignorable="w14 wp14">'
        '<w:body>'
    )

    # ── COVER PAGE ───────────────────────────────────────────────────────
    parts.append(para_empty('PCSceneBreak'))  # breathing room

    # Cover image
    if 'cover' in image_rids:
        p = image_map.get('cover')
        if p:
            cx, cy = image_emu(p, CONTENT_W_EMU, COVER_MAX_H_EMU)
            parts.append(inline_image(image_rids['cover'], cx, cy, 'cover'))
            parts.append(para_empty())

    # Title
    parts.append(para('PCTitle', title))
    parts.append(para_empty('PCSceneBreak'))

    # Author / metadata
    if author:
        parts.append(para('PCSubtitle', author))
    parts.append(para('PCMeta', book.get('genre', 'Children\'s Fantasy')))
    parts.append(para_empty())
    parts.append(para('PCMeta', f'Chapter {ch_num}'))

    # Page break before chapter content
    parts.append(
        '<w:p>'
        '<w:r><w:br w:type="page"/></w:r>'
        '</w:p>'
    )

    # ── CHAPTER TITLE ────────────────────────────────────────────────────
    parts.append(para('PCChapter', f'Chapter {ch_num}'))
    parts.append(para('PCSoftText', ch['title']))
    parts.append(para_empty())

    # ── SCENES ───────────────────────────────────────────────────────────
    for sc in ch['scenes']:
        sc_num = sc['number']

        # Scene section title
        parts.append(para('PCSection', sc['title']))

        # Location / time meta
        meta_parts = []
        if sc.get('location'):
            meta_parts.append(sc['location'])
        if sc.get('time'):
            meta_parts.append(sc['time'])
        if meta_parts:
            parts.append(para('PCMeta', '  ·  '.join(meta_parts)))

        # Scene image (if available)
        if sc_num in image_rids:
            img_path = image_map.get(sc_num)
            if img_path:
                cx, cy = image_emu(img_path, CONTENT_W_EMU, SCENE_MAX_H_EMU)
                parts.append(inline_image(image_rids[sc_num], cx, cy, sc['title']))
                parts.append(para_empty())

        # Content blocks
        has_content = False
        for blk in sc['blocks']:
            btype = blk['type']
            text = blk['text'].strip()
            if not text:
                continue
            has_content = True

            if btype == 'narration':
                parts.append(para('PCBody', text))

            elif btype == 'dialogue':
                speaker = blk.get('speaker', '')
                # Strip outer quotes if present (some files wrap them, some don't)
                clean = text
                if clean.startswith('"') and clean.endswith('"'):
                    clean = clean[1:-1]
                elif clean.startswith('“') and clean.endswith('”'):
                    clean = clean[1:-1]
                display = f'“{clean}”'
                if speaker:
                    # Bold speaker name + dialogue
                    parts.append(
                        f'<w:p>'
                        f'<w:pPr><w:pStyle w:val="PCBody"/></w:pPr>'
                        f'<w:r><w:rPr><w:b/></w:rPr>'
                        f'<w:t xml:space="preserve">{xml_escape(speaker)}: </w:t></w:r>'
                        f'<w:r><w:t xml:space="preserve">{xml_escape(display)}</w:t></w:r>'
                        f'</w:p>'
                    )
                else:
                    parts.append(para('PCBody', display))

            elif btype == 'thought':
                # Thoughts use PCQuote style (italic, purple left border)
                parts.append(para('PCQuote', text))

        if has_content:
            # Scene break divider
            parts.append(para('PCSceneBreak', '❧'))  # ❧

        parts.append(para_empty())

    # ── END OF DOCUMENT ──────────────────────────────────────────────────
    # Page size and margins section properties
    parts.append(
        '<w:sectPr>'
        '<w:pgSz w:w="11906" w:h="16838"/>'
        '<w:pgMar w:top="1247" w:right="1134" w:bottom="1247" w:left="1134"'
        ' w:header="709" w:footer="709" w:gutter="0"/>'
        '</w:sectPr>'
    )

    parts.append('</w:body></w:document>')
    return ''.join(parts)


# ─────────────────────────────────────────────────────────────────────────────
# OOXML RELATIONSHIP / CONTENT-TYPE HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def build_rels_xml(base_rels_xml: str, image_entries: list) -> str:
    """
    Inject image relationships into word/_rels/document.xml.rels
    image_entries: [(rId, filename)]  filename = 'media/imageN.jpg'
    """
    # Remove closing tag, append new rels, re-close
    close = '</Relationships>'
    xml = base_rels_xml.strip()
    if xml.endswith(close):
        xml = xml[:-len(close)]
    for rId, fname in image_entries:
        xml += (
            f'\n  <Relationship Id="{rId}"'
            f' Type="{REL_IMAGE_TYPE}"'
            f' Target="{fname}"/>'
        )
    xml += f'\n{close}'
    return xml


def add_content_types(ct_xml: str, ext_set: set) -> str:
    """Add <Default> entries for image extensions if not already present."""
    ext_to_mime = {'.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png'}
    close = '</Types>'
    xml = ct_xml.strip()
    if xml.endswith(close):
        xml = xml[:-len(close)]
    for ext in ext_set:
        short = ext.lstrip('.')
        mime = ext_to_mime.get(ext, 'image/jpeg')
        # Only add if not already present
        if f'Extension="{short}"' not in xml:
            xml += f'\n  <Default Extension="{short}" ContentType="{mime}"/>'
    xml += f'\n{close}'
    return xml


def add_display_background(settings_xml: str) -> str:
    """Ensure <w:displayBackgroundShape/> is present in settings.xml."""
    if 'displayBackgroundShape' in settings_xml:
        return settings_xml
    # Insert after <w:settings ...>  opening tag
    insert_after = re.search(r'<w:settings[^>]*>', settings_xml)
    if insert_after:
        pos = insert_after.end()
        settings_xml = (settings_xml[:pos]
                        + '\n  <w:displayBackgroundShape/>'
                        + settings_xml[pos:])
    return settings_xml


def update_header_title(header_xml: str, title: str) -> str:
    """Replace placeholder book title in header XML with actual title."""
    # The template header has "PageCast • [Book Title]" or similar.
    # We replace the literal "[Book Title]" or the existing title between • and closing tag.
    header_xml = re.sub(r'\[Book Title\]', xml_escape(title), header_xml)
    return header_xml


# ─────────────────────────────────────────────────────────────────────────────
# DOCX ASSEMBLER
# ─────────────────────────────────────────────────────────────────────────────

def assemble_docx(template_path: Path, out_path: Path,
                  book: dict, chapter_idx: int,
                  image_map: dict) -> None:
    """
    Build the final .docx by:
    1. Copying all files from the .dotx template
    2. Injecting scene/cover images into word/media/
    3. Building new word/document.xml
    4. Updating word/_rels/document.xml.rels
    5. Updating [Content_Types].xml
    6. Updating word/settings.xml (displayBackgroundShape)
    7. Updating header XML (book title)
    """

    # ── Collect images ────────────────────────────────────────────────────
    # Assign rIds starting from rId8 (template uses rId1–rId7 for internals)
    image_rids = {}   # {scene_num | 'cover': rId}
    image_entries = []  # [(rId, 'media/imageN.jpg')]
    image_bytes = {}   # {rId: (bytes, extension)}

    rid_counter = 8
    ext_set = set()

    def register_image(key, path: Path):
        nonlocal rid_counter
        rId = f'rId{rid_counter}'
        rid_counter += 1
        ext = path.suffix.lower()
        media_name = f'image{rid_counter - 8}{ext}'
        image_rids[key] = rId
        image_entries.append((rId, f'media/{media_name}'))
        image_bytes[rId] = (path.read_bytes(), ext)
        ext_set.add(ext)

    # Cover first
    if image_map.get('cover'):
        register_image('cover', image_map['cover'])

    # Scene images in order
    ch = book['chapters'][chapter_idx]
    for sc in ch['scenes']:
        sc_num = sc['number']
        if sc_num in image_map:
            register_image(sc_num, image_map[sc_num])

    # ── Build document XML ────────────────────────────────────────────────
    doc_xml = build_document_xml(book, chapter_idx, image_map, image_rids)

    # ── Read template, write output ───────────────────────────────────────
    with zipfile.ZipFile(template_path, 'r') as tmpl:
        tmpl_names = set(tmpl.namelist())

        with zipfile.ZipFile(out_path, 'w', compression=zipfile.ZIP_DEFLATED) as out:

            for name in tmpl.namelist():
                data = tmpl.read(name)

                # ── Replace document.xml ──────────────────────────────────
                if name == 'word/document.xml':
                    out.writestr(name, doc_xml.encode('utf-8'))
                    continue

                # ── Update relationships ───────────────────────────────────
                if name == 'word/_rels/document.xml.rels':
                    rels_xml = data.decode('utf-8')
                    rels_xml = build_rels_xml(rels_xml, image_entries)
                    out.writestr(name, rels_xml.encode('utf-8'))
                    continue

                # ── Update content types ───────────────────────────────────
                if name == '[Content_Types].xml':
                    ct_xml = data.decode('utf-8')
                    ct_xml = add_content_types(ct_xml, ext_set)
                    out.writestr(name, ct_xml.encode('utf-8'))
                    continue

                # ── Update settings ───────────────────────────────────────
                if name == 'word/settings.xml':
                    settings_xml = data.decode('utf-8')
                    settings_xml = add_display_background(settings_xml)
                    out.writestr(name, settings_xml.encode('utf-8'))
                    continue

                # ── Update header (book title placeholder) ─────────────────
                if name.startswith('word/header') and name.endswith('.xml'):
                    hdr_xml = data.decode('utf-8')
                    hdr_xml = update_header_title(hdr_xml, book['title'])
                    out.writestr(name, hdr_xml.encode('utf-8'))
                    continue

                # All other template files: copy verbatim
                out.writestr(name, data)

            # ── Write image files into word/media/ ────────────────────────
            for rId, (img_data, ext) in image_bytes.items():
                # Derive media filename from image_entries
                for eid, efname in image_entries:
                    if eid == rId:
                        out.writestr(f'word/{efname}', img_data)
                        break

    print(f'  ✓ Saved: {out_path.name}')


# ─────────────────────────────────────────────────────────────────────────────
# PDF CONVERTER
# ─────────────────────────────────────────────────────────────────────────────

def convert_to_pdf(docx_path: Path) -> Path:
    """Convert .docx to .pdf via LibreOffice headless. Returns PDF path."""
    out_dir = docx_path.parent

    # Try the pageCast soffice wrapper first, then raw soffice
    soffice_candidates = [
        'python scripts/office/soffice.py',
        'soffice',
        'libreoffice',
    ]

    # Find which soffice variant works
    lo_cmd = None
    for candidate in ['soffice', 'libreoffice']:
        try:
            result = subprocess.run(
                [candidate, '--version'],
                capture_output=True, timeout=10
            )
            if result.returncode == 0:
                lo_cmd = candidate
                break
        except (FileNotFoundError, subprocess.TimeoutExpired):
            continue

    if lo_cmd is None:
        print('  ⚠  LibreOffice not found — skipping PDF conversion.')
        print('     Install LibreOffice to enable PDF output.')
        return None

    cmd = [
        lo_cmd, '--headless',
        '--convert-to', 'pdf',
        '--outdir', str(out_dir),
        str(docx_path)
    ]
    print(f'  Converting to PDF via {lo_cmd}...')
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if result.returncode != 0:
        print(f'  ⚠  LibreOffice error: {result.stderr.strip()}')
        return None

    pdf_name = docx_path.stem + '.pdf'
    pdf_path = out_dir / pdf_name
    if pdf_path.exists():
        print(f'  ✓ PDF: {pdf_name}')
        return pdf_path
    else:
        print('  ⚠  PDF not found after conversion.')
        return None


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

def find_pagecast_root() -> Path:
    """Walk up from the script location to find the pageCast project root."""
    # skills/ is one level below the project root
    script_dir = Path(__file__).resolve().parent
    # If run from project root, or from skills/
    for candidate in [script_dir.parent, script_dir, Path.cwd()]:
        if (candidate / 'docs').exists() or (candidate / '.casts').exists():
            return candidate
    return Path.cwd()


def main():
    parser = argparse.ArgumentParser(
        description='pageCast Dark Storybook PDF Producer'
    )
    parser.add_argument('--book', help='Book title (auto-resolves .casts/<slug>/)')
    parser.add_argument('--txt', help='Direct path to the pageCast .txt file')
    parser.add_argument('--chapter', type=int, default=1, help='Chapter number (default: 1)')
    parser.add_argument('--out-dir', help='Output directory (default: same as .txt file)')
    parser.add_argument('--no-pdf', action='store_true', help='Skip PDF conversion')
    parser.add_argument('--template', help='Path to .dotx template file')
    args = parser.parse_args()

    root = find_pagecast_root()

    # ── Resolve template path ─────────────────────────────────────────────
    if args.template:
        template_path = Path(args.template).resolve()
    else:
        template_path = root / 'docs' / 'PageCast_Dark_Template_v1.dotx'

    if not template_path.exists():
        print(f'Error: Template not found: {template_path}')
        print('Use --template to specify the .dotx file path.')
        sys.exit(1)

    # ── Resolve .txt path ─────────────────────────────────────────────────
    if args.txt:
        txt_path = Path(args.txt).resolve()
        casts_folder = txt_path.parent
    elif args.book:
        slug = slugify(args.book)
        casts_folder = root / '.casts' / slug
        if not casts_folder.exists():
            print(f'Error: Cast folder not found: {casts_folder}')
            print(f'Expected: .casts/{slug}/')
            sys.exit(1)
        # Find a pagecast .txt for this chapter
        ch_str = f'Ch{args.chapter}_pagecast.txt'
        candidates = list(casts_folder.glob(f'*_Ch{args.chapter}_pagecast.txt'))
        if not candidates:
            candidates = list(casts_folder.glob('*_pagecast.txt'))
        if not candidates:
            candidates = list(casts_folder.glob('*.txt'))
        if not candidates:
            print(f'Error: No pageCast .txt file found in {casts_folder}')
            sys.exit(1)
        # Prefer exact chapter match
        txt_path = candidates[0]
        for c in candidates:
            if f'Ch{args.chapter}' in c.name:
                txt_path = c
                break
    else:
        parser.print_help()
        sys.exit(1)

    if not txt_path.exists():
        print(f'Error: File not found: {txt_path}')
        sys.exit(1)

    # ── Output directory ──────────────────────────────────────────────────
    if args.out_dir:
        out_dir = Path(args.out_dir).resolve()
        out_dir.mkdir(parents=True, exist_ok=True)
    else:
        out_dir = casts_folder

    # ── Parse ─────────────────────────────────────────────────────────────
    print(f'\n  pageCast PDF Producer')
    print(f'  ─────────────────────────────────────────')
    print(f'  Source : {txt_path.name}')
    print(f'  Template: {template_path.name}')

    book = parse_pagecast(txt_path)
    if not book['chapters']:
        print('Error: No chapters found in pageCast file.')
        sys.exit(1)

    print(f'  Title  : {book["title"] or "(no title)"}')
    print(f'  Chapters found: {len(book["chapters"])}')

    # Find the requested chapter index
    ch_idx = None
    for idx, ch in enumerate(book['chapters']):
        if ch['number'] == args.chapter:
            ch_idx = idx
            break
    if ch_idx is None:
        ch_idx = 0   # fallback to first
        print(f'  ⚠  Chapter {args.chapter} not found — using chapter {book["chapters"][0]["number"]}')

    ch = book['chapters'][ch_idx]
    print(f'  Chapter: {ch["number"]} — {ch["title"]} ({len(ch["scenes"])} scenes)')

    # ── Find images ────────────────────────────────────────────────────────
    image_map = find_images(casts_folder, ch['number'], ch['scenes'])
    img_count = sum(1 for k, v in image_map.items() if v is not None)
    print(f'  Images : {img_count} found (cover: {"yes" if image_map.get("cover") else "no"})')

    # ── Build docx ────────────────────────────────────────────────────────
    safe_title = re.sub(r'[^\w\s-]', '', book['title']).strip().replace(' ', '')
    docx_name = f'{safe_title}_Ch{ch["number"]}_PageCast.docx'
    docx_path = out_dir / docx_name

    print(f'\n  Building document...')
    assemble_docx(template_path, docx_path, book, ch_idx, image_map)

    # ── Convert to PDF ─────────────────────────────────────────────────────
    pdf_path = None
    if not args.no_pdf:
        pdf_path = convert_to_pdf(docx_path)

    print(f'\n  ─────────────────────────────────────────')
    print(f'  Done!')
    if pdf_path:
        print(f'  PDF  → {pdf_path}')
    print(f'  DOCX --> {docx_path}')


if __name__ == '__main__':
    main()
