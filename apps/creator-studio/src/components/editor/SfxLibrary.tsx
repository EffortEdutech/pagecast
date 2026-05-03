'use client'
import { useState, useRef } from 'react'
import { Play, Pause, ChevronDown, ChevronUp } from 'lucide-react'
import { clsx } from 'clsx'

// ── Curated SFX preset library ────────────────────────────────────────────────
// These are label-only presets. Audio assets can be hosted later.
// audioUrl is optional — when present, a play button becomes active.

interface SfxPreset {
  id: string
  label: string
  category: string
  audioUrl?: string   // future: hosted on Supabase Storage / CDN
}

const SFX_LIBRARY: SfxPreset[] = [
  // Nature
  { id: 'rain-heavy',     label: 'Rain — Heavy',       category: 'Nature' },
  { id: 'rain-light',     label: 'Rain — Light',       category: 'Nature' },
  { id: 'thunder',        label: 'Thunder Crack',       category: 'Nature' },
  { id: 'forest-birds',   label: 'Forest Birds',        category: 'Nature' },
  { id: 'wind-howl',      label: 'Wind Howling',        category: 'Nature' },
  { id: 'ocean-waves',    label: 'Ocean Waves',         category: 'Nature' },
  { id: 'fire-crackling', label: 'Fire Crackling',      category: 'Nature' },
  // Urban
  { id: 'city-ambience',  label: 'City Ambience',       category: 'Urban' },
  { id: 'crowd-murmur',   label: 'Crowd Murmur',        category: 'Urban' },
  { id: 'door-knock',     label: 'Door Knock',          category: 'Urban' },
  { id: 'phone-ring',     label: 'Phone Ring',          category: 'Urban' },
  { id: 'car-pass',       label: 'Car Passing',         category: 'Urban' },
  // Action
  { id: 'sword-clash',    label: 'Sword Clash',         category: 'Action' },
  { id: 'footsteps',      label: 'Footsteps',           category: 'Action' },
  { id: 'explosion',      label: 'Explosion (distant)', category: 'Action' },
  { id: 'glass-break',    label: 'Glass Break',         category: 'Action' },
  { id: 'door-creak',     label: 'Door Creak',          category: 'Action' },
  { id: 'gunshot',        label: 'Gunshot',             category: 'Action' },
  // Emotional
  { id: 'heartbeat',      label: 'Heartbeat',           category: 'Emotional' },
  { id: 'clock-ticking',  label: 'Clock Ticking',       category: 'Emotional' },
  { id: 'breath-heavy',   label: 'Heavy Breathing',     category: 'Emotional' },
  { id: 'gasp',           label: 'Gasp',                category: 'Emotional' },
  { id: 'sob',            label: 'Sob',                 category: 'Emotional' },
  // Mystical
  { id: 'magic-shimmer',  label: 'Magic Shimmer',       category: 'Mystical' },
  { id: 'dark-drone',     label: 'Dark Drone',          category: 'Mystical' },
  { id: 'bell-chime',     label: 'Bell Chime',          category: 'Mystical' },
  { id: 'whisper-echo',   label: 'Whisper Echo',        category: 'Mystical' },
  { id: 'portal-open',    label: 'Portal Opening',      category: 'Mystical' },
]

const CATEGORIES = ['Nature', 'Urban', 'Action', 'Emotional', 'Mystical']

interface SfxLibraryProps {
  currentLabel?: string
  onSelect: (label: string) => void
}

export function SfxLibrary({ currentLabel, onSelect }: SfxLibraryProps) {
  const [open,        setOpen]        = useState(false)
  const [activeCategory, setCategory] = useState('Nature')
  const [playingId,   setPlayingId]   = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const filtered = SFX_LIBRARY.filter(s => s.category === activeCategory)

  const handlePlay = (preset: SfxPreset, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!preset.audioUrl) return

    if (playingId === preset.id) {
      audioRef.current?.pause()
      setPlayingId(null)
      return
    }

    audioRef.current?.pause()
    const a = new Audio(preset.audioUrl)
    a.onended = () => setPlayingId(null)
    a.play()
    audioRef.current = a
    setPlayingId(preset.id)
  }

  const handleSelect = (preset: SfxPreset) => {
    audioRef.current?.pause()
    setPlayingId(null)
    onSelect(preset.label)
    setOpen(false)
  }

  return (
    <div className="space-y-1">
      <button
        onClick={() => setOpen(o => !o)}
        className="btn-ghost text-xs px-2 py-1 border border-bg-border hover:border-accent/40 w-full justify-between"
      >
        <span className="flex items-center gap-1">
          <Play size={10} /> Browse SFX Library
        </span>
        {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>

      {open && (
        <div className="border border-bg-border rounded-xl bg-bg-card overflow-hidden">
          {/* Category tabs */}
          <div className="flex overflow-x-auto border-b border-bg-border px-2 pt-2 gap-1">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={clsx(
                  'text-[10px] px-2 py-1 rounded-t-md whitespace-nowrap transition-colors shrink-0',
                  activeCategory === cat
                    ? 'bg-accent/20 text-accent'
                    : 'text-text-muted hover:text-text-secondary'
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* SFX list */}
          <div className="max-h-40 overflow-y-auto p-1.5 grid grid-cols-2 gap-1">
            {filtered.map(preset => (
              <button
                key={preset.id}
                onClick={() => handleSelect(preset)}
                className={clsx(
                  'flex items-center justify-between gap-1 px-2 py-1.5 rounded-lg text-xs text-left transition-colors',
                  currentLabel === preset.label
                    ? 'bg-accent/20 text-accent'
                    : 'hover:bg-bg-elevated text-text-secondary hover:text-text-primary'
                )}
              >
                <span className="truncate">{preset.label}</span>
                {preset.audioUrl && (
                  <button
                    onClick={e => handlePlay(preset, e)}
                    className="shrink-0 text-text-muted hover:text-accent transition-colors"
                  >
                    {playingId === preset.id
                      ? <Pause size={9} />
                      : <Play  size={9} />
                    }
                  </button>
                )}
              </button>
            ))}
          </div>

          <p className="text-[10px] text-text-muted px-3 py-2 border-t border-bg-border/50">
            Click to assign label. Upload your own audio above.
          </p>
        </div>
      )}
    </div>
  )
}
