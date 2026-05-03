'use client'
import { useState } from 'react'
import { Plus, AlignLeft, MessageSquare, Brain, Quote, Pause, Volume2 } from 'lucide-react'
import { clsx } from 'clsx'
import type { BlockType } from '@/types'

const BLOCK_OPTIONS: { type: BlockType; icon: any; label: string; desc: string; color: string }[] = [
  { type: 'narration', icon: AlignLeft,     label: 'Narration',  desc: 'Descriptive storytelling text',  color: 'text-text-secondary' },
  { type: 'dialogue',  icon: MessageSquare, label: 'Dialogue',   desc: 'A character speaks a line',      color: 'text-accent' },
  { type: 'thought',   icon: Brain,         label: 'Thought',    desc: "A character's inner monologue",  color: 'text-gold' },
  { type: 'quote',     icon: Quote,         label: 'Quote',      desc: 'Poem, verse, or letter block',   color: 'text-info' },
  { type: 'pause',     icon: Pause,         label: 'Pause',      desc: 'Dramatic silence in the audio',  color: 'text-text-muted' },
  { type: 'sfx',       icon: Volume2,       label: 'SFX',        desc: 'Trigger a sound effect',         color: 'text-success' },
]

interface AddBlockMenuProps {
  onAdd: (type: BlockType) => void
}

export function AddBlockMenu({ onAdd }: AddBlockMenuProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        className="btn-secondary w-full justify-center border-dashed text-sm"
        onClick={() => setOpen(!open)}
      >
        <Plus size={14} /> Add Story Beat
      </button>

      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-2 card-elevated py-1.5 z-20 animate-slide-up">
          <p className="text-text-muted text-[10px] uppercase tracking-wide px-3 pt-1 pb-2">Choose block type</p>
          {BLOCK_OPTIONS.map(({ type, icon: Icon, label, desc, color }) => (
            <button
              key={type}
              className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-bg-hover transition-colors"
              onClick={() => { onAdd(type); setOpen(false) }}
            >
              <Icon size={15} className={clsx(color, 'shrink-0')} />
              <div className="text-left min-w-0">
                <div className="text-text-primary text-sm font-medium">{label}</div>
                <div className="text-text-muted text-xs">{desc}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
