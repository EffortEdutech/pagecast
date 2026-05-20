#!/usr/bin/env node
/**
 * gen_storybook_dark.js
 * Called by storybook_pdf.py — reads a JSON job file, writes a dark-theme .docx
 *
 * Usage: node gen_storybook_dark.js <job.json>
 *
 * job.json fields:
 *   title, author, genre, chapter_num, chapter_title,
 *   scenes: [{number, title, location, time, image_path|null, blocks:[{type,speaker,text}]}]
 *   out_path: absolute path for output .docx
 */

'use strict';
const fs   = require('fs');
const path = require('path');

const docxPath = path.join('/sessions/funny-great-hamilton/mnt/outputs', 'node_modules', 'docx');
const {
  Document, Packer, Paragraph, TextRun, ImageRun,
  AlignmentType, HeadingLevel, Footer, Header,
  PageNumber, BorderStyle, WidthType, ShadingType,
  PageBreak, TableOfContents
} = require(docxPath);

// ── Colours ───────────────────────────────────────────────────────────────
const C = {
  BG:       '0F0F14',
  TITLE:    'FFFFFF',
  SUBTITLE: '8C8C98',
  SOFT:     'B7B7C2',
  META:     '8C8C98',
  BODY:     'E6E6EB',
  CHAPTER:  'FFC875',
  SECTION:  'FFFFFF',
  SCENE_BR: '555566',
  QUOTE_TXT:'D4BBFF',
  QUOTE_BAR:'B69CFF',
  HEADER:   '8C8C98',
  FOOTER:   '8C8C98',
  FOOTER_HL:'7CC7FF',
};

const FONT_TITLE = 'Playfair Display';
const FONT_BODY  = 'Georgia';

// ── Paragraph helpers ──────────────────────────────────────────────────────
const sp = (before, after) => ({ before, after });

function pcTitle(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: sp(2880, 240),
    children: [new TextRun({ text, font: FONT_TITLE, size: 64, bold: true, color: C.TITLE })]
  });
}

function pcSubtitle(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: sp(0, 240),
    children: [new TextRun({ text, font: FONT_BODY, size: 28, italics: true, color: C.SUBTITLE })]
  });
}

function pcMeta(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: sp(0, 160),
    children: [new TextRun({ text, font: FONT_BODY, size: 19, color: C.META })]
  });
}

function pcChapter(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: sp(480, 200),
    children: [new TextRun({ text, font: FONT_TITLE, size: 40, bold: true, color: C.CHAPTER })]
  });
}

function pcSection(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: sp(560, 200),
    children: [new TextRun({ text, font: FONT_TITLE, size: 32, bold: true, color: C.SECTION })]
  });
}

function pcSoftText(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: sp(0, 200),
    children: [new TextRun({ text, font: FONT_BODY, size: 21, italics: true, color: C.SOFT })]
  });
}

function pcBody(text) {
  return new Paragraph({
    spacing: sp(0, 180),
    indent: { firstLine: 480 },
    children: [new TextRun({ text, font: FONT_BODY, size: 25, color: C.BODY })]
  });
}

function pcDialogue(speaker, text) {
  // Strip surrounding quotes if present
  let clean = text.trim();
  if ((clean.startsWith('"') && clean.endsWith('"')) ||
      (clean.startsWith('“') && clean.endsWith('”'))) {
    clean = clean.slice(1, -1);
  }
  const display = '“' + clean + '”';
  const runs = [];
  if (speaker) {
    runs.push(new TextRun({ text: speaker + ': ', font: FONT_BODY, size: 25, bold: true, color: C.BODY }));
  }
  runs.push(new TextRun({ text: display, font: FONT_BODY, size: 25, color: C.BODY }));
  return new Paragraph({
    spacing: sp(0, 180),
    indent: { firstLine: 480 },
    children: runs
  });
}

function pcThought(text) {
  return new Paragraph({
    spacing: sp(80, 80),
    indent: { left: 480, right: 480 },
    border: {
      left: { style: BorderStyle.SINGLE, size: 6, color: C.QUOTE_BAR, space: 12 }
    },
    children: [new TextRun({ text, font: FONT_BODY, size: 24, italics: true, color: C.QUOTE_TXT })]
  });
}

function pcSceneBreak() {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: sp(320, 320),
    children: [new TextRun({ text: '*  *  *', font: FONT_BODY, size: 20, color: C.SCENE_BR })]
  });
}

function pcEmpty() {
  return new Paragraph({
    children: [new TextRun({ text: '', color: C.BG })]
  });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

// ── Image helper ───────────────────────────────────────────────────────────
const PAGE_W_EMU   = 7560210;
const MARGIN_EMU   = 719190 * 2;
const CONTENT_W_EMU = PAGE_W_EMU - MARGIN_EMU;  // ~6121830
const COVER_MAX_H  = 5000000;
const SCENE_MAX_H  = 3600000;

function loadImage(imgPath, maxH) {
  if (!imgPath || !fs.existsSync(imgPath)) return null;
  try {
    const data = fs.readFileSync(imgPath);
    const ext  = path.extname(imgPath).toLowerCase().replace('.', '');
    const type = ext === 'jpg' ? 'jpeg' : ext;

    // Read pixel dimensions
    let pw = 800, ph = 600;
    if (ext === 'jpg' || ext === 'jpeg') {
      let i = 2;
      while (i < data.length - 10) {
        if (data[i] !== 0xFF) break;
        const m = data[i + 1];
        if (m >= 0xC0 && m <= 0xC3) {
          ph = data.readUInt16BE(i + 5);
          pw = data.readUInt16BE(i + 7);
          break;
        }
        const len = data.readUInt16BE(i + 2);
        i += 2 + len;
      }
    } else if (ext === 'png') {
      pw = data.readUInt32BE(16);
      ph = data.readUInt32BE(20);
    }

    const ratio = pw / ph;
    let cx = CONTENT_W_EMU;
    let cy = Math.round(cx / ratio);
    if (cy > maxH) { cy = maxH; cx = Math.round(cy * ratio); }

    return new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: sp(160, 160),
      children: [new ImageRun({ type, data, transformation: {
        width:  Math.round(cx / 9144),   // EMU -> points (1pt = 12700 EMU... actually 1px ~= 9144 EMU at 96dpi)
        height: Math.round(cy / 9144)
      }})]
    });
  } catch (e) {
    console.error('  [warn] Could not load image:', imgPath, e.message);
    return null;
  }
}

// ── Main ───────────────────────────────────────────────────────────────────
const jobFile = process.argv[2];
if (!jobFile) { console.error('Usage: node gen_storybook_dark.js <job.json>'); process.exit(1); }

const job = JSON.parse(fs.readFileSync(jobFile, 'utf8'));

const children = [];

// Cover page
children.push(pcEmpty());
const coverImg = loadImage(job.cover_image, COVER_MAX_H);
if (coverImg) { children.push(coverImg); children.push(pcEmpty()); }
children.push(pcTitle(job.title));
children.push(pcEmpty());
if (job.author)  children.push(pcSubtitle(job.author));
if (job.genre)   children.push(pcMeta(job.genre));
children.push(pcEmpty());
children.push(pcMeta('Chapter ' + job.chapter_num));
children.push(pageBreak());

// Chapter heading
children.push(pcChapter('Chapter ' + job.chapter_num));
children.push(pcSoftText(job.chapter_title));
children.push(pcEmpty());

// Scenes
for (const sc of job.scenes) {
  children.push(pcSection(sc.title));

  const metaParts = [sc.location, sc.time].filter(Boolean);
  if (metaParts.length) children.push(pcMeta(metaParts.join('  ·  ')));

  const scImg = loadImage(sc.image_path, SCENE_MAX_H);
  if (scImg) { children.push(scImg); children.push(pcEmpty()); }

  let hasContent = false;
  for (const blk of sc.blocks) {
    const text = (blk.text || '').trim();
    if (!text) continue;
    hasContent = true;
    if (blk.type === 'narration')  children.push(pcBody(text));
    else if (blk.type === 'dialogue') children.push(pcDialogue(blk.speaker || '', text));
    else if (blk.type === 'thought')  children.push(pcThought(text));
  }

  if (hasContent) children.push(pcSceneBreak());
  children.push(pcEmpty());
}

// Footer
const footer = new Footer({
  children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({ text: 'pageCast  •  ', font: FONT_BODY, size: 16, color: C.FOOTER }),
      new TextRun({ text: job.title + '  •  ', font: FONT_BODY, size: 16, color: C.FOOTER }),
      new TextRun({ children: [PageNumber.CURRENT], font: FONT_BODY, size: 16, color: C.FOOTER }),
    ]
  })]
});

const doc = new Document({
  background: { color: C.BG },
  sections: [{
    properties: {
      page: {
        size:   { width: 11906, height: 16838 },
        margin: { top: 1247, right: 1134, bottom: 1247, left: 1134 }
      }
    },
    footers: { default: footer },
    children
  }]
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(job.out_path, buf);
  console.log('OK:' + job.out_path);
}).catch(err => {
  console.error('ERROR:' + err.message);
  process.exit(1);
});
