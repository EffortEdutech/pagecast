'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { Plus, AlignLeft, MessageSquare, Brain, Quote, Pause, Volume2 } from 'lucide-react'
import { clsx } from 'clsx'
import type { BlockType } from '@/types'

const BLOCK_OPTIONS: { type: BlockType; icon: any; label: string; desc: string; color: string }[] = [
  { type: 'narration', icon: AlignLeft,     label: 'Narration',  desc: 'Descriptive storytelling text',  color: 'text-text-secondary' },
  { type: 'dialogue',  icon: MessageSquare, label: 'Dialogue',   desc: 'A character speaks a line',      color: 'text-accent' },
  { type: 'thought',   icon: Brain,         label: 'Thought',    desc: "A character's inner monologue",  color: 'text-gold' },
  { type: 'quote',     icon: Quote,         label: 'Quote',      desc: 'Poem, verse, or letter block',   color: 'text-info' },
  { type: 'pause',     icon: Pause,         label: 'Pause',      desc: 'Dramatic silence in the audio',  color: 'text-text-muted' },
  { type: 'sfx',       icon: Volume2,       label: 'SFX',        desc: 'Trigger a sound effect (beat)',  color: 'text-success' },
]

interface AddBlockMenuProps {
  onAdd: (type: BlockType) => void
}

export function AddBlockMenu({ onAdd }: AddBlockMenuProps) {
  const [open, setOpen]   = useState(false)
  const [pos,  setPos]    = useState<{ top: number; left: number; width: number } | null>(null)
  const btnRef            = useRef<HTMLButtonElement>(null)

  const openMenu = useCallback(() => {
    if (!btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    // Place the menu ABOVE the button; if too close to top, place below
    const menuHeight = BLOCK_OPTIONS.length * 52 + 36 // approx height
    const spaceAbove = rect.top
    const placeAbove = spaceAbove > menuHeight + 8

    setPos({
      top:   placeAbove ? rect.top - menuHeight - 8 : rect.bottom + 8,
      left:  rect.left,
      width: rect.width,
    })
    setOpen(true)
  }, [])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Recalculate on scroll/resize
  useEffect(() => {
    if (!open) return
    const update = () => {
      if (!btnRef.current) return
      const rect = btnRef.current.getBoundingClientRect()
      const menuHeight = BLOCK_OPTIONS.length * 52 + 36
      const placeAbove = rect.top > menuHeight + 8
      setPos({ top: placeAbove ? rect.top - menuHeight - 8 : rect.bottom + 8, left: rect.left, width: rect.width })
    }
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => { window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update) }
  }, [open])

  return (
    <>
      <button
        ref={btnRef}
        className="btn-secondary w-full justify-center border-dashed text-sm"
        onClick={() => open ? setOpen(false) : openMenu()}
      >
        <Plus size={14} /> Add Story Beat
      </button>

      {open && pos && (
        <div
          className="fixed card-elevated py-1.5 z-[200] animate-slide-up shadow-elevated"
          style={{ top: pos.top, left: pos.left, width: pos.width }}
        >
          <p className="text-text-muted text-[10px] uppercase tracking-wide px-3 pt-1 pb-2">
            Choose block type
          </p>
          {BLOCK_OPTIONS.map(({ type, icon: Icon, label, desc, color }) => (
            <button
              key={type}
              className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-bg-hover transition-colors text-left"
              onClick={() => { onAdd(type); setOpen(false) }}
            >
              <Icon size={15} className={clsx(color, 'shrink-0')} />
              <div className="text-left min-w-0">
                <div className="text-text-primary text-sm font-medium">{label}</div>
                <div className="text-text-muted text-xs truncate">{desc}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  )
}
