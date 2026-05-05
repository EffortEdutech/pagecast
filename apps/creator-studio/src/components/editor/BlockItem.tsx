'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import {
  AlignLeft, MessageSquare, Brain, Quote, Pause, Volume2,
  Trash2, ChevronDown, ChevronUp, GripVertical, Mic
} from 'lucide-react'
import { clsx } from 'clsx'
import type { StoryBlock, Character, DialogueBlock, NarrationBlock, ThoughtBlock, QuoteBlock, PauseBlock, SfxBlock } from '@/types'
import { AudioUploadRow } from './AudioUploadRow'
import { SfxLibrary } from './SfxLibrary'

const BLOCK_META = {
  narration:  { icon: AlignLeft,      label: 'Narration',  color: 'text-text-secondary', bg: 'bg-bg-elevated' },
  dialogue:   { icon: MessageSquare,  label: 'Dialogue',   color: 'text-accent',         bg: 'bg-accent/5' },
  thought:    { icon: Brain,          label: 'Thought',    color: 'text-gold',            bg: 'bg-gold/5' },
  quote:      { icon: Quote,          label: 'Quote',      color: 'text-info',            bg: 'bg-info/5' },
  pause:      { icon: Pause,          label: 'Pause',      color: 'text-text-muted',      bg: 'bg-bg-card' },
  sfx:        { icon: Volume2,        label: 'SFX',        color: 'text-success',         bg: 'bg-success/5' },
}

const EMOTIONS = ['neutral', 'happy', 'sad', 'angry', 'scared', 'surprised', 'worried', 'excited', 'mysterious']

// ─── Auto-expanding textarea ──────────────────────────────────────────────────

interface AutoTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string
  onValueChange: (v: string) => void
  minRows?: number
}

function AutoTextarea({ value, onValueChange, minRows = 2, className, ...rest }: AutoTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  const resize = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [])

  useEffect(() => { resize() }, [value, resize])

  return (
    <textarea
      ref={ref}
      rows={minRows}
      className={clsx('input resize-none overflow-hidden text-sm leading-relaxed', className)}
      value={value}
      onChange={e => { onValueChange(e.target.value); resize() }}
      {...rest}
    />
  )
}

// ─── Voice selector ───────────────────────────────────────────────────────────

function VoiceSelect({
  characters,
  value,
  onChange,
  filter,
}: {
  characters: Character[]
  value: string
  onChange: (id: string) => void
  filter?: 'all' | 'narrator' | 'character'
}) {
  const list = filter && filter !== 'all'
    ? characters.filter(c => c.role === filter)
    : characters

  return (
    <div>
      <label className="label flex items-center gap-1">
        <Mic size={10} className="text-text-muted" /> Voice
      </label>
      <select className="input" value={value} onChange={e => onChange(e.target.value)}>
        {list.map(c => (
          <option key={c.id} value={c.id}>
            {c.displayName}{c.voiceLabel ? ` — ${c.voiceLabel}` : ''}
          </option>
        ))}
      </select>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function defaultNarratorId(characters: Character[]): string {
  return characters.find(c => c.role === 'narrator')?.id ?? characters[0]?.id ?? ''
}

function defaultCharacterId(characters: Character[]): string {
  return characters.find(c => c.role === 'character')?.id ?? characters[0]?.id ?? ''
}

// ─── Block Item ───────────────────────────────────────────────────────────────

interface BlockItemProps {
  block: StoryBlock
  bookId: string
  characters: Character[]
  onUpdate: (updates: Partial<StoryBlock>) => void
  onDelete: () => void
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
}

export function BlockItem({ block, bookId, characters, onUpdate, onDelete, dragHandleProps }: BlockItemProps) {
  const [expanded, setExpanded] = useState(true)
  const meta = BLOCK_META[block.type]
  const Icon = meta.icon

  // Resolve which character this block uses for display in header
  const blockCharId = (block as any).characterId as string | undefined
  const blockChar   = blockCharId ? characters.find(c => c.id === blockCharId) : null

  // Resolve voice for AudioUploadRow
  const resolvedVoiceId = (() => {
    const id = (block as any).characterId as string | undefined
    if (id) return characters.find(c => c.id === id)?.voiceId
    // fallback: narrator for narration/quote, first character for dialogue/thought
    if (block.type === 'narration' || block.type === 'quote') {
      return characters.find(c => c.role === 'narrator')?.voiceId ?? 'ai_female_soft'
    }
    return characters[0]?.voiceId ?? 'ai_female_soft'
  })()

  return (
    <div className={clsx('rounded-xl border border-bg-border overflow-hidden transition-all', meta.bg)}>

      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div {...dragHandleProps} className="text-text-muted hover:text-text-secondary cursor-grab active:cursor-grabbing p-0.5 shrink-0">
          <GripVertical size={14} />
        </div>

        <Icon size={14} className={clsx(meta.color, 'shrink-0')} />
        <span className={clsx('text-xs font-semibold uppercase tracking-wide', meta.color)}>
          {meta.label}
        </span>

        {/* Character badge — show for blocks that have a character assigned */}
        {blockChar && (
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
            style={{ backgroundColor: blockChar.color + '25', color: blockChar.color }}
          >
            {blockChar.displayName}
          </span>
        )}

        <div className="flex items-center gap-1 ml-auto">
          <button onClick={() => setExpanded(!expanded)} className="text-text-muted hover:text-text-secondary p-0.5">
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          <button onClick={onDelete} className="text-text-muted hover:text-danger p-0.5 transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2.5 border-t border-bg-border/50 pt-2.5">

          {/* NARRATION — voice selector + auto textarea */}
          {block.type === 'narration' && (
            <>
              <VoiceSelect
                characters={characters}
                value={(block as NarrationBlock).characterId ?? defaultNarratorId(characters)}
                onChange={id => onUpdate({ characterId: id } as any)}
                filter="all"
              />
              <AutoTextarea
                value={(block as NarrationBlock).text}
                onValueChange={v => onUpdate({ text: v } as any)}
                placeholder="Write the narration text…"
                className="italic"
                minRows={2}
              />
            </>
          )}

          {/* DIALOGUE — character + emotion + auto textarea */}
          {block.type === 'dialogue' && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">Character</label>
                  <select
                    className="input"
                    value={(block as DialogueBlock).characterId}
                    onChange={e => onUpdate({ characterId: e.target.value } as any)}
                  >
                    {characters.filter(c => c.role === 'character').map(c => (
                      <option key={c.id} value={c.id}>{c.displayName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Emotion</label>
                  <select
                    className="input"
                    value={(block as DialogueBlock).emotion ?? 'neutral'}
                    onChange={e => onUpdate({ emotion: e.target.value } as any)}
                  >
                    {EMOTIONS.map(em => <option key={em} value={em}>{em}</option>)}
                  </select>
                </div>
              </div>
              <AutoTextarea
                value={(block as DialogueBlock).text}
                onValueChange={v => onUpdate({ text: v } as any)}
                placeholder={`What does ${blockChar?.displayName ?? 'the character'} say?`}
                minRows={2}
              />
            </>
          )}

          {/* THOUGHT — character + auto textarea */}
          {block.type === 'thought' && (
            <>
              <VoiceSelect
                characters={characters}
                value={(block as ThoughtBlock).characterId ?? defaultCharacterId(characters)}
                onChange={id => onUpdate({ characterId: id } as any)}
                filter="all"
              />
              <AutoTextarea
                value={(block as ThoughtBlock).text}
                onValueChange={v => onUpdate({ text: v } as any)}
                placeholder="Inner thought…"
                className="italic"
                minRows={2}
              />
            </>
          )}

          {/* QUOTE — style + voice + auto textarea + attribution */}
          {block.type === 'quote' && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">Style</label>
                  <select
                    className="input"
                    value={(block as QuoteBlock).style ?? 'default'}
                    onChange={e => onUpdate({ style: e.target.value } as any)}
                  >
                    {['default', 'poem', 'letter', 'quran'].map(s => (
                      <option key={s} value={s} className="capitalize">{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label flex items-center gap-1">
                    <Mic size={10} className="text-text-muted" /> Voice
                  </label>
                  <select
                    className="input"
                    value={(block as QuoteBlock).characterId ?? defaultNarratorId(characters)}
                    onChange={e => onUpdate({ characterId: e.target.value } as any)}
                  >
                    {characters.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.displayName}{c.voiceLabel ? ` — ${c.voiceLabel}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <AutoTextarea
                value={(block as QuoteBlock).text}
                onValueChange={v => onUpdate({ text: v } as any)}
                placeholder="Quote / poem / verse…"
                className="text-center"
                minRows={2}
              />
              <input
                className="input text-sm"
                placeholder="Attribution (optional)"
                value={(block as QuoteBlock).attribution ?? ''}
                onChange={e => onUpdate({ attribution: e.target.value } as any)}
              />
            </>
          )}

          {/* PAUSE */}
          {block.type === 'pause' && (
            <div>
              <label className="label">Duration (seconds)</label>
              <div className="flex items-center gap-3">
                <input
                  type="range" min="0.5" max="10" step="0.5"
                  value={(block as PauseBlock).duration}
                  onChange={e => onUpdate({ duration: parseFloat(e.target.value) } as any)}
                  className="flex-1 accent-accent"
                />
                <span className="text-text-primary text-sm font-mono w-10 text-right">
                  {(block as PauseBlock).duration}s
                </span>
              </div>
            </div>
          )}

          {/* SFX */}
          {block.type === 'sfx' && (
            <>
              <input
                className="input text-sm"
                placeholder="SFX label (e.g. Branch snap)"
                value={(block as SfxBlock).label ?? ''}
                onChange={e => onUpdate({ label: e.target.value } as any)}
              />
              <SfxLibrary
                currentLabel={(block as SfxBlock).label ?? ''}
                onSelect={label => onUpdate({ label, sfxFile: label.toLowerCase().replace(/\s+/g, '-') + '.mp3' } as any)}
              />
            </>
          )}

          {/* Audio row — all types except pause */}
          {block.type !== 'pause' && (
            <AudioUploadRow
              block={block}
              bookId={bookId}
              onUpdate={onUpdate}
              voiceId={resolvedVoiceId}
            />
          )}

        </div>
      )}
    </div>
  )
}
