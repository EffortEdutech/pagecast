'use client'
import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, ChevronUp, Loader2, Pause, Play } from 'lucide-react'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'

interface SfxPreset {
  id: string
  label: string
  category: string
  duration: number
}

export interface SfxSelection {
  label: string
  sfxFile: string
  duration: number
  file?: File
  audioUrl?: string
}

interface UploadedSfx {
  id: string
  label: string
  fileName: string
  audioUrl: string
  duration: number
}

const SFX_LIBRARY: SfxPreset[] = [
  { id: 'rain-heavy', label: 'Rain heavy', category: 'Nature', duration: 2.4 },
  { id: 'rain-light', label: 'Rain light', category: 'Nature', duration: 2.2 },
  { id: 'thunder', label: 'Thunder crack', category: 'Nature', duration: 2.0 },
  { id: 'forest-birds', label: 'Forest birds', category: 'Nature', duration: 2.4 },
  { id: 'wind-howl', label: 'Wind howling', category: 'Nature', duration: 2.3 },
  { id: 'ocean-waves', label: 'Ocean waves', category: 'Nature', duration: 2.8 },
  { id: 'fire-crackling', label: 'Fire crackling', category: 'Nature', duration: 2.2 },

  { id: 'bus-doors-opening', label: 'Bus doors opening', category: 'Urban', duration: 2.1 },
  { id: 'city-ambience', label: 'City ambience', category: 'Urban', duration: 2.4 },
  { id: 'crowd-murmur', label: 'Crowd murmur', category: 'Urban', duration: 2.5 },
  { id: 'door-knock', label: 'Door knock', category: 'Urban', duration: 1.2 },
  { id: 'phone-ring', label: 'Phone ring', category: 'Urban', duration: 1.8 },
  { id: 'car-pass', label: 'Car passing', category: 'Urban', duration: 1.9 },

  { id: 'sword-clash', label: 'Sword clash', category: 'Action', duration: 1.0 },
  { id: 'footsteps', label: 'Footsteps', category: 'Action', duration: 1.8 },
  { id: 'explosion', label: 'Explosion distant', category: 'Action', duration: 2.0 },
  { id: 'glass-break', label: 'Glass break', category: 'Action', duration: 1.2 },
  { id: 'door-creak', label: 'Door creak', category: 'Action', duration: 1.8 },

  { id: 'heartbeat', label: 'Heartbeat', category: 'Emotional', duration: 1.8 },
  { id: 'clock-ticking', label: 'Clock ticking', category: 'Emotional', duration: 2.0 },
  { id: 'breath-heavy', label: 'Heavy breathing', category: 'Emotional', duration: 2.2 },
  { id: 'gasp', label: 'Gasp', category: 'Emotional', duration: 0.9 },

  { id: 'magic-shimmer', label: 'Magic shimmer', category: 'Mystical', duration: 2.2 },
  { id: 'dark-drone', label: 'Dark drone', category: 'Mystical', duration: 2.5 },
  { id: 'bell-chime', label: 'Bell chime', category: 'Mystical', duration: 1.8 },
  { id: 'whisper-echo', label: 'Whisper echo', category: 'Mystical', duration: 2.0 },
  { id: 'portal-open', label: 'Portal opening', category: 'Mystical', duration: 2.4 },
]

const CATEGORIES = ['My Assets', 'Nature', 'Urban', 'Action', 'Emotional', 'Mystical']
const SAMPLE_RATE = 44100

interface SfxLibraryProps {
  bookId: string
  currentLabel?: string
  onSelect: (selection: SfxSelection) => void | Promise<void>
}

function slugifySfxLabel(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function envelope(t: number, start: number, duration: number): number {
  const x = Math.max(0, Math.min(1, (t - start) / duration))
  return Math.sin(Math.PI * x)
}

function writeWav(samples: Float32Array): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i))
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, SAMPLE_RATE, true)
  view.setUint32(28, SAMPLE_RATE * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, samples.length * 2, true)

  let offset = 44
  for (const sample of samples) {
    view.setInt16(offset, Math.max(-1, Math.min(1, sample)) * 0x7fff, true)
    offset += 2
  }
  return new Blob([buffer], { type: 'audio/wav' })
}

function createSfxFile(preset: SfxPreset): File {
  const samples = new Float32Array(Math.ceil(preset.duration * SAMPLE_RATE))

  const addTone = (start: number, duration: number, frequency: number, volume: number, bend = 0) => {
    const from = Math.floor(start * SAMPLE_RATE)
    const to = Math.min(samples.length, Math.floor((start + duration) * SAMPLE_RATE))
    for (let i = from; i < to; i += 1) {
      const t = i / SAMPLE_RATE
      const p = (t - start) / duration
      const f = frequency + bend * p
      samples[i] += Math.sin(2 * Math.PI * f * (t - start)) * volume * envelope(t, start, duration)
    }
  }

  const addNoise = (start: number, duration: number, volume: number, low = false) => {
    const from = Math.floor(start * SAMPLE_RATE)
    const to = Math.min(samples.length, Math.floor((start + duration) * SAMPLE_RATE))
    let last = 0
    for (let i = from; i < to; i += 1) {
      const t = i / SAMPLE_RATE
      const raw = Math.random() * 2 - 1
      last = low ? last * 0.92 + raw * 0.08 : raw
      samples[i] += last * volume * envelope(t, start, duration)
    }
  }

  const addThump = (start: number, volume = 0.7) => {
    addTone(start, 0.16, 80, volume, -45)
    addNoise(start, 0.08, volume * 0.22, true)
  }

  switch (preset.id) {
    case 'bus-doors-opening':
      addNoise(0.05, 1.15, 0.28, true)
      addTone(0.15, 0.85, 380, 0.16, -120)
      addTone(0.25, 0.8, 150, 0.12, 70)
      addTone(1.15, 0.16, 880, 0.25)
      addTone(1.38, 0.16, 880, 0.22)
      addThump(1.72, 0.42)
      break
    case 'rain-heavy':
      addNoise(0, preset.duration, 0.3)
      addNoise(0, preset.duration, 0.18, true)
      break
    case 'rain-light':
      addNoise(0, preset.duration, 0.14)
      break
    case 'thunder':
      addNoise(0.1, 1.5, 0.44, true)
      addTone(0.08, 1.3, 55, 0.35, -25)
      break
    case 'forest-birds':
      addNoise(0, preset.duration, 0.06, true)
      ;[0.25, 0.7, 1.25, 1.85].forEach((t, i) => addTone(t, 0.18, 1200 + i * 180, 0.18, 550))
      break
    case 'wind-howl':
      addNoise(0, preset.duration, 0.24, true)
      addTone(0.3, 1.6, 240, 0.12, -100)
      break
    case 'ocean-waves':
      addNoise(0.1, 1.1, 0.22, true)
      addNoise(1.2, 1.2, 0.2, true)
      break
    case 'fire-crackling':
      addNoise(0, preset.duration, 0.08, true)
      ;[0.2, 0.44, 0.9, 1.2, 1.55, 1.9].forEach(t => addNoise(t, 0.08, 0.32))
      break
    case 'city-ambience':
      addNoise(0, preset.duration, 0.12, true)
      addTone(0.55, 0.55, 330, 0.08, -90)
      addTone(1.35, 0.4, 520, 0.06, 120)
      break
    case 'crowd-murmur':
      addNoise(0, preset.duration, 0.16, true)
      addTone(0.2, 1.8, 180, 0.07, 60)
      addTone(0.6, 1.4, 260, 0.05, -50)
      break
    case 'door-knock':
      addThump(0.15)
      addThump(0.43)
      addThump(0.72)
      break
    case 'phone-ring':
      ;[0.05, 0.75].forEach(t => {
        addTone(t, 0.42, 780, 0.18)
        addTone(t, 0.42, 980, 0.14)
      })
      break
    case 'car-pass':
      addNoise(0.2, 1.35, 0.22, true)
      addTone(0.25, 1.2, 210, 0.14, -90)
      break
    case 'sword-clash':
      addNoise(0.04, 0.22, 0.36)
      addTone(0.02, 0.45, 1800, 0.26, -900)
      break
    case 'footsteps':
      ;[0.12, 0.48, 0.86, 1.24].forEach(t => addThump(t, 0.42))
      break
    case 'explosion':
      addNoise(0.05, 1.35, 0.5, true)
      addTone(0.06, 1.25, 70, 0.36, -35)
      break
    case 'glass-break':
      addNoise(0.03, 0.28, 0.38)
      ;[1100, 1700, 2300].forEach((f, i) => addTone(0.04 + i * 0.05, 0.5, f, 0.13, -500))
      break
    case 'door-creak':
      addTone(0.05, 1.25, 290, 0.2, 115)
      addNoise(0.1, 1.0, 0.12, true)
      break
    case 'heartbeat':
      ;[0.12, 0.34, 1.02, 1.24].forEach((t, i) => addThump(t, i % 2 ? 0.42 : 0.58))
      break
    case 'clock-ticking':
      ;[0.1, 0.6, 1.1, 1.6].forEach(t => {
        addTone(t, 0.05, 1300, 0.22)
        addNoise(t, 0.04, 0.15)
      })
      break
    case 'breath-heavy':
      addNoise(0.1, 0.7, 0.22, true)
      addNoise(1.1, 0.75, 0.22, true)
      break
    case 'gasp':
      addNoise(0.04, 0.48, 0.24, true)
      addTone(0.08, 0.38, 420, 0.08, 150)
      break
    case 'magic-shimmer':
      ;[0.1, 0.35, 0.65, 1.0, 1.35].forEach((t, i) => addTone(t, 0.55, 780 + i * 210, 0.14, 260))
      break
    case 'dark-drone':
      addTone(0, preset.duration, 80, 0.22, 20)
      addTone(0.4, 1.8, 130, 0.14, -20)
      break
    case 'bell-chime':
      addTone(0.05, 1.4, 740, 0.22, -80)
      addTone(0.05, 1.2, 1480, 0.12, -160)
      break
    case 'whisper-echo':
      addNoise(0.1, 0.8, 0.12, true)
      addNoise(0.75, 0.9, 0.08, true)
      break
    case 'portal-open':
      addTone(0.05, 1.9, 160, 0.2, 620)
      addNoise(0.2, 1.7, 0.17, true)
      break
    default:
      addTone(0.05, 1, 440, 0.2)
  }

  const blob = writeWav(samples)
  const name = `${slugifySfxLabel(preset.label)}.wav`
  return new File([blob], name, { type: 'audio/wav' })
}

export function SfxLibrary({ bookId, currentLabel, onSelect }: SfxLibraryProps) {
  const [open, setOpen] = useState(false)
  const [activeCategory, setCategory] = useState('My Assets')
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [selectingId, setSelectingId] = useState<string | null>(null)
  const [uploadedSfx, setUploadedSfx] = useState<UploadedSfx[]>([])
  const [loadingAssets, setLoadingAssets] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const previewUrls = useRef<Map<string, string>>(new Map())

  const filtered = SFX_LIBRARY.filter(s => s.category === activeCategory)

  useEffect(() => {
    if (!open || activeCategory !== 'My Assets') return

    let cancelled = false
    async function loadUploadedSfx() {
      setLoadingAssets(true)
      const supabase = createClient()
      const { data } = await supabase.auth.getUser()
      const userId = data.user?.id
      if (!userId) {
        if (!cancelled) {
          setUploadedSfx([])
          setLoadingAssets(false)
        }
        return
      }

      const { data: files } = await supabase.storage
        .from('assets')
        .list(`${userId}/${bookId}`, { limit: 300 })

      const next = (files ?? [])
        .filter(file => file.name.startsWith('sfx_'))
        .map(file => {
          const path = `${userId}/${bookId}/${file.name}`
          const { data: urlData } = supabase.storage.from('assets').getPublicUrl(path)
          const label = file.name
            .replace(/^sfx_\d+_?/, '')
            .replace(/\.[^.]+$/, '')
            .replace(/[-_]+/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase())
          return {
            id: path,
            label,
            fileName: file.name,
            audioUrl: urlData.publicUrl,
            duration: 1,
          }
        })

      if (!cancelled) {
        setUploadedSfx(next)
        setLoadingAssets(false)
      }
    }

    loadUploadedSfx()
    return () => { cancelled = true }
  }, [activeCategory, bookId, open])

  const getPreviewUrl = (preset: SfxPreset) => {
    const existing = previewUrls.current.get(preset.id)
    if (existing) return existing
    const url = URL.createObjectURL(createSfxFile(preset))
    previewUrls.current.set(preset.id, url)
    return url
  }

  const handlePlay = (preset: SfxPreset) => {
    if (playingId === preset.id) {
      audioRef.current?.pause()
      setPlayingId(null)
      return
    }

    audioRef.current?.pause()
    const audio = new Audio(getPreviewUrl(preset))
    audio.onended = () => setPlayingId(null)
    audio.play().catch(() => setPlayingId(null))
    audioRef.current = audio
    setPlayingId(preset.id)
  }

  const handlePlayUploaded = (asset: UploadedSfx) => {
    if (playingId === asset.id) {
      audioRef.current?.pause()
      setPlayingId(null)
      return
    }

    audioRef.current?.pause()
    const audio = new Audio(asset.audioUrl)
    audio.onloadedmetadata = () => {
      setUploadedSfx(prev => prev.map(item =>
        item.id === asset.id ? { ...item, duration: Number.isFinite(audio.duration) ? audio.duration : 1 } : item
      ))
    }
    audio.onended = () => setPlayingId(null)
    audio.play().catch(() => setPlayingId(null))
    audioRef.current = audio
    setPlayingId(asset.id)
  }

  const handleSelect = async (preset: SfxPreset) => {
    audioRef.current?.pause()
    setPlayingId(null)
    setSelectingId(preset.id)
    try {
      await onSelect({
        label: preset.label,
        sfxFile: `${slugifySfxLabel(preset.label)}.wav`,
        duration: preset.duration,
        file: createSfxFile(preset),
      })
      setOpen(false)
    } finally {
      setSelectingId(null)
    }
  }

  const handleSelectUploaded = async (asset: UploadedSfx) => {
    audioRef.current?.pause()
    setPlayingId(null)
    setSelectingId(asset.id)
    try {
      await onSelect({
        label: asset.label,
        sfxFile: asset.fileName,
        duration: asset.duration,
        audioUrl: asset.audioUrl,
      })
      setOpen(false)
    } finally {
      setSelectingId(null)
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
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
          <div className="flex overflow-x-auto border-b border-bg-border px-2 pt-2 gap-1">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                type="button"
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

          <div className="max-h-52 overflow-y-auto p-1.5 grid grid-cols-1 gap-1">
            {activeCategory === 'My Assets' ? (
              loadingAssets ? (
                <div className="flex items-center gap-2 px-2 py-3 text-xs text-text-muted">
                  <Loader2 size={12} className="animate-spin" /> Loading SFX assets...
                </div>
              ) : uploadedSfx.length === 0 ? (
                <p className="px-2 py-3 text-xs text-text-muted">
                  No uploaded SFX for this book yet. Add them in Assets, or use a built-in category.
                </p>
              ) : uploadedSfx.map(asset => (
                <div
                  key={asset.id}
                  className={clsx(
                    'flex items-center gap-1 rounded-lg px-1 py-1 transition-colors',
                    currentLabel === asset.label ? 'bg-accent/15' : 'hover:bg-bg-elevated'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => handlePlayUploaded(asset)}
                    className="shrink-0 text-text-muted hover:text-accent transition-colors p-1"
                    title={`Preview ${asset.label}`}
                  >
                    {playingId === asset.id ? <Pause size={12} /> : <Play size={12} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectUploaded(asset)}
                    disabled={selectingId !== null}
                    className={clsx(
                      'flex-1 min-w-0 flex items-center justify-between gap-2 px-1 py-1 text-xs text-left',
                      currentLabel === asset.label ? 'text-accent' : 'text-text-secondary hover:text-text-primary'
                    )}
                  >
                    <span className="truncate">{asset.label}</span>
                    {selectingId === asset.id ? (
                      <Loader2 size={11} className="animate-spin shrink-0" />
                    ) : currentLabel === asset.label ? (
                      <Check size={11} className="shrink-0" />
                    ) : null}
                  </button>
                </div>
              ))
            ) : filtered.map(preset => (
                <div
                  key={preset.id}
                  className={clsx(
                    'flex items-center gap-1 rounded-lg px-1 py-1 transition-colors',
                    currentLabel === preset.label ? 'bg-accent/15' : 'hover:bg-bg-elevated'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => handlePlay(preset)}
                    className="shrink-0 text-text-muted hover:text-accent transition-colors p-1"
                    title={`Preview ${preset.label}`}
                  >
                    {playingId === preset.id ? <Pause size={12} /> : <Play size={12} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelect(preset)}
                    disabled={selectingId !== null}
                    className={clsx(
                      'flex-1 min-w-0 flex items-center justify-between gap-2 px-1 py-1 text-xs text-left',
                      currentLabel === preset.label ? 'text-accent' : 'text-text-secondary hover:text-text-primary'
                    )}
                  >
                    <span className="truncate">{preset.label}</span>
                    {selectingId === preset.id ? (
                      <Loader2 size={11} className="animate-spin shrink-0" />
                    ) : currentLabel === preset.label ? (
                      <Check size={11} className="shrink-0" />
                    ) : null}
                  </button>
                </div>
              ))}
          </div>

          <p className="text-[10px] text-text-muted px-3 py-2 border-t border-bg-border/50">
            Preview, then select. Built-in SFX are saved as playable audio for the Reader.
          </p>
        </div>
      )}
    </div>
  )
}
