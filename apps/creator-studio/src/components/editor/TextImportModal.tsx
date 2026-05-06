'use client'
import { useState, useRef, useCallback } from 'react'
import {
  X, Upload, FileText, Wand2, AlertCircle, Check,
  ChevronRight, BookOpen, Film, AlignLeft, MessageSquare,
  Brain, Quote, Pause, Volume2, Loader2, Info, FileUp
} from 'lucide-react'
import { clsx } from 'clsx'
import { parseText, type ParseFormat, type ParsedImport, type ParsedChapter } from '@/lib/textParser'
import type { StoryBlock } from '@/types'

// ── PDF extraction (pdfjs-dist, browser-side) ─────────────────────────────────

async function extractPdfText(file: File): Promise<{ text: string; pages: number }> {
  // Dynamic import to avoid SSR issues
  const pdfjs = await import('pdfjs-dist')
  // Use unpkg CDN for the worker — avoids Next.js bundler complexity
  pdfjs.GlobalWorkerOptions.workerSrc =
    `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

  const arrayBuffer = await file.arrayBuffer()
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) })
  const pdf = await loadingTask.promise

  const pageParts: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items
      .filter((item: any) => 'str' in item)
      .map((item: any) => (item.str as string))
      .join(' ')
    if (pageText.trim()) pageParts.push(pageText.trim())
  }

  return { text: pageParts.join('\n\n'), pages: pdf.numPages }
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
}

function BlockPreviewRow({ block }: { block: StoryBlock }) {
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
    </div>
  )
}

function ChapterPreview({ chapter, idx }: { chapter: ParsedChapter; idx: number }) {
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
                {scene.blocks.slice(0, 5).map((block, bi) => (
                  <BlockPreviewRow key={bi} block={block} />
                ))}
                {scene.blocks.length > 5 && (
                  <p className="text-[10px] text-text-muted px-2 py-1">
                    + {scene.blocks.length - 5} more blocks…
                  </p>
                )}
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
  onImport: (result: ParsedImport) => Promise<void>
  onClose:  () => void
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

export function TextImportModal({ onImport, onClose }: TextImportModalProps) {
  const fileRef = useRef<HTMLInputElement>(null)

  const [text,        setText]        = useState('')
  const [format,      setFormat]      = useState<ParseFormat>('auto')
  const [parsed,      setParsed]      = useState<ParsedImport | null>(null)
  const [importing,   setImporting]   = useState(false)
  const [extracting,  setExtracting]  = useState(false)
  const [pdfPages,    setPdfPages]    = useState<number | null>(null)
  const [error,       setError]       = useState<string | null>(null)
  const [importDone,  setImportDone]  = useState(false)

  const handleParse = useCallback(() => {
    if (!text.trim()) return
    setError(null)
    try {
      const result = parseText(text, format)
      setParsed(result)
    } catch (e: any) {
      setError('Parse error: ' + e.message)
    }
  }, [text, format])

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
          setText(extracted)
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
      setText(content)
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    if (!parsed) return
    setImporting(true)
    setError(null)
    try {
      await onImport(parsed)
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
      <div className="card-elevated w-full max-w-3xl max-h-[90vh] flex flex-col animate-slide-up mx-4">

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

            <div className="px-4 py-3 border-t border-bg-border shrink-0">
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
                    Supports .pdf, .txt, .md, novel prose, screenplay, and markdown
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
                    <ChapterPreview key={i} chapter={ch} idx={i} />
                  ))}
                </div>
              </>
            )}

            {error && (
              <div className="m-4 flex items-start gap-2 px-3 py-2 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs">
                <AlertCircle size={13} className="shrink-0 mt-0.5" /> {error}
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
