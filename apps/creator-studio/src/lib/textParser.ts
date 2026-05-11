/**
 * PageCast Text Parser
 * ─────────────────────────────────────────────────────────────────────────────
 * Parses raw text (novel prose, script, or markdown) into a structured
 * hierarchy of chapters → scenes → blocks, ready for import into the editor.
 *
 * Handles two common paragraph formats:
 *   • Double-newline format  — standard creative writing export (Word, Scrivener, Google Docs)
 *   • Single-newline format  — PDF-to-text conversion output (one paragraph per line)
 *
 * Character assignment is intentionally left to the writer after import.
 * All dialogue blocks are created with characterId: '' as a placeholder.
 */
import { v4 as uuid } from 'uuid'
import type {
  StoryBlock, NarrationBlock, DialogueBlock, ThoughtBlock,
  QuoteBlock, PauseBlock, SfxBlock
} from '@/types'

// ── Public types ──────────────────────────────────────────────────────────────

export type ParseFormat = 'auto' | 'prose' | 'script' | 'markdown' | 'pagecast'

export interface ParsedScene {
  title:  string
  blocks: StoryBlock[]
}

export interface ParsedChapter {
  title:  string
  scenes: ParsedScene[]
}

export interface ParsedImport {
  format:   ParseFormat
  chapters: ParsedChapter[]
  stats: {
    blocks:     number
    chapters:   number
    scenes:     number
    dialogues:  number
    narrations: number
  }
}

// ── Format detection ──────────────────────────────────────────────────────────

const SCRIPT_TAG     = /^([A-Z][A-Z\s'\-\.]{1,30}):\s*(.*)/
const MD_HEADER      = /^#{1,3}\s+\S/

function detectFormat(text: string): 'prose' | 'script' | 'markdown' | 'pagecast' {
  const lines = text.split('\n')
  let scriptTags = 0, mdHeaders = 0
  let pageCastTags = 0

  for (const line of lines) {
    const t = line.trim()
    if (SCRIPT_TAG.test(t)) scriptTags++
    if (MD_HEADER.test(t))  mdHeaders++
    if (/^::PAGECAST_|^::CAST\b/i.test(t) || /^\[(NARRATION|DIALOGUE|THOUGHT|PAUSE|SFX|TRANSITION)\b/i.test(t)) pageCastTags++
  }

  const total = lines.filter(l => l.trim()).length || 1
  if (pageCastTags > 0) return 'pagecast'
  if (scriptTags / total > 0.08) return 'script'
  if (mdHeaders > 0)             return 'markdown'
  return 'prose'
}

// ── Smart paragraph splitter ──────────────────────────────────────────────────
/**
 * Detects whether the text uses double-newline or single-newline paragraph breaks.
 *
 * PDF-to-text conversions produce one line per paragraph (single \n).
 * Standard prose exports use a blank line between paragraphs (\n\n).
 *
 * Heuristic: if double-newline splits produce ≥ 4 paragraphs with reasonable
 * average length, use double. Otherwise fall back to single-newline.
 */
function splitIntoParagraphs(text: string): string[] {
  const doubleNewlineParts = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean)

  // Good double-newline structure: at least 4 paragraphs
  if (doubleNewlineParts.length >= 4) return doubleNewlineParts

  // Single-newline format (PDF export, Final Draft plain text, etc.)
  // Each non-empty line is its own paragraph
  return text.split('\n').map(p => p.trim()).filter(Boolean)
}

// ── Block factories ───────────────────────────────────────────────────────────

function narration(text: string): NarrationBlock {
  return { id: uuid(), type: 'narration', text: text.trim() }
}
function dialogue(text: string): DialogueBlock {
  return { id: uuid(), type: 'dialogue', characterId: '', text: text.trim(), emotion: 'neutral' }
}
function thought(text: string): ThoughtBlock {
  return { id: uuid(), type: 'thought', characterId: '', text: text.trim() }
}
function quote(text: string, attribution?: string): QuoteBlock {
  return { id: uuid(), type: 'quote', text: text.trim(), attribution, style: 'default' }
}
function pause(duration: number): PauseBlock {
  return { id: uuid(), type: 'pause', duration }
}
function sfx(label: string): SfxBlock {
  return { id: uuid(), type: 'sfx', sfxFile: label.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.mp3', label }
}

function dialogueWithEmotion(text: string, emotion?: string): DialogueBlock {
  return { ...dialogue(text), emotion: emotion?.trim() || 'neutral' }
}

// ── Text helpers ──────────────────────────────────────────────────────────────

/** Strip outer straight or curly quotes */
function stripQuotes(s: string): string {
  return s
    .replace(/^["„"]([\s\S]*?)["‟"]$/, '$1')
    .replace(/^"([\s\S]*)"$/, '$1')
    .trim()
}

/** True if the entire string is wrapped in quotes (curly or straight) */
function isAllQuoted(s: string): boolean {
  // Must start and end with matching quote character, with content between
  return /^["„"].{1,}["‟"]$/.test(s) || /^"[^"]+(?:[^"]*[^"])?"$/.test(s)
}

/** True if string looks like a thought: *text* or (text with 4+ chars) */
function isThought(s: string): boolean {
  return /^\*[^*]+\*$/.test(s) || /^\([^)]{4,}\)$/.test(s)
}

function stripThoughtMarkers(s: string): string {
  return s.replace(/^\*(.*)\*$/, '$1').replace(/^\((.*)\)$/, '$1').trim()
}

/**
 * Split a prose paragraph into alternating narration/dialogue parts.
 * Handles: "Hello," said John.  /  She smiled. "I know."  /  plain narration
 *
 * Works with both straight quotes (") and curly quotes (" ").
 */
function splitProseDialogue(para: string): { type: 'narration' | 'dialogue', text: string }[] {
  const parts: { type: 'narration' | 'dialogue', text: string }[] = []
  // Match quoted spans — greedy to handle nested apostrophes
  // Handles: "text" and "text"
  const re = /["„"]([^""‟"]{2,})["‟"]/g
  let lastIdx = 0
  let m: RegExpExecArray | null
  let foundAny = false

  while ((m = re.exec(para)) !== null) {
    foundAny = true
    const before = para.slice(lastIdx, m.index).trim()
    if (before) parts.push({ type: 'narration', text: before })
    parts.push({ type: 'dialogue', text: m[1].trim() })
    lastIdx = m.index + m[0].length
  }

  const after = para.slice(lastIdx).trim()
  if (after) parts.push({ type: 'narration', text: after })

  return foundAny && parts.length > 0
    ? parts
    : [{ type: 'narration', text: para }]
}

/** True if a line looks like a chapter/act header */
function isChapterHeader(line: string): boolean {
  return /^#{1}\s+/.test(line)
    || /^chapter\s+\S/i.test(line)
    || /^act\s+[ivx\d]/i.test(line)
    || /^prologue\b/i.test(line)
    || /^epilogue\b/i.test(line)
}

/** True if a line looks like a scene/section header */
function isSceneHeader(line: string): boolean {
  return /^#{2,3}\s+/.test(line)
    || /^scene\s+\S/i.test(line)
    || /^part\s+[ivx\d]/i.test(line)
}

/** Extract a clean title from a header line */
function extractTitle(line: string): string {
  return line
    .replace(/^#{1,3}\s+/, '')
    .replace(/^chapter\s+/i,  'Chapter ')
    .replace(/^scene\s+/i,    'Scene ')
    .replace(/^act\s+/i,      'Act ')
    .replace(/^part\s+/i,     'Part ')
    .trim()
}

// ── Structural helpers ────────────────────────────────────────────────────────

function freshScene(title: string): ParsedScene  { return { title, blocks: [] } }
function freshChapter(title: string): ParsedChapter { return { title, scenes: [freshScene('Scene 1')] } }

function ensureChapter(chapters: ParsedChapter[]): ParsedChapter {
  if (chapters.length === 0) chapters.push(freshChapter('Chapter 1'))
  return chapters[chapters.length - 1]
}
function ensureScene(ch: ParsedChapter): ParsedScene {
  if (ch.scenes.length === 0) ch.scenes.push(freshScene('Scene 1'))
  return ch.scenes[ch.scenes.length - 1]
}
function pushBlock(chapters: ParsedChapter[], block: StoryBlock) {
  ensureScene(ensureChapter(chapters)).blocks.push(block)
}

// ── Special-directive parsers (shared across all formats) ─────────────────────

const SFX_RE    = /^\[(?:SFX|sfx|sound):\s*(.+?)\]$/i
const PAUSE_RE  = /^\[(?:pause|beat)(?::\s*(\d+(?:\.\d+)?)\s*s?)?\]$/i
const ATTR_RE   = /^[—\-–]\s*(.+)$/     // — Author Name

function trySpecialDirective(line: string): StoryBlock | null {
  const sfxM   = line.trim().match(SFX_RE)
  if (sfxM)   return sfx(sfxM[1].trim())
  const pauseM = line.trim().match(PAUSE_RE)
  if (pauseM) return pause(parseFloat(pauseM[1] ?? '2'))
  return null
}

// -- PageCast tagged parser --------------------------------------------------

const PAGECAST_TAG_RE = /^\[(NARRATION|DIALOGUE|THOUGHT|PAUSE|SFX|TRANSITION)(?::\s*([^\]|]+))?(?:\s*\|\s*(.+))?\]$/i
const SCENE_META_RE = /^(Ambience|Music|Location|Time):\s*/i

function optionValue(options: string | undefined, key: string): string | undefined {
  if (!options) return undefined
  for (const part of options.split('|')) {
    const [rawKey, ...rest] = part.split('=')
    if (rawKey?.trim().toLowerCase() === key.toLowerCase()) {
      return rest.join('=').trim()
    }
  }
  return undefined
}

function titleFromHash(line: string): string {
  return line.replace(/^#{1,6}\s*/, '').trim()
}

function pushPageCastBlock(chapters: ParsedChapter[], tag: string, target: string | undefined, options: string | undefined, body: string[]) {
  const text = body.join('\n').trim()
  const name = tag.toUpperCase()

  if (name === 'NARRATION') {
    if (text) pushBlock(chapters, narration(text))
    return
  }

  if (name === 'DIALOGUE') {
    if (text) pushBlock(chapters, dialogueWithEmotion(stripQuotes(text), optionValue(options, 'emotion')))
    return
  }

  if (name === 'THOUGHT') {
    if (text) pushBlock(chapters, thought(stripThoughtMarkers(stripQuotes(text))))
    return
  }

  if (name === 'PAUSE') {
    const durationText = target ?? optionValue(options, 'duration') ?? '1'
    const duration = parseFloat(durationText.replace(/s$/i, ''))
    pushBlock(chapters, pause(Number.isFinite(duration) ? duration : 1))
    return
  }

  if (name === 'SFX') {
    pushBlock(chapters, sfx((target ?? text ?? 'Sound effect').trim()))
    return
  }

  if (name === 'TRANSITION') {
    pushBlock(chapters, pause(1))
  }
}

function parsePageCast(text: string): ParsedChapter[] {
  const chapters: ParsedChapter[] = []
  const lines = text.split('\n')
  let skipMetadata = false
  let activeTag: { name: string; target?: string; options?: string; body: string[] } | null = null

  const flush = () => {
    if (!activeTag) return
    pushPageCastBlock(chapters, activeTag.name, activeTag.target, activeTag.options, activeTag.body)
    activeTag = null
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()

    if (/^::PAGECAST_|^::CAST\b/i.test(line)) {
      flush()
      skipMetadata = true
      continue
    }
    if (skipMetadata) {
      if (line === '::') skipMetadata = false
      continue
    }
    if (!line) {
      if (activeTag) activeTag.body.push('')
      continue
    }

    if (/^#\s+/.test(line)) {
      flush()
      chapters.push(freshChapter(titleFromHash(line)))
      continue
    }

    if (/^#{2,6}\s+/.test(line)) {
      flush()
      const ch = ensureChapter(chapters)
      const title = titleFromHash(line)
      if (ensureScene(ch).blocks.length > 0) ch.scenes.push(freshScene(title))
      else ensureScene(ch).title = title
      continue
    }

    if (SCENE_META_RE.test(line)) continue

    const tagMatch = line.match(PAGECAST_TAG_RE)
    if (tagMatch) {
      flush()
      activeTag = { name: tagMatch[1], target: tagMatch[2]?.trim(), options: tagMatch[3]?.trim(), body: [] }
      if (/^(PAUSE|SFX|TRANSITION)$/i.test(tagMatch[1])) flush()
      continue
    }

    if (activeTag) {
      activeTag.body.push(rawLine.trimEnd())
      continue
    }

    pushBlock(chapters, narration(line))
  }

  flush()
  return chapters
}

// ── Novel / prose parser ──────────────────────────────────────────────────────

function parseProse(text: string): ParsedChapter[] {
  const chapters: ParsedChapter[] = []
  const paragraphs = splitIntoParagraphs(text)

  for (const para of paragraphs) {
    // ── Chapter header ──
    if (isChapterHeader(para)) {
      chapters.push(freshChapter(extractTitle(para)))
      continue
    }

    // ── Scene header ──
    if (isSceneHeader(para)) {
      const title = extractTitle(para)
      const ch    = ensureChapter(chapters)
      if (ensureScene(ch).blocks.length > 0 || ch.scenes.length === 0) {
        ch.scenes.push(freshScene(title))
      } else {
        ensureScene(ch).title = title
      }
      continue
    }

    // ── Section break ── (*** or --- or ===)
    if (/^(\*{3,}|-{3,}|={3,})$/.test(para)) {
      const ch = ensureChapter(chapters)
      if (ensureScene(ch).blocks.length > 0) {
        ch.scenes.push(freshScene(`Scene ${ch.scenes.length + 1}`))
      }
      continue
    }

    // ── Special directives ──
    const special = trySpecialDirective(para)
    if (special) { pushBlock(chapters, special); continue }

    // ── Blockquote ── (> prefix)
    if (para.startsWith('>')) {
      const lines = para.split('\n').map(l => l.replace(/^>\s?/, ''))
      let attr: string | undefined
      const last = lines[lines.length - 1]
      if (ATTR_RE.test(last)) { attr = last.replace(ATTR_RE, '$1'); lines.pop() }
      pushBlock(chapters, quote(lines.join('\n'), attr))
      continue
    }

    // ── Thought ── (*text* or (text))
    if (isThought(para)) {
      pushBlock(chapters, thought(stripThoughtMarkers(para)))
      continue
    }

    // ── All-quoted dialogue ──
    if (isAllQuoted(para)) {
      pushBlock(chapters, dialogue(stripQuotes(para)))
      continue
    }

    // ── Mixed prose: narration + inline dialogue ──
    // (handles "Hello," said John. She smiled. "I know.")
    const mixed = splitProseDialogue(para)
    if (mixed.some(p => p.type === 'dialogue')) {
      for (const part of mixed) {
        if (!part.text) continue
        pushBlock(chapters, part.type === 'dialogue' ? dialogue(part.text) : narration(part.text))
      }
      continue
    }

    // ── Plain narration (bullets, prose, numbered lists, etc.) ──
    pushBlock(chapters, narration(para))
  }

  return chapters
}

// ── Script parser ─────────────────────────────────────────────────────────────

function parseScript(text: string): ParsedChapter[] {
  const chapters: ParsedChapter[] = []
  const lines = text.split('\n')
  let i = 0

  while (i < lines.length) {
    const line = lines[i].trim()
    i++
    if (!line) continue

    if (isChapterHeader(line)) { chapters.push(freshChapter(extractTitle(line))); continue }
    if (isSceneHeader(line)) {
      const title = extractTitle(line)
      const ch = ensureChapter(chapters)
      if (ensureScene(ch).blocks.length > 0) ch.scenes.push(freshScene(title))
      else ensureScene(ch).title = title
      continue
    }

    const special = trySpecialDirective(line)
    if (special) { pushBlock(chapters, special); continue }

    if (/^\(.+\)$/.test(line)) {
      const inner = line.slice(1, -1).trim()
      pushBlock(chapters, inner.length < 60 ? sfx(inner) : narration(inner))
      continue
    }

    const tagMatch = line.match(SCRIPT_TAG)
    if (tagMatch) {
      let speechText = tagMatch[2].trim()
      if (!speechText) {
        while (i < lines.length && !lines[i].trim()) i++
        speechText = lines[i]?.trim() ?? ''
        if (speechText) i++
      }
      if (speechText) {
        pushBlock(chapters,
          /^NARRATOR$/i.test(tagMatch[1].trim())
            ? narration(speechText)
            : dialogue(stripQuotes(speechText))
        )
      }
      continue
    }

    if (line) pushBlock(chapters, narration(line))
  }

  return chapters
}

// ── Markdown parser ───────────────────────────────────────────────────────────

function parseMarkdown(text: string): ParsedChapter[] {
  const chapters: ParsedChapter[] = []
  const segments = splitIntoParagraphs(text)

  for (const seg of segments) {
    if (isChapterHeader(seg)) { chapters.push(freshChapter(extractTitle(seg))); continue }

    if (isSceneHeader(seg)) {
      const title = extractTitle(seg)
      const ch = ensureChapter(chapters)
      if (ensureScene(ch).blocks.length > 0) ch.scenes.push(freshScene(title))
      else ensureScene(ch).title = title
      continue
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(seg.split('\n')[0].trim())) {
      const ch = ensureChapter(chapters)
      if (ensureScene(ch).blocks.length > 0) {
        ch.scenes.push(freshScene(`Scene ${ch.scenes.length + 1}`))
      }
      continue
    }

    if (seg.startsWith('>')) {
      const lines = seg.split('\n').map(l => l.replace(/^>\s?/, ''))
      let attr: string | undefined
      const last = lines[lines.length - 1]
      if (ATTR_RE.test(last)) { attr = last.replace(ATTR_RE, '$1'); lines.pop() }
      pushBlock(chapters, quote(lines.join('\n'), attr))
      continue
    }

    const special = trySpecialDirective(seg)
    if (special) { pushBlock(chapters, special); continue }

    if (isThought(seg)) { pushBlock(chapters, thought(stripThoughtMarkers(seg))); continue }
    if (isAllQuoted(seg)) { pushBlock(chapters, dialogue(stripQuotes(seg))); continue }

    const mixed = splitProseDialogue(seg)
    if (mixed.some(p => p.type === 'dialogue')) {
      for (const part of mixed) {
        if (!part.text) continue
        pushBlock(chapters, part.type === 'dialogue' ? dialogue(part.text) : narration(part.text))
      }
      continue
    }

    // Strip markdown inline syntax, then narrate
    const clean = seg
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/__(.+?)__/g, '$1')
      .replace(/_(.+?)_/g, '$1')
      .trim()
    if (clean) pushBlock(chapters, narration(clean))
  }

  return chapters
}

// ── Main entry ────────────────────────────────────────────────────────────────

export function parseText(text: string, format: ParseFormat = 'auto'): ParsedImport {
  const clean = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()

  const detected   = format === 'auto' ? detectFormat(clean) : format
  const usedFormat = detected

  let chapters: ParsedChapter[]
  if      (usedFormat === 'script')   chapters = parseScript(clean)
  else if (usedFormat === 'markdown') chapters = parseMarkdown(clean)
  else if (usedFormat === 'pagecast') chapters = parsePageCast(clean)
  else                                chapters = parseProse(clean)

  // Ensure structure is never empty
  if (chapters.length === 0) chapters = [freshChapter('Chapter 1')]
  for (const ch of chapters) {
    if (ch.scenes.length === 0) ch.scenes.push(freshScene('Scene 1'))
    // Prune empty scenes (keep at least one)
    const nonEmpty = ch.scenes.filter(sc => sc.blocks.length > 0)
    ch.scenes = nonEmpty.length > 0 ? nonEmpty : [freshScene('Scene 1')]
  }

  // Compile stats
  let blocks = 0, dialogues = 0, narrations = 0
  for (const ch of chapters) {
    for (const sc of ch.scenes) {
      for (const b of sc.blocks) {
        blocks++
        if (b.type === 'dialogue')  dialogues++
        if (b.type === 'narration') narrations++
      }
    }
  }

  return {
    format: usedFormat as ParseFormat,
    chapters,
    stats: {
      blocks,
      chapters:   chapters.length,
      scenes:     chapters.reduce((n, ch) => n + ch.scenes.length, 0),
      dialogues,
      narrations,
    },
  }
}

export function formatParsedImportAsPageCastText(result: ParsedImport): string {
  const out: string[] = [
    '::PAGECAST_BOOK',
    'Title:',
    'Author:',
    'Language: en',
    'Version: 1.0',
    'Default Narrator: narrator',
    '::',
    '',
    '::CAST',
    'Narrator: narrator | role=narrator | voice=calm_female',
    '::',
    '',
  ]

  for (const chapter of result.chapters) {
    out.push(`# ${chapter.title}`, '')

    for (const scene of chapter.scenes) {
      out.push(`## ${scene.title}`, '')

      for (const block of scene.blocks) {
        if (block.type === 'narration') {
          out.push('[NARRATION]', block.text.trim(), '')
        } else if (block.type === 'dialogue') {
          const emotion = block.emotion && block.emotion !== 'neutral' ? ` | emotion=${block.emotion}` : ''
          out.push(`[DIALOGUE${emotion}]`, `"${block.text.trim()}"`, '')
        } else if (block.type === 'thought') {
          out.push('[THOUGHT]', block.text.trim(), '')
        } else if (block.type === 'quote') {
          out.push('[NARRATION]', block.attribution ? `${block.text.trim()}\n- ${block.attribution}` : block.text.trim(), '')
        } else if (block.type === 'pause') {
          out.push(`[PAUSE: ${block.duration}s]`, '')
        } else if (block.type === 'sfx') {
          out.push(`[SFX: ${block.label || block.sfxFile || 'Sound effect'}]`, '')
        }
      }
    }
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}
