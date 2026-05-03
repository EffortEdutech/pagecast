'use client'
import { useState } from 'react'
import {
  AlignLeft, MessageSquare, Brain, Quote, Pause, Volume2,
  Trash2, ChevronDown, ChevronUp, GripVertical
} from 'lucide-react'
import { clsx } from 'clsx'
import type { StoryBlock, Character, DialogueBlock, NarrationBlock, ThoughtBlock, QuoteBlock, PauseBlock, SfxBlock } from '@/types'
import { AudioUploadRow } from './AudioUploadRow'

const BLOCK_META = {
  narration:  { icon: AlignLeft,      label: 'Narration',  color: 'text-text-secondary', bg: 'bg-bg-elevated' },
  dialogue:   { icon: MessageSquare,  label: 'Dialogue',   color: 'text-accent',         bg: 'bg-accent/5' },
  thought:    { icon: Brain,          label: 'Thought',    color: 'text-gold',           bg: 'bg-gold/5' },
  quote:      { icon: Quote,          label: 'Quote',      color: 'text-info',           bg: 'bg-info/5' },
  pause:      { icon: Pause,          label: 'Pause',      color: 'text-text-muted',     bg: 'bg-bg-card' },
  sfx:        { icon: Volume2,        label: 'SFX',        color: 'text-success',        bg: 'bg-success/5' },
}

const EMOTIONS = ['neutral', 'happy', 'sad', 'angry', 'scared', 'surprised', 'worried', 'excited', 'mysterious']

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

  const dialogueChar = block.type === 'dialogue'
    ? characters.find(c => c.id === (block as DialogueBlock).characterId)
    : null

  return (
    <div className={clsx('rounded-xl border border-bg-border overflow-hidden transition-all', meta.bg)}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        {/* Drag handle */}
        <div {...dragHandleProps} className="text-text-muted hover:text-text-secondary cursor-grab active:cursor-grabbing p-0.5 shrink-0">
          <GripVertical size={14} />
        </div>

        <Icon size={14} className={clsx(meta.color, 'shrink-0')} />

        <span className={clsx('text-xs font-semibold uppercase tracking-wide', meta.color)}>
          {meta.label}
        </span>

        {/* Dialogue character badge */}
        {block.type === 'dialogue' && dialogueChar && (
          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: dialogueChar.color + '25', color: dialogueChar.color }}>
            {dialogueChar.displayName}
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

      {/* Body */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2.5 border-t border-bg-border/50 pt-2.5">
          {/* Narration */}
          {block.type === 'narration' && (
            <textarea
              className="input min-h-[72px] resize-none text-sm italic"
              placeholder="Write the narration text…"
              value={(block as NarrationBlock).text}
              onChange={e => onUpdate({ text: e.target.value } as any)}
            />
          )}

          {/* Dialogue */}
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
              <textarea
                className="input min-h-[60px] resize-none text-sm"
                placeholder={`What does ${dialogueChar?.displayName ?? 'the character'} say?`}
                value={(block as DialogueBlock).text}
                onChange={e => onUpdate({ text: e.target.value } as any)}
              />
            </>
          )}

          {/* Thought */}
          {block.type === 'thought' && (
            <>
              <div>
                <label className="label">Character</label>
                <select
                  className="input"
                  value={(block as ThoughtBlock).characterId}
                  onChange={e => onUpdate({ characterId: e.target.value } as any)}
                >
                  {characters.map(c => <option key={c.id} value={c.id}>{c.displayName}</option>)}
                </select>
              </div>
              <textarea
                className="input min-h-[60px] resize-none text-sm italic"
                placeholder="Inner thought…"
                value={(block as ThoughtBlock).text}
                onChange={e => onUpdate({ text: e.target.value } as any)}
              />
            </>
          )}

          {/* Quote */}
          {block.type === 'quote' && (
            <>
              <div>
                <label className="label">Style</label>
                <select
                  className="input"
                  value={(block as QuoteBlock).style ?? 'default'}
                  onChange={e => onUpdate({ style: e.target.value } as any)}
                >
                  {['default', 'poem', 'letter', 'quran'].map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
                </select>
              </div>
              <textarea
                className="input min-h-[72px] resize-none text-sm text-center"
                placeholder="Quote / poem / verse…"
                value={(block as QuoteBlock).text}
                onChange={e => onUpdate({ text: e.target.value } as any)}
              />
              <input
                className="input text-sm"
                placeholder="Attribution (optional)"
                value={(block as QuoteBlock).attribution ?? ''}
                onChange={e => onUpdate({ attribution: e.target.value } as any)}
              />
            </>
          )}

          {/* Pause */}
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
              <input
                className="input text-sm font-mono"
                placeholder="sfx-filename.mp3"
                value={(block as SfxBlock).sfxFile}
                onChange={e => onUpdate({ sfxFile: e.target.value } as any)}
              />
            </>
          )}

          {/* Audio upload row — all block types except pause */}
          {block.type !== 'pause' && (
            <AudioUploadRow block={block} bookId={bookId} onUpdate={onUpdate} />
          )}
        </div>
      )}
    </div>
  )
}
