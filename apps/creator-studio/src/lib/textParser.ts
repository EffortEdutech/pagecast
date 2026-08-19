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

export interface ParsedCastMember {
  /** Display name, e.g. "Mak Cempaka" */
  name: string
  /** Slug/id used as the characterId hint in DIALOGUE/THOUGHT tags, e.g. "mak_cempaka" */
  slug: string
  /** Raw role string from the CAST line, e.g. "narrator" | "main_character" | "supporting" */
  role: string
  /** Raw voice descriptor from the CAST line, e.g. "adult_female_warm_loud" — not a real voiceId */
  voiceDescriptor?: string
  /** Raw color word from the CAST line, e.g. "amber" */
  colorWord?: string
}

export interface ParsedBookMeta {
  title?: string
  author?: string
  language?: string
  genre?: string
  defaultNarrator?: string
}

export interface ParsedImport {
  format:   ParseFormat
  chapters: ParsedChapter[]
  /** Cast members declared in ::CAST blocks (pagecast format only), deduped by slug */
  cast?: ParsedCastMember[]
  /** Book metadata declared in the first ::PAGECAST_BOOK block encountered (pagecast format only) */
  meta?: ParsedBookMeta
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

export function normalizeImportedText(text: string): string {
  return text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/([A-Za-z])-\n([A-Za-z])/g, '$1$2')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
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

/** Parses one ::CAST line: "Mak Cempaka: mak_cempaka | role=supporting | voice=... | color=gold" */
function parseCastLine(line: string): ParsedCastMember | null {
  const m = line.match(/^([^:]+):\s*([^|]+)(?:\|(.*))?$/)
  if (!m) return null
  const name = m[1].trim()
  const slug = m[2].trim()
  if (!name || !slug) return null
  const options = m[3]
  return {
    name,
    slug,
    role: optionValue(options, 'role') ?? 'character',
    voiceDescriptor: optionValue(options, 'voice'),
    colorWord: optionValue(options, 'color'),
  }
}

/** Parses one ::PAGECAST_BOOK metadata line: "Title: Kampung Awan Club" */
function parseMetaLine(line: string): { key: string; value: string } | null {
  const m = line.match(/^([A-Za-z][A-Za-z \-]*):\s*(.+)$/)
  if (!m) return null
  return { key: m[1].trim().toLowerCase(), value: m[2].trim() }
}

function pushPageCastBlock(chapters: ParsedChapter[], tag: string, target: string | undefined, options: string | undefined, body: string[]) {
  const text = body.join('\n').trim()
  const name = tag.toUpperCase()

  if (name === 'NARRATION') {
    if (text) pushBlock(chapters, narration(text))
    return
  }

  if (name === 'DIALOGUE') {
    if (text) {
      const block = dialogueWithEmotion(stripQuotes(text), optionValue(options, 'emotion'))
      // Store character name as a hint so handleImport can resolve it to a real ID.
      // e.g. [DIALOGUE: pip | emotion=curious] → characterId = 'pip' (resolved later)
      if (target) block.characterId = target.trim()
      pushBlock(chapters, block)
    }
    return
  }

  if (name === 'THOUGHT') {
    if (text) {
      const block = thought(stripThoughtMarkers(stripQuotes(text)))
      // Same name hint for thoughts
      if (target) block.characterId = target.trim()
      pushBlock(chapters, block)
    }
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

function parsePageCast(text: string): { chapters: ParsedChapter[]; cast: ParsedCastMember[]; meta: ParsedBookMeta } {
  const chapters: ParsedChapter[] = []
  const castBySlug = new Map<string, ParsedCastMember>()
  const meta: ParsedBookMeta = {}
  const lines = text.split('\n')
  // Which metadata block we're currently inside, if any. Concatenated multi-file
  // imports contain one of each per file — every block is captured (cast merges
  // by slug across files; book meta keeps the first non-empty value per field).
  let metaBlock: 'book' | 'cast' | null = null
  let activeTag: { name: string; target?: string; options?: string; body: string[] } | null = null

  const flush = () => {
    if (!activeTag) return
    pushPageCastBlock(chapters, activeTag.name, activeTag.target, activeTag.options, activeTag.body)
    activeTag = null
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()

    if (/^::PAGECAST_/i.test(line)) {
      flush()
      metaBlock = 'book'
      continue
    }
    if (/^::CAST\b/i.test(line)) {
      flush()
      metaBlock = 'cast'
      continue
    }
    if (metaBlock) {
      if (line === '::') { metaBlock = null; continue }
      if (!line) continue
      if (metaBlock === 'book') {
        const kv = parseMetaLine(line)
        if (kv) {
          if (kv.key === 'title'             && !meta.title)           meta.title = kv.value
          else if (kv.key === 'author'       && !meta.author)          meta.author = kv.value
          else if (kv.key === 'language'     && !meta.language)        meta.language = kv.value
          else if (kv.key === 'genre'        && !meta.genre)           meta.genre = kv.value
          else if (kv.key === 'default narrator' && !meta.defaultNarrator) meta.defaultNarrator = kv.value
        }
      } else {
        const member = parseCastLine(line)
        if (member && !castBySlug.has(member.slug.toLowerCase())) {
          castBySlug.set(member.slug.toLowerCase(), member)
        }
      }
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
  return { chapters, cast: Array.from(castBySlug.values()), meta }
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
  const clean = normalizeImportedText(text)

  const detected   = format === 'auto' ? detectFormat(clean) : format
  const usedFormat = detected

  let chapters: ParsedChapter[]
  let cast: ParsedCastMember[] | undefined
  let meta: ParsedBookMeta | undefined

  if      (usedFormat === 'script')   chapters = parseScript(clean)
  else if (usedFormat === 'markdown') chapters = parseMarkdown(clean)
  else if (usedFormat === 'pagecast') {
    const result = parsePageCast(clean)
    chapters = result.chapters
    cast     = result.cast
    meta     = result.meta
  }
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
    cast,
    meta,
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

// ── Folder import (multi-file pagecast concatenation) ──────────────────────────

/** True if the given text contains a ::PAGECAST_BOOK marker (case-insensitive). */
export function isPageCastFile(text: string): boolean {
  return /^::PAGECAST_BOOK\b/im.test(text)
}

/**
 * Extracts the trailing number in a filename (e.g. "HH_S1Cl01_pagecast.txt" → 1,
 * "Glitch_Ch7_pagecast.txt" → 7). Falls back to +Infinity (sorts last) when no
 * digits are present, so unnumbered files land at the end rather than the start.
 */
function trailingFileNumber(filename: string): number {
  const matches = filename.match(/\d+/g)
  if (!matches || matches.length === 0) return Number.POSITIVE_INFINITY
  return parseInt(matches[matches.length - 1], 10)
}

export interface FolderFile {
  name: string
  text: string
}

export interface ConcatenatedFolderImport {
  /** Combined text, ready for parseText(combinedText, 'pagecast') */
  combinedText: string
  /** Filenames in the order they were concatenated */
  order: string[]
}

/**
 * Sorts a set of *_pagecast.txt files into castlet/chapter order (by the trailing
 * number in each filename — Cl01…Cl08, Ch1…Ch8, S1Cl01…S1Cl08, etc.) and joins them
 * into a single text blob. Each file keeps its own ::PAGECAST_BOOK / ::CAST metadata
 * block — parsePageCast() already skips/consumes those wherever they appear and
 * treats every top-level "# " header as a new chapter, so N files in → N chapters out.
 */
export function concatenatePageCastFiles(files: FolderFile[]): ConcatenatedFolderImport {
  const sorted = [...files].sort((a, b) => {
    const na = trailingFileNumber(a.name)
    const nb = trailingFileNumber(b.name)
    if (na !== nb) return na - nb
    return a.name.localeCompare(b.name)
  })
  return {
    combinedText: sorted.map(f => normalizeImportedText(f.text)).join('\n\n'),
    order: sorted.map(f => f.name),
  }
}

// ── Casting helpers (best-effort color/voice guesses from CAST metadata) ───────

/**
 * Fallback palette — mirrors CHARACTER_COLORS in app/(studio)/voices/page.tsx so
 * auto-created characters look consistent with manually-added ones.
 */
export const FALLBACK_CHARACTER_COLORS = [
  '#A98BFF', '#4DB8FF', '#F5C842', '#3DD68C', '#F05F6E', '#FF9F43', '#C44AE8', '#48DBFB',
]

const NAMED_COLOR_HEX: Record<string, string> = {
  amber: '#F5C842', gold: '#F5C842', yellow: '#F5C842',
  teal: '#2DD4BF', cyan: '#48DBFB', sky: '#4DB8FF', blue: '#4DB8FF', navy: '#1E3A8A',
  lavender: '#C9A9FF', purple: '#A98BFF', violet: '#A98BFF', indigo: '#6366F1',
  orange: '#FF9F43', coral: '#FF7F6E', red: '#F05F6E', crimson: '#DC2626', maroon: '#7F1D1D',
  brown: '#A9713D', tan: '#D2B48C',
  green: '#3DD68C', mint: '#3DD68C', olive: '#7A7A3D',
  pink: '#FF8FC7', rose: '#FF8FC7', magenta: '#C44AE8',
  gray: '#9896A8', grey: '#9896A8', silver: '#C4C4CC',
  black: '#2A2A33', white: '#F5F5F7',
}

/** Best-effort named-color → hex lookup, with a stable cycling fallback for unknown words. */
export function hexForColorWord(word: string | undefined, fallbackIndex = 0): string {
  const key = (word ?? '').trim().toLowerCase()
  return NAMED_COLOR_HEX[key] ?? FALLBACK_CHARACTER_COLORS[fallbackIndex % FALLBACK_CHARACTER_COLORS.length]
}

/**
 * Best-effort mapping from a free-text CAST voice descriptor (e.g. "young_boy_confident",
 * "elderly_male_dramatic") to one of the real catalog voice IDs in lib/voiceLibrary.ts.
 * Never authoritative — always shown as editable in the Voices page afterward.
 */
export function guessVoiceId(descriptor: string | undefined, role?: string): string | undefined {
  const d = (descriptor ?? '').toLowerCase()
  const isNarratorRole = (role ?? '').toLowerCase().includes('narrator')

  const isFemale = /female|girl|woman/.test(d)
  const isMale   = /\bmale\b|boy|\bman\b/.test(d)
  const isChild  = /child|young_(boy|girl)|\bkid\b/.test(d)
  const isElder  = /elder|elderly|old_/.test(d)

  if (isNarratorRole)                     return d.includes('deep') ? 'ai_narrator_deep' : 'ai_narrator_warm'
  if (/villain|evil|menacing/.test(d))    return 'ai_villain'
  if (/whisper/.test(d))                  return 'ai_whisper'
  if (/robot|mechanical/.test(d))         return 'ai_robot'
  if (/creature|fantasy|magical/.test(d)) return 'ai_fantasy'
  if (/cartoon|comic/.test(d))            return 'ai_cartoon'

  if (isChild) return isFemale ? 'ai_child_female' : 'ai_child_male'
  if (isElder) return isFemale ? 'ai_elder_female' : 'ai_elder_male'

  if (isFemale) {
    if (/warm/.test(d))   return 'ai_female_warm'
    if (/bright/.test(d)) return 'ai_female_bright'
    return 'ai_female_soft'
  }
  if (isMale) {
    if (/gruff/.test(d)) return 'ai_male_gruff'
    if (/calm/.test(d))  return 'ai_male_calm'
    return 'ai_male_deep'
  }
  if (/dramatic/.test(d)) return 'ai_dramatic'

  return undefined
}
