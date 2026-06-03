#!/usr/bin/env node
/**
 * gen_storybook_dark.js  --  pageCast Dark theme document builder
 * Supports two chapter formats:
 *   ch.paragraphs[]  -- manuscript mode (proper prose from _manuscript.docx)
 *   ch.scenes[]      -- legacy .txt mode
 */
'use strict';
const fs   = require('fs');
const path = require('path');

let docxMod;
try {
  docxMod = require(path.join(__dirname, 'node_modules', 'docx'));
} catch (e) {
  try { docxMod = require('docx'); }
  catch (e2) { console.error('ERROR:Cannot find docx module. Run: npm install docx --prefix skills/'); process.exit(1); }
}
const {
  Document, Packer, Paragraph, TextRun, ImageRun,
  AlignmentType, Footer, Header,
  PageNumber, BorderStyle,
  ExternalHyperlink, PageBreak,
  HorizontalPositionRelativeFrom, HorizontalPositionAlign,
  VerticalPositionRelativeFrom,
  TextWrappingType,
} = docxMod;

// ── Palette ──────────────────────────────────────────────────────────────────
const C = {
  BG:          '0F0F14',
  TITLE:       'FFFFFF',
  SUBTITLE:    '8C8C98',
  SOFT:        'B7B7C2',
  META:        '8C8C98',
  BODY:        'E6E6EB',
  CHAPTER:     'FFC875',
  SECTION:     'FFFFFF',
  SCENE_BR:    '8C8C98',
  QUOTE_TXT:   'B69CFF',
  QUOTE_BAR:   'B69CFF',
  FOOTER_LINE: '2A2A38',
  FOOTER:      'B7B7C2',
  FOOTER_HL:   '7CC7FF',
  DIVIDER:     '7CC7FF',
};
const FONT_TITLE = 'Playfair Display';
const FONT_BODY  = 'Segoe UI';

const sp = (before, after, line) => {
  const s = { before, after };
  if (line) { s.line = line; s.lineRule = 'auto'; }
  return s;
};

// ── Paragraph builders ───────────────────────────────────────────────────────
function pcTitle(text) {
  return new Paragraph({ alignment: AlignmentType.CENTER, spacing: sp(480, 360),
    children: [new TextRun({ text, font: FONT_TITLE, size: 64, bold: true, color: C.TITLE })] });
}
function pcSubtitle(text) {
  return new Paragraph({ alignment: AlignmentType.CENTER, spacing: sp(0, 560),
    children: [new TextRun({ text, font: FONT_BODY, size: 28, italics: true, color: C.SUBTITLE })] });
}
function pcMeta(text) {
  return new Paragraph({ alignment: AlignmentType.CENTER, spacing: sp(0, 100),
    children: [new TextRun({ text, font: FONT_BODY, size: 19, color: C.META })] });
}
function pcDivider() {
  return new Paragraph({ alignment: AlignmentType.CENTER, spacing: sp(120, 240),
    border: { bottom: { style: BorderStyle.SINGLE, size: 15, color: C.DIVIDER, space: 1 } },
    children: [new TextRun({ text: '', color: C.BG })] });
}
function pcChapter(text) {
  return new Paragraph({ alignment: AlignmentType.CENTER, spacing: sp(600, 280),
    children: [new TextRun({ text, font: FONT_BODY, size: 40, bold: true, color: C.CHAPTER })] });
}
function pcSection(text) {
  return new Paragraph({ alignment: AlignmentType.CENTER, spacing: sp(480, 160),
    children: [new TextRun({ text, font: FONT_BODY, size: 32, bold: true, color: C.SECTION })] });
}
function pcSoftText(text) {
  return new Paragraph({ alignment: AlignmentType.CENTER, spacing: sp(0, 200),
    children: [new TextRun({ text, font: FONT_BODY, size: 21, italics: true, color: C.SOFT })] });
}
function pcBody(text) {
  return new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: sp(0, 120, 324),
    indent: { firstLine: 480 },
    children: [new TextRun({ text, font: FONT_BODY, size: 25, color: C.BODY })] });
}
function pcDialogue(speaker, text) {
  let clean = text.trim();
  if ((clean.startsWith('"') && clean.endsWith('"')) ||
      (clean.startsWith('“') && clean.endsWith('”'))) {
    clean = clean.slice(1, -1);
  }
  const display = '“' + clean + '”';
  const runs = [];
  if (speaker) runs.push(new TextRun({ text: speaker + ': ', font: FONT_BODY, size: 25, bold: true, color: C.BODY }));
  runs.push(new TextRun({ text: display, font: FONT_BODY, size: 25, color: C.BODY }));
  return new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: sp(0, 120, 324),
    indent: { firstLine: 480 }, children: runs });
}
function pcThought(text) {
  return new Paragraph({ spacing: sp(200, 200, 336), indent: { left: 567, right: 567 },
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: C.QUOTE_BAR, space: 12 } },
    children: [new TextRun({ text, font: FONT_BODY, size: 24, italics: true, color: C.QUOTE_TXT })] });
}
function pcSceneBreak() {
  return new Paragraph({ alignment: AlignmentType.CENTER, spacing: sp(280, 280),
    children: [new TextRun({ text: '❆ ❆ ❆', font: FONT_BODY, size: 28, color: C.SCENE_BR })] });
}
function pcEmpty() {
  return new Paragraph({ children: [new TextRun({ text: '', color: C.BG })] });
}
function doPageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

// ── Image loaders ─────────────────────────────────────────────────────────────
// EMU: 1 inch = 914400. 1 pt = 12700. A4 page = 595 x 842 pt.
const CONTENT_W_EMU = 6121830;  // A4 content width (~6.7 in)
const SCENE_MAX_H   = 3600000;  // scene image max height (~3.9 in)
const PAGE_W_PT     = 595;      // A4 full page width in points
const PAGE_H_PT     = 842;      // A4 full page height in points

/**
 * Inline scene image — constrained to content width, max height in EMU.
 * Returns a centred Paragraph or null.
 */
function loadImage(imgPath, maxH) {
  if (!imgPath || !fs.existsSync(imgPath)) return null;
  try {
    const data = fs.readFileSync(imgPath);
    const ext  = path.extname(imgPath).toLowerCase().replace('.', '');
    const type = ext === 'jpg' ? 'jpeg' : ext;
    let pw = 800, ph = 600;
    if (ext === 'jpg' || ext === 'jpeg') {
      let i = 2;
      while (i < data.length - 10) {
        if (data[i] !== 0xFF) break;
        const m = data[i + 1];
        if (m >= 0xC0 && m <= 0xC3) { ph = data.readUInt16BE(i + 5); pw = data.readUInt16BE(i + 7); break; }
        i += 2 + data.readUInt16BE(i + 2);
      }
    } else if (ext === 'png') {
      pw = data.readUInt32BE(16); ph = data.readUInt32BE(20);
    }
    const ratio = pw / ph;
    let cx = CONTENT_W_EMU, cy = Math.round(cx / ratio);
    if (cy > maxH) { cy = maxH; cx = Math.round(cy * ratio); }
    return new Paragraph({ alignment: AlignmentType.CENTER, spacing: sp(160, 160),
      children: [new ImageRun({ type, data, transformation: {
        width: Math.round(cx / 12700), height: Math.round(cy / 12700) } })] });
  } catch (e) {
    console.error('  [warn] image skipped:', imgPath, e.message);
    return null;
  }
}

/**
 * Cover image as a full-page floating "Behind Text" ImageRun.
 * Positioned: left-aligned to page, pulled ~62pt above its anchor paragraph,
 * so it fills the page behind the cover text.
 * Returns an ImageRun (to be placed inside the cover title paragraph), or null.
 */
function loadCoverImageRun(imgPath) {
  if (!imgPath || !fs.existsSync(imgPath)) return null;
  try {
    const data = fs.readFileSync(imgPath);
    const ext  = path.extname(imgPath).toLowerCase().replace('.', '');
    const type = ext === 'jpg' ? 'jpeg' : ext;
    return new ImageRun({
      type, data,
      transformation: { width: PAGE_W_PT, height: PAGE_H_PT },
      floating: {
        horizontalPosition: {
          relative: HorizontalPositionRelativeFrom.PAGE,
          align:    HorizontalPositionAlign.LEFT,
        },
        verticalPosition: {
          relative: VerticalPositionRelativeFrom.PARAGRAPH,
          offset:   -792218,   // pull image ~62pt above the anchor paragraph → top of page
        },
        wrap:    { type: TextWrappingType.NONE },
        margins: { top: 0, bottom: 0, left: 114300, right: 114300 },
        behindDocument: true,
        allowOverlap:   true,
        lockAnchor:     false,
      },
    });
  } catch (e) {
    console.error('  [warn] cover image skipped:', imgPath, e.message);
    return null;
  }
}

// ── Read job ──────────────────────────────────────────────────────────────────
const jobFile = process.argv[2];
if (!jobFile) { console.error('Usage: node gen_storybook_dark.js <job.json>'); process.exit(1); }
const job = JSON.parse(fs.readFileSync(jobFile, 'utf8'));

const chaptersData = job.chapters || [{
  number: job.chapter_num, title: job.chapter_title, scenes: job.scenes || []
}];

const children = [];

// ── Page 1: Cover page ────────────────────────────────────────────────────────
// Image anchor + title text live in the SAME paragraph so the image floats
// behind the title without needing spacers. Layout matches the user-edited reference.
{
  const coverRun = loadCoverImageRun(job.cover_image);
  const titleRun = new TextRun({
    text: job.title, font: FONT_TITLE, size: 64, bold: true, color: 'FFFFFF',
  });
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: sp(160, 160),
    children: coverRun ? [coverRun, titleRun] : [titleRun],
  }));
}
// "pageCast Studio" — italic, grey
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: sp(0, 560),
  children: [new TextRun({ text: 'pageCast Studio', font: FONT_BODY, size: 28, italics: true, color: C.SUBTITLE })]
}));
// Blue divider line (bottom border on an empty paragraph)
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: sp(120, 240),
  border: { bottom: { style: BorderStyle.SINGLE, size: 15, space: 1, color: C.DIVIDER } },
  children: [],
}));
children.push(pcEmpty());
// Chapter count — grey
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: sp(0, 100),
  children: [new TextRun({
    text: chaptersData.length === 1
      ? 'Chapter ' + chaptersData[0].number
      : chaptersData.length + ' Chapters',
    font: FONT_BODY, size: 19, color: C.META,
  })]
}));
children.push(doPageBreak());

// ── Render one manuscript paragraph ──────────────────────────────────────────
function renderManuscriptParagraph(p) {
  const text = (p.text || '').trim();
  switch (p.type) {
    case 'title':           return;   // already on cover / title page
    case 'subtitle':        return;   // already on title page
    case 'chapter_heading': return;   // already rendered as pcChapter
    case 'centered':
      if (text) children.push(pcMeta(text));
      return;
    case 'scene_break':
      children.push(pcSceneBreak());
      children.push(pcEmpty());
      return;
    case 'scene_number': {
      const img = loadImage(p.image_path || null, SCENE_MAX_H);
      if (img) { children.push(img); children.push(pcEmpty()); }
      return;
    }
    case 'thought':
      if (text) children.push(pcThought(text));
      return;
    default:
      if (text) children.push(pcBody(text));
  }
}

// ── Chapters ──────────────────────────────────────────────────────────────────
for (let ci = 0; ci < chaptersData.length; ci++) {
  const ch = chaptersData[ci];
  children.push(pcChapter('Chapter ' + ch.number));
  children.push(pcSoftText(ch.title));
  children.push(pcEmpty());

  if (ch.paragraphs && ch.paragraphs.length) {
    // Manuscript mode
    for (const p of ch.paragraphs) {
      renderManuscriptParagraph(p);
    }
  } else if (ch.scenes && ch.scenes.length) {
    // Legacy .txt mode
    for (const sc of ch.scenes) {
      children.push(pcSection(sc.title));
      const metaParts = [sc.location, sc.time].filter(Boolean);
      if (metaParts.length) children.push(pcMeta(metaParts.join('  ·  ')));
      const scImg = loadImage(sc.image_path, SCENE_MAX_H);
      if (scImg) { children.push(scImg); children.push(pcEmpty()); }
      let hasContent = false;
      for (const blk of sc.blocks) {
        const blkText = (blk.text || '').trim();
        if (!blkText) continue;
        hasContent = true;
        if (blk.type === 'narration')     children.push(pcBody(blkText));
        else if (blk.type === 'dialogue') children.push(pcDialogue(blk.speaker || '', blkText));
        else if (blk.type === 'thought')  children.push(pcThought(blkText));
      }
      if (hasContent) children.push(pcSceneBreak());
      children.push(pcEmpty());
    }
  }

  if (ci < chaptersData.length - 1) children.push(doPageBreak());
}

// ── Header / Footer ───────────────────────────────────────────────────────────
const blankHeader = new Header({
  children: [new Paragraph({ children: [new TextRun({ text: '', color: C.BG })] })]
});

function makeFooter(showPageNum) {
  const runs = [
    new TextRun({ text: 'Unlock more stories at ', font: FONT_BODY, size: 16, color: C.FOOTER }),
    new ExternalHyperlink({ link: 'https://pagecast-nine.vercel.app/store',
      children: [new TextRun({ text: 'PageCast', font: FONT_BODY, size: 16, color: C.FOOTER_HL })] }),
  ];
  if (showPageNum) {
    runs.push(new TextRun({ text: '  •  ', font: FONT_BODY, size: 16, color: C.FOOTER }));
    runs.push(new TextRun({ children: [PageNumber.CURRENT], font: FONT_BODY, size: 16, color: C.FOOTER }));
  }
  return new Footer({ children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    border: { top: { style: BorderStyle.SINGLE, size: 4, color: C.FOOTER_LINE, space: 6 } },
    children: runs
  })] });
}

// ── Build & save ──────────────────────────────────────────────────────────────
const doc = new Document({
  background: { color: C.BG },
  sections: [{
    properties: {
      titlePage: true,
      page: {
        size:        { width: 11906, height: 16838 },
        margin:      { top: 1247, right: 1134, bottom: 1247, left: 1134 },
        pageNumbers: { start: 0 },
      }
    },
    headers: { default: blankHeader, first: blankHeader },
    footers: { default: makeFooter(true), first: makeFooter(false) },
    children
  }]
});

Packer.toBuffer(doc).then(buf => {
  const tmpPath = job.out_path + '.tmp';
  fs.writeFileSync(tmpPath, buf);
  let finalPath = job.out_path;
  try {
    if (fs.existsSync(job.out_path)) fs.unlinkSync(job.out_path);
    fs.renameSync(tmpPath, job.out_path);
  } catch (e) {
    // File locked in Word — save with timestamp suffix
    const ext  = path.extname(job.out_path);
    const base = job.out_path.slice(0, -ext.length);
    const ts   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    finalPath  = base + '_' + ts + ext;
    try {
      fs.renameSync(tmpPath, finalPath);
    } catch (e2) {
      console.error('ERROR:Cannot save file: ' + e2.message);
      process.exit(1);
    }
    console.log('NOTE:Original file is open in Word; saved as: ' + path.basename(finalPath));
  }
  console.log('OK:' + finalPath);
}).catch(err => {
  console.error('ERROR:' + err.message);
  process.exit(1);
});
