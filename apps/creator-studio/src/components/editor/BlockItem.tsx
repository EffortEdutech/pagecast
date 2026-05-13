'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import {
  AlignLeft, MessageSquare, Brain, Quote, Pause, Volume2,
  Trash2, ChevronDown, ChevronUp, GripVertical, Mic, ArrowUp, ArrowDown
} from 'lucide-react'
import { clsx } from 'clsx'
import type { StoryBlock, Character, DialogueBlock, NarrationBlock, ThoughtBlock, QuoteBlock, PauseBlock, SfxBlock, BlockType } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { uploadBlockAudio } from '@/lib/supabase/storage'
import { AudioUploadRow } from './AudioUploadRow'
import { SfxLibrary, type SfxSelection } from './SfxLibrary'
import { AddBlockMenu } from './AddBlockMenu'

const BLOCK_META = {
  narration:  { icon: AlignLeft,      label: 'Narration',  color: 'text-text-secondary', bg: 'bg-bg-elevated' },
  dialogue:   { icon: MessageSquare,  label: 'Dialogue',   color: 'text-accent',         bg: 'bg-accent/5' },
  thought:    { icon: Brain,          label: 'Thought',    color: 'text-gold',            bg: 'bg-gold/5' },
  quote:      { icon: Quote,          label: 'Quote',      color: 'text-info',            bg: 'bg-info/5' },
  pause:      { icon: Pause,          label: 'Pause',      color: 'text-text-muted',      bg: 'bg-bg-card' },
  sfx:        { icon: Volume2,        label: 'SFX',        color: 'text-success',         bg: 'bg-success/5' },
}

const EMOTIONS = ['neutral', 'happy', 'sad', 'angry', 'scared', 'surprised', 'worried', 'excited', 'mysterious']
const DIALOGUE_SPEED_MIN = 0.72
const DIALOGUE_SPEED_MAX = 1.08
const DIALOGUE_SPEED_DEFAULT = 0.88

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

function formatVoiceSpeed(value?: number): string {
  return `${(value ?? DIALOGUE_SPEED_DEFAULT).toFixed(2)}x`
}

// ─── Block Item ───────────────────────────────────────────────────────────────

interface BlockItemProps {
  block: StoryBlock
  bookId: string
  characters: Character[]
  onUpdate: (updates: Partial<StoryBlock>) => void
  onDelete: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  onInsertAbove?: (type: BlockType) => void | Promise<void>
  canMoveUp?: boolean
  canMoveDown?: boolean
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
}

export function BlockItem({
  block,
  bookId,
  characters,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  onInsertAbove,
  canMoveUp = false,
  canMoveDown = false,
  dragHandleProps,
}: BlockItemProps) {
  const [expanded, setExpanded] = useState(true)
  const [sfxError, setSfxError] = useState<string | null>(null)
  const meta = BLOCK_META[block.type]
  const Icon = meta.icon

  // Resolve which character this block uses for display in header
  const blockCharId = (block as any).characterId as string | undefined
  const blockChar   = blockCharId ? characters.find(c => c.id === blockCharId) : null

  // ── Resolve the effective character for this block ────────────────────────
  // For dialogue/thought: use block.characterId OR first matching character
  // (empty string '' is treated as "not set" — falsy)
  const effectiveChar = (() => {
    const id = (block as any).characterId as string | undefined
    if (id) return characters.find(c => c.id === id) ?? null

    // No explicit characterId set
    if (block.type === 'narration' || block.type === 'quote') {
      return characters.find(c => c.role === 'narrator') ?? characters[0] ?? null
    }
    if (block.type === 'dialogue' || block.type === 'thought') {
      // Use first non-narrator character (matches what the <select> visually shows)
      return characters.find(c => c.role === 'character') ?? null
    }
    return null
  })()

  // voiceId sent to TTS API
  const resolvedVoiceId: string =
    effectiveChar?.voiceId ?? 'ai_female_soft'

  // Human label shown on the badge: "Nova · Aria — Female Soft"
  // Only show for dialogue/thought if a character is actually identified
  const resolvedVoiceLabel = (() => {
    if (!effectiveChar) return undefined
    // For dialogue/thought with no explicit characterId, don't show a label —
    // the user hasn't picked a character yet so the badge would be misleading
    const id = (block as any).characterId as string | undefined
    if (!id && (block.type === 'dialogue' || block.type === 'thought')) return undefined
    return effectiveChar.voiceLabel
      ? `${effectiveChar.displayName} · ${effectiveChar.voiceLabel}`
      : effectiveChar.displayName
  })()

  const updateStoryContent = (updates: Partial<StoryBlock>) => {
    const invalidatesAudio =
      'text' in updates ||
      'characterId' in updates ||
      'emotion' in updates ||
      'style' in updates ||
      'attribution' in updates ||
      'voiceSpeed' in updates

    onUpdate({
      ...updates,
      ...(invalidatesAudio && block.audioUrl ? { audioUrl: undefined } : {}),
    } as Partial<StoryBlock>)
  }

  const handleSfxSelect = async (selection: SfxSelection) => {
    setSfxError(null)
    onUpdate({
      label: selection.label,
      sfxFile: selection.sfxFile,
      duration: selection.duration,
      audioUrl: selection.audioUrl,
    } as any)

    if (selection.audioUrl) return

    const supabase = createClient()
    const { data } = await supabase.auth.getUser()
    const userId = data.user?.id
    if (!userId) {
      setSfxError('Sign in again to save this SFX audio.')
      return
    }

    if (!selection.file) {
      setSfxError('This SFX has no audio file attached.')
      return
    }

    const audioUrl = await uploadBlockAudio(userId, bookId, block.id, selection.file)
    if (!audioUrl) {
      setSfxError('Could not upload this SFX. Try again or upload your own file.')
      return
    }

    onUpdate({
      label: selection.label,
      sfxFile: selection.sfxFile,
      duration: selection.duration,
      audioUrl,
    } as any)
  }

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
          {onInsertAbove && (
            <AddBlockMenu
              compact
              label="Insert above"
              onAdd={onInsertAbove}
              className="shrink-0"
            />
          )}
          <button
            onClick={onMoveUp}
            disabled={!canMoveUp}
            title="Move beat up"
            className="text-text-muted hover:text-accent p-0.5 transition-colors disabled:opacity-25 disabled:hover:text-text-muted"
          >
            <ArrowUp size={13} />
          </button>
          <button
            onClick={onMoveDown}
            disabled={!canMoveDown}
            title="Move beat down"
            className="text-text-muted hover:text-accent p-0.5 transition-colors disabled:opacity-25 disabled:hover:text-text-muted"
          >
            <ArrowDown size={13} />
          </button>
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
                onChange={id => updateStoryContent({ characterId: id } as any)}
                filter="all"
              />
              <AutoTextarea
                value={(block as NarrationBlock).text}
                onValueChange={v => updateStoryContent({ text: v } as any)}
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
                    onChange={e => updateStoryContent({ characterId: e.target.value } as any)}
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
                    onChange={e => updateStoryContent({ emotion: e.target.value } as any)}
                  >
                    {EMOTIONS.map(em => <option key={em} value={em}>{em}</option>)}
                  </select>
                </div>
              </div>
              <AutoTextarea
                value={(block as DialogueBlock).text}
                onValueChange={v => updateStoryContent({ text: v } as any)}
                placeholder={`What does ${blockChar?.displayName ?? 'the character'} say?`}
                minRows={2}
              />
              <div>
                <div className="flex items-center justify-between gap-3">
                  <label className="label">Dialogue pace</label>
                  <span className="text-[11px] text-text-muted font-mono">
                    {formatVoiceSpeed(block.voiceSpeed)}
                  </span>
                </div>
                <input
                  type="range"
                  min={DIALOGUE_SPEED_MIN}
                  max={DIALOGUE_SPEED_MAX}
                  step="0.01"
                  value={block.voiceSpeed ?? DIALOGUE_SPEED_DEFAULT}
                  onChange={e => updateStoryContent({ voiceSpeed: Number(e.target.value) } as any)}
                  className="w-full accent-accent"
                />
                <div className="flex justify-between text-[10px] text-text-muted">
                  <span>Slower</span>
                  <span>Natural</span>
                  <span>Quicker</span>
                </div>
              </div>
            </>
          )}

          {/* THOUGHT — character + auto textarea */}
          {block.type === 'thought' && (
            <>
              <VoiceSelect
                characters={characters}
                value={(block as ThoughtBlock).characterId ?? defaultCharacterId(characters)}
                onChange={id => updateStoryContent({ characterId: id } as any)}
                filter="all"
              />
              <AutoTextarea
                value={(block as ThoughtBlock).text}
                onValueChange={v => updateStoryContent({ text: v } as any)}
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
                    onChange={e => updateStoryContent({ style: e.target.value } as any)}
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
                    onChange={e => updateStoryContent({ characterId: e.target.value } as any)}
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
                onValueChange={v => updateStoryContent({ text: v } as any)}
                placeholder="Quote / poem / verse…"
                className="text-center"
                minRows={2}
              />
              <input
                className="input text-sm"
                placeholder="Attribution (optional)"
                value={(block as QuoteBlock).attribution ?? ''}
                onChange={e => updateStoryContent({ attribution: e.target.value } as any)}
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
                bookId={bookId}
                currentLabel={(block as SfxBlock).label ?? ''}
                onSelect={handleSfxSelect}
              />
              {sfxError && <p className="text-[11px] text-danger">{sfxError}</p>}
            </>
          )}

          {/* Audio row — all types except pause */}
          {block.type !== 'pause' && (
            <AudioUploadRow
              block={block}
              bookId={bookId}
              onUpdate={onUpdate}
              voiceId={resolvedVoiceId}
              voiceLabel={resolvedVoiceLabel}
            />
          )}

        </div>
      )}
    </div>
  )
}
