'use client'
import { useState, useRef, useCallback } from 'react'
import {
  X, Upload, FileText, Wand2, AlertCircle, Check,
  ChevronRight, BookOpen, Film, AlignLeft, MessageSquare,
  Brain, Quote, Pause, Volume2, Loader2, Info, FileUp,
  ArrowUp, ArrowDown
} from 'lucide-react'
import { clsx } from 'clsx'
import { parseText, formatParsedImportAsPageCastText, normalizeImportedText, type ParseFormat, type ParsedImport, type ParsedChapter } from '@/lib/textParser'
import type { StoryBlock } from '@/types'

export type ImportDestination =
  | { mode: 'new-chapter' }
  | { mode: 'current-beat'; chapterId: string; sceneId: string; insertIndex: number }

// ── PDF extraction (pdfjs-dist, browser-side) ─────────────────────────────────

async function extractPdfText(file: File): Promise<{ text: string; pages: number }> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch('/api/pdf/extract', { method: 'POST', body: form })
  const body = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new Error(body.error ?? 'Could not extract text from this PDF.')
  }

  return { text: String(body.text ?? ''), pages: Number(body.pages ?? 0) }

}

// ── Block type display ────────────────────────────────────────────────────────

const BLOCK_DISPLAY = {
  narration: { icon: AlignLeft,     color: 'text-text-secondary', bg: 'bg-bg-elevated',  label: 'Narration' },
  dialogue:  { icon: MessageSquare, color: 'text-accent',         bg: 'bg-accent/10',    label: 'Dialogue'  },
  thought:   { icon: Brain,         color: 'text-gold',           bg: 'bg-gold/10',      label: 'Thought'   },
  quote:     { icon: Quote,         color: 'text-info',           bg: 'bg-info/10',      label: 'Quote'     },
  pause:     { icon: Pause,         color: 'text-text-muted',     bg: 'bg-bg-card',      label: 'Pause'     },
  sfx:       { icon: Volume2,       color: 'text-success',        bg: 'bg-success/10',   label: 'SFX'       },
}

const FORMAT_LABELS: Record<string, string> = {
  prose:    'Novel / Prose',
  script:   'Script / Screenplay',
  markdown: 'Markdown',
  pagecast: 'PageCast Format',
}

function BlockPreviewRow({
  block,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
}: {
  block: StoryBlock
  canMoveUp: boolean
  canMoveDown: boolean
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const d = BLOCK_DISPLAY[block.type]
  const Icon = d.icon
  const previewText = 'text' in block
    ? String((block as any).text).slice(0, 80) + (String((block as any).text).length > 80 ? '…' : '')
    : block.type === 'pause'
      ? `${(block as any).duration}s`
      : (block as any).label ?? ''

  return (
    <div className={clsx('flex items-start gap-2 px-2 py-1.5 rounded-lg', d.bg)}>
      <Icon size={11} className={clsx('mt-0.5 shrink-0', d.color)} />
      <div className="flex-1 min-w-0">
        <span className={clsx('text-[10px] font-semibold uppercase tracking-wide mr-2', d.color)}>
          {d.label}
        </span>
        {block.type === 'dialogue' && (
          <span className="text-[10px] text-text-muted italic mr-1">[assign character]</span>
        )}
        <span className="text-text-secondary text-xs truncate">{previewText}</span>
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={!canMoveUp}
          title="Move beat up"
          className="p-0.5 text-text-muted hover:text-accent disabled:opacity-25 disabled:hover:text-text-muted"
        >
          <ArrowUp size={11} />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={!canMoveDown}
          title="Move beat down"
          className="p-0.5 text-text-muted hover:text-accent disabled:opacity-25 disabled:hover:text-text-muted"
        >
          <ArrowDown size={11} />
        </button>
      </div>
    </div>
  )
}

function ChapterPreview({
  chapter,
  idx,
  onMoveBlock,
}: {
  chapter: ParsedChapter
  idx: number
  onMoveBlock: (sceneIndex: number, blockIndex: number, direction: -1 | 1) => void
}) {
  const [expanded, setExpanded] = useState(idx === 0)
  const totalBlocks = chapter.scenes.reduce((n, s) => n + s.blocks.length, 0)

  return (
    <div className="rounded-xl border border-bg-border overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-2 w-full px-3 py-2 bg-bg-elevated hover:bg-bg-hover transition-colors text-left"
      >
        <BookOpen size={12} className="text-accent shrink-0" />
        <span className="text-text-primary text-xs font-semibold flex-1 truncate">{chapter.title}</span>
        <span className="text-text-muted text-[10px] shrink-0">
          {chapter.scenes.length} scene{chapter.scenes.length !== 1 ? 's' : ''} · {totalBlocks} blocks
        </span>
        <ChevronRight size={11} className={clsx('text-text-muted shrink-0 transition-transform', expanded && 'rotate-90')} />
      </button>

      {expanded && (
        <div className="p-2 space-y-2 bg-bg-primary">
          {chapter.scenes.map((scene, si) => (
            <div key={si} className="pl-2 border-l border-bg-border space-y-1">
              <div className="flex items-center gap-1.5 py-1">
                <Film size={10} className="text-text-muted shrink-0" />
                <span className="text-text-secondary text-[11px] font-medium">{scene.title}</span>
                <span className="text-text-muted text-[10px] ml-auto">{scene.blocks.length} blocks</span>
              </div>
              <div className="space-y-0.5 pl-1">
                {scene.blocks.map((block, bi) => (
                  <BlockPreviewRow
                    key={block.id}
                    block={block}
                    canMoveUp={bi > 0}
                    canMoveDown={bi < scene.blocks.length - 1}
                    onMoveUp={() => onMoveBlock(si, bi, -1)}
                    onMoveDown={() => onMoveBlock(si, bi, 1)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────

interface TextImportModalProps {
  onImport: (result: ParsedImport, destination: ImportDestination) => Promise<void>
  onClose:  () => void
  activeChapterTitle?: string
  activeSceneTitle?: string
  activeChapterId?: string | null
  activeSceneId?: string | null
  activeBeatCount?: number
  canInsertAtActiveBeat?: boolean
}

const PLACEHOLDER = `# Chapter 1: The Beginning

The old house stood at the edge of town, silent and watchful.

"Who's there?" Aisha called out, her voice trembling.

She stepped forward, heart pounding.

*Maybe this was a mistake*, she thought.

[SFX: Door creak]

> "Whoever fights monsters should see to it that in the process he does not become a monster."
> — Friedrich Nietzsche

[pause: 2s]

## Scene 2: Inside

NARRATOR: The night grew darker still.`

export function TextImportModal({
  onImport,
  onClose,
  activeChapterTitle,
  activeSceneTitle,
  activeChapterId,
  activeSceneId,
  activeBeatCount = 0,
  canInsertAtActiveBeat = false,
}: TextImportModalProps) {
  const fileRef = useRef<HTMLInputElement>(null)

  const [text,        setText]        = useState('')
  const [format,      setFormat]      = useState<ParseFormat>('auto')
  const [parsed,      setParsed]      = useState<ParsedImport | null>(null)
  const [importing,   setImporting]   = useState(false)
  const [extracting,  setExtracting]  = useState(false)
  const [pdfPages,    setPdfPages]    = useState<number | null>(null)
  const [error,       setError]       = useState<string | null>(null)
  const [importDone,  setImportDone]  = useState(false)
  const [showDestination, setShowDestination] = useState(false)
  const [destinationMode, setDestinationMode] = useState<'new-chapter' | 'current-beat'>(
    canInsertAtActiveBeat ? 'current-beat' : 'new-chapter'
  )
  const [insertPosition, setInsertPosition] = useState('end')

  const handleParse = useCallback(() => {
    if (!text.trim()) return
    setError(null)
    setShowDestination(false)
    try {
      const result = parseText(text, format)
      setParsed(result)
    } catch (e: any) {
      setError('Parse error: ' + e.message)
    }
  }, [text, format])

  const handleArrange = useCallback(() => {
    if (!text.trim()) return
    setError(null)
    setShowDestination(false)
    try {
      const firstPass = parseText(text, format === 'pagecast' ? 'auto' : format)
      const arranged = formatParsedImportAsPageCastText(firstPass)
      const arrangedResult = parseText(arranged, 'pagecast')
      setText(arranged)
      setFormat('pagecast')
      setParsed(arrangedResult)
    } catch (e: any) {
      setError('Arrange error: ' + e.message)
    }
  }, [text, format])

  const handleCleanText = useCallback(() => {
    if (!text.trim()) return
    setError(null)
    setText(normalizeImportedText(text))
    setParsed(null)
  }, [text])

  const moveParsedBlock = useCallback((chapterIndex: number, sceneIndex: number, blockIndex: number, direction: -1 | 1) => {
    setParsed(prev => {
      if (!prev) return prev
      const chapters = prev.chapters.map((chapter, ci) => {
        if (ci !== chapterIndex) return chapter
        return {
          ...chapter,
          scenes: chapter.scenes.map((scene, si) => {
            if (si !== sceneIndex) return scene
            const nextIndex = blockIndex + direction
            if (nextIndex < 0 || nextIndex >= scene.blocks.length) return scene
            const blocks = [...scene.blocks]
            const [moved] = blocks.splice(blockIndex, 1)
            blocks.splice(nextIndex, 0, moved)
            return { ...scene, blocks }
          }),
        }
      })
      return { ...prev, chapters }
    })
  }, [])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (fileRef.current) fileRef.current.value = ''
    setError(null)
    setParsed(null)
    setPdfPages(null)

    // ── PDF: extract text with pdfjs-dist ──
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      setExtracting(true)
      try {
        const { text: extracted, pages } = await extractPdfText(file)
        if (!extracted.trim()) {
          setError('Could not extract text from this PDF. It may be a scanned image. Try exporting as .txt first.')
        } else {
          setText(normalizeImportedText(extracted))
          setPdfPages(pages)
        }
      } catch (err: any) {
        setError('PDF extraction failed: ' + (err?.message ?? 'unknown error'))
      } finally {
        setExtracting(false)
      }
      return
    }

    // ── .txt / .md / .fountain: read as plain text ──
    const reader = new FileReader()
    reader.onload = ev => {
      const content = ev.target?.result as string
      setText(normalizeImportedText(content))
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    if (!parsed) return
    if (!showDestination) {
      setShowDestination(true)
      return
    }
    setImporting(true)
    setError(null)
    try {
      const canUseActiveDestination = destinationMode === 'current-beat' && canInsertAtActiveBeat && activeChapterId && activeSceneId
      const destination: ImportDestination = canUseActiveDestination
        ? {
            mode: 'current-beat',
            chapterId: activeChapterId ?? '',
            sceneId: activeSceneId ?? '',
            insertIndex: insertPosition === 'start'
              ? 0
              : insertPosition === 'end'
                ? activeBeatCount
                : Number(insertPosition),
          }
        : { mode: 'new-chapter' }
      await onImport(parsed, destination)
      setImportDone(true)
      setTimeout(onClose, 1200)
    } catch (e: any) {
      setError('Import failed: ' + e.message)
    }
    setImporting(false)
  }

  const handleFormatChange = (f: ParseFormat) => {
    setFormat(f)
    if (text.trim()) {
      try { setParsed(parseText(text, f)) } catch {}
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="card-elevated w-full max-w-6xl max-h-[90vh] flex flex-col animate-slide-up mx-4">

        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-bg-border shrink-0">
          <FileText size={18} className="text-accent" />
          <div className="flex-1">
            <h2 className="text-text-primary font-bold text-base">Import Text</h2>
            <p className="text-text-muted text-xs mt-0.5">
              Paste your story or upload a .txt, .md, .fountain, or .pdf file.
            </p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-secondary transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">

          {/* ── Left: Input ── */}
          <div className="w-1/2 flex flex-col border-r border-bg-border">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-bg-border shrink-0 flex-wrap">
              <select
                className="input text-xs py-1 flex-1 min-w-0"
                value={format}
                onChange={e => handleFormatChange(e.target.value as ParseFormat)}
              >
                <option value="auto">Auto-detect format</option>
                <option value="prose">Novel / Prose</option>
                <option value="script">Script / Screenplay</option>
                <option value="markdown">Markdown</option>
                <option value="pagecast">PageCast Format</option>
              </select>

              <input ref={fileRef} type="file" accept=".txt,.md,.fountain,.pdf" className="hidden" onChange={handleFileUpload} />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={extracting}
                className="btn-ghost text-xs px-2 py-1 border border-bg-border hover:border-accent/40 shrink-0 disabled:opacity-50"
              >
                {extracting
                  ? <><Loader2 size={11} className="animate-spin" /> Extracting…</>
                  : <><Upload size={11} /> Upload file</>
                }
              </button>
            </div>

            <div className="flex-1 relative overflow-hidden">
              {extracting && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-bg-primary/80 backdrop-blur-sm gap-3">
                  <Loader2 size={24} className="text-accent animate-spin" />
                  <p className="text-text-secondary text-xs">Extracting text from PDF…</p>
                  <p className="text-text-muted text-[10px]">This may take a moment for large files</p>
                </div>
              )}
              <textarea
                className="w-full h-full resize-none bg-transparent text-text-secondary text-xs leading-relaxed p-4 focus:outline-none font-mono"
                placeholder={PLACEHOLDER}
                value={text}
                onChange={e => { setText(e.target.value); setParsed(null); setPdfPages(null) }}
                spellCheck={false}
                disabled={extracting}
              />
              {pdfPages !== null && (
                <div className="absolute bottom-2 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/10 border border-accent/20">
                  <FileUp size={9} className="text-accent" />
                  <span className="text-[9px] text-accent font-medium">{pdfPages}-page PDF extracted</span>
                </div>
              )}
            </div>

            <div className="px-4 py-3 border-t border-bg-border shrink-0 space-y-2">
              <button
                onClick={handleCleanText}
                disabled={!text.trim() || extracting}
                className="btn-ghost w-full justify-center text-sm border border-bg-border hover:border-accent/40 disabled:opacity-40"
                title="Clean PDF/text export spacing before arranging or parsing"
              >
                <AlignLeft size={14} /> Clean pasted text
              </button>
              <button
                onClick={handleArrange}
                disabled={!text.trim() || extracting}
                className="btn-secondary w-full justify-center text-sm disabled:opacity-40"
                title="Convert raw text into editable PageCast beat tags before importing"
              >
                <FileText size={14} /> Arrange to PageCast format
              </button>
              <button
                onClick={handleParse}
                disabled={!text.trim() || extracting}
                className="btn-primary w-full justify-center text-sm disabled:opacity-40"
              >
                <Wand2 size={14} /> Parse Text
              </button>
            </div>
          </div>

          {/* ── Right: Preview ── */}
          <div className="w-1/2 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-bg-border shrink-0">
              <span className="text-text-muted text-[10px] font-semibold uppercase tracking-wide">
                Preview
              </span>
            </div>

            {!parsed && !error && (
              <div className="flex-1 flex items-center justify-center p-6 text-center">
                <div className="space-y-2">
                  <Wand2 size={28} className="text-text-muted mx-auto" />
                  <p className="text-text-secondary text-sm">Paste your text and click Parse</p>
                  <p className="text-text-muted text-xs">
                    Supports .pdf, .txt, .md, PageCast tags, novel prose, screenplay, and markdown
                  </p>
                </div>
              </div>
            )}

            {parsed && (
              <>
                <div className="flex items-center gap-3 px-4 py-2.5 bg-bg-elevated border-b border-bg-border shrink-0 flex-wrap gap-y-1">
                  <span className="text-[10px] font-medium text-text-secondary">
                    Detected: <span className="text-accent">{FORMAT_LABELS[parsed.format] ?? parsed.format}</span>
                  </span>
                  <div className="flex items-center gap-2 ml-auto flex-wrap gap-y-1">
                    {[
                      { label: 'Chapters', val: parsed.stats.chapters },
                      { label: 'Scenes',   val: parsed.stats.scenes   },
                      { label: 'Blocks',   val: parsed.stats.blocks   },
                    ].map(s => (
                      <span key={s.label} className="text-[10px] px-2 py-0.5 rounded-full bg-bg-card border border-bg-border text-text-muted">
                        <span className="text-text-primary font-semibold">{s.val}</span> {s.label}
                      </span>
                    ))}
                  </div>
                </div>

                {parsed.stats.dialogues > 0 && (
                  <div className="flex items-start gap-2 px-4 py-2 bg-accent/5 border-b border-accent/20 shrink-0">
                    <Info size={11} className="text-accent mt-0.5 shrink-0" />
                    <p className="text-[10px] text-text-secondary leading-relaxed">
                      <span className="text-accent font-medium">{parsed.stats.dialogues} dialogue</span> block{parsed.stats.dialogues !== 1 ? 's' : ''} detected.
                      Assign characters in the editor after import.
                    </p>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {parsed.chapters.map((ch, i) => (
                    <ChapterPreview
                      key={i}
                      chapter={ch}
                      idx={i}
                      onMoveBlock={(sceneIndex, blockIndex, direction) => moveParsedBlock(i, sceneIndex, blockIndex, direction)}
                    />
                  ))}
                </div>
              </>
            )}

            {error && (
              <div className="m-4 flex items-start gap-2 px-3 py-2 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs">
                <AlertCircle size={13} className="shrink-0 mt-0.5" /> {error}
              </div>
            )}

            {parsed && showDestination && (
              <div className="mx-4 mb-4 p-3 rounded-xl bg-bg-elevated border border-bg-border space-y-3">
                <div>
                  <p className="text-text-primary text-xs font-semibold">Import destination</p>
                  <p className="text-text-muted text-[11px] mt-0.5">Choose where the parsed text should be inserted.</p>
                </div>
                <label className="flex items-start gap-2 text-xs text-text-secondary cursor-pointer">
                  <input
                    type="radio"
                    className="mt-0.5"
                    checked={destinationMode === 'new-chapter'}
                    onChange={() => setDestinationMode('new-chapter')}
                  />
                  <span>
                    <span className="text-text-primary font-medium">Create new chapter(s)</span>
                    <span className="block text-text-muted text-[11px]">Import each parsed chapter at the end of the book.</span>
                  </span>
                </label>
                <label className={clsx('flex items-start gap-2 text-xs cursor-pointer', canInsertAtActiveBeat ? 'text-text-secondary' : 'text-text-muted opacity-60')}>
                  <input
                    type="radio"
                    className="mt-0.5"
                    checked={destinationMode === 'current-beat'}
                    onChange={() => setDestinationMode('current-beat')}
                    disabled={!canInsertAtActiveBeat}
                  />
                  <span>
                    <span className="text-text-primary font-medium">Insert into active scene</span>
                    <span className="block text-text-muted text-[11px]">
                      {canInsertAtActiveBeat
                        ? `${activeChapterTitle ?? 'Active chapter'} / ${activeSceneTitle ?? 'Active scene'}`
                        : 'Select a chapter and scene first.'}
                    </span>
                  </span>
                </label>
                {destinationMode === 'current-beat' && canInsertAtActiveBeat && (
                  <select className="input text-xs" value={insertPosition} onChange={e => setInsertPosition(e.target.value)}>
                    <option value="start">At beginning of active scene</option>
                    <option value="end">At end of active scene</option>
                    {Array.from({ length: activeBeatCount }, (_, idx) => (
                      <option key={idx} value={idx}>Before beat {idx + 1}</option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-bg-border shrink-0">
          <p className="text-text-muted text-xs">
            {parsed
              ? `Ready to import ${parsed.stats.chapters} chapter${parsed.stats.chapters !== 1 ? 's' : ''} into your book`
              : 'Paste text or upload a .txt / .pdf file to begin'
            }
          </p>
          <div className="flex items-center gap-2">
            <button className="btn-secondary text-sm" onClick={onClose} disabled={importing}>Cancel</button>
            <button
              className={clsx('btn-primary text-sm min-w-28 justify-center', importDone && 'bg-success/80')}
              onClick={handleImport}
              disabled={!parsed || importing || importDone}
            >
              {importDone ? (
                <><Check size={14} /> Imported!</>
              ) : importing ? (
                <><Loader2 size={14} className="animate-spin" /> Importing…</>
              ) : showDestination ? (
                'Confirm import'
              ) : (
                'Import into book'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
