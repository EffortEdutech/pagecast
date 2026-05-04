'use client'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { useReaderStore } from '@/store/readerStore'
import { getStory } from '@/data/stories'
import { fetchBook } from '@/lib/supabase/books'
import type { Story, StoryBlock, Character, ReaderMode, ReaderTheme } from '@/types'
import { clsx } from 'clsx'
import {
  Play, Pause, SkipForward, SkipBack, ArrowLeft,
  BookOpen, Headphones, Film, Volume2, VolumeX,
  Settings, ChevronLeft, ChevronRight, List, X,
  Check, Mic, Type, Moon, Sun, AlignLeft,
  FastForward, Rewind, Minus, Plus
} from 'lucide-react'

// ─── Waveform animation ───────────────────────────────────────────────
function Waveform() {
  return (
    <span className="inline-flex items-end gap-[2px] h-3">
      {[...Array(5)].map((_, i) => (
        <span key={i} className="waveform-bar h-full" style={{ animationDelay: `${i * 0.07}s` }} />
      ))}
    </span>
  )
}

// ─── Inline audio button for reading mode ─────────────────────────────
function InlineAudioButton({ audioUrl }: { audioUrl: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)

  const toggle = () => {
    if (!audioRef.current) {
      const a = new Audio(audioUrl)
      a.onended = () => setPlaying(false)
      audioRef.current = a
    }
    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
    } else {
      audioRef.current.play()
      setPlaying(true)
    }
  }

  return (
    <button
      onClick={toggle}
      className="inline-flex items-center gap-1 ml-2 opacity-40 hover:opacity-100 transition-opacity align-middle"
      title={playing ? 'Pause audio' : 'Play audio'}
    >
      {playing
        ? <Pause size={11} className="text-accent" />
        : <Play  size={11} className="text-accent" />
      }
    </button>
  )
}

// ─── Block renderer ───────────────────────────────────────────────────
function BlockView({
  block, chars, active, past, fontSize, dyslexia
}: {
  block: StoryBlock
  chars: Character[]
  active: boolean
  past: boolean
  fontSize: string
  dyslexia: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (active && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [active])

  const fontClass = clsx(
    `font-${fontSize}`,
    dyslexia && 'font-dyslexia',
    'reader-text'
  )

  if (block.type === 'pause' || block.type === 'sfx') {
    if (block.type === 'sfx') {
      return (
        <div ref={ref} className={clsx(
          'flex items-center gap-2 my-3 text-text-muted text-xs',
          active && 'block-active px-3 py-2',
          past && 'block-past'
        )}>
          <Volume2 size={11} />
          <span className="italic">{(block as any).label ?? 'Sound effect'}</span>
          {active && <Waveform />}
        </div>
      )
    }
    return <div className={clsx('my-4', past && 'opacity-30')} ref={ref} />
  }

  if (block.type === 'narration') {
    return (
      <div ref={ref} className={clsx(
        'my-4 px-1 transition-all duration-300',
        active && 'block-active px-4 py-3',
        past && 'block-past'
      )}>
        <p className={clsx('text-text-secondary italic', fontClass)}>
          {(block as any).text}
          {block.audioUrl && <InlineAudioButton audioUrl={block.audioUrl} />}
          {active && <span className="ml-2 inline-block align-middle"><Waveform /></span>}
        </p>
      </div>
    )
  }

  if (block.type === 'thought') {
    const char = chars.find(c => c.id === (block as any).characterId)
    return (
      <div ref={ref} className={clsx(
        'my-4 px-1 transition-all duration-300',
        active && 'block-active px-4 py-3',
        past && 'block-past'
      )}>
        {char && (
          <span className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1.5" style={{ color: char.color }}>
            <span className="opacity-60">✦</span> {char.displayName} thinks
          </span>
        )}
        <p className={clsx('text-text-secondary italic pl-3 border-l-2', fontClass)}
          style={{ borderColor: (char?.color ?? '#5C5A6A') + '50' }}>
          {(block as any).text}
          {block.audioUrl && <InlineAudioButton audioUrl={block.audioUrl} />}
        </p>
      </div>
    )
  }

  if (block.type === 'dialogue') {
    const char = chars.find(c => c.id === (block as any).characterId)
    return (
      <div ref={ref} className={clsx(
        'my-4 px-1 transition-all duration-300',
        active && 'block-active px-4 py-3',
        past && 'block-past'
      )}>
        {char && (
          <span className="text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5"
            style={{ color: char.color }}>
            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold"
              style={{ backgroundColor: char.color + '25', color: char.color }}>
              {char.displayName.charAt(0)}
            </span>
            {char.displayName}
            {active && <Waveform />}
          </span>
        )}
        <p className={clsx('text-text-primary pl-2', fontClass)}>
          "{(block as any).text}"
          {block.audioUrl && <InlineAudioButton audioUrl={block.audioUrl} />}
        </p>
      </div>
    )
  }

  if (block.type === 'quote') {
    const b = block as any
    const isPoem = b.style === 'poem'
    return (
      <div ref={ref} className={clsx(
        'my-6 mx-2 p-5 rounded-xl border-l-4 bg-bg-elevated transition-all duration-300',
        active && 'border-accent shadow-accent/20 shadow-lg',
        !active && 'border-bg-border',
        past && 'block-past'
      )}>
        {isPoem ? (
          <pre className={clsx('text-text-primary whitespace-pre-wrap font-serif', fontClass)}>{b.text}</pre>
        ) : (
          <p className={clsx('text-text-primary font-serif italic', fontClass)}>"{b.text}"</p>
        )}
        {b.attribution && (
          <p className="text-text-muted text-xs mt-3 text-right">— {b.attribution}</p>
        )}
        {block.audioUrl && (
          <div className="mt-2 flex justify-end">
            <InlineAudioButton audioUrl={block.audioUrl} />
          </div>
        )}
      </div>
    )
  }

  return null
}

// ─── Mode pills ───────────────────────────────────────────────────────
const MODES: { id: ReaderMode; label: string; icon: typeof BookOpen }[] = [
  { id: 'reading',   label: 'Reading',   icon: BookOpen },
  { id: 'audiobook', label: 'Audiobook', icon: Headphones },
  { id: 'cinematic', label: 'Cinematic', icon: Film },
]

// ─── Main component ───────────────────────────────────────────────────
export default function ReaderPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const {
    isOwned, prefs, setMode, setTheme, setPref,
    isPlaying, setPlaying, currentBlockId, setCurrentBlock,
    saveProgress, getProgress
  } = useReaderStore()

  const [story, setStory] = useState<Story | null | undefined>(undefined)

  // Load story: Supabase first, demo fallback
  useEffect(() => {
    if (!id) return
    fetchBook(id).then(book => {
      setStory(book ?? getStory(id) ?? null)
    }).catch(() => setStory(getStory(id) ?? null))
  }, [id])

  // Gate: must own
  useEffect(() => {
    if (story && !isOwned(story.id)) {
      router.replace(`/book/${id}`)
    }
  }, [story, id, isOwned, router])

  // Apply theme to body
  useEffect(() => {
    document.body.classList.remove('theme-light', 'theme-sepia')
    if (prefs.theme !== 'dark') document.body.classList.add(`theme-${prefs.theme}`)
    return () => document.body.classList.remove('theme-light', 'theme-sepia')
  }, [prefs.theme])

  // ── Navigation state ──
  const savedProgress = story ? getProgress(story.id) : null
  const [chapterIdx, setChapterIdx] = useState(savedProgress?.chapterIdx ?? 0)
  const [sceneIdx, setSceneIdx]     = useState(savedProgress?.sceneIdx   ?? 0)
  const [blockIdx, setBlockIdx]     = useState(savedProgress?.blockIdx   ?? 0)

  // ── UI state ──
  const [showTOC,      setShowTOC]      = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [cinemaMode,   setCinemaMode]   = useState(false)

  // ── Speech synthesis ──
  const synthRef     = useRef<SpeechSynthesis | null>(null)
  const utterRef     = useRef<SpeechSynthesisUtterance | null>(null)
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const audioRef     = useRef<HTMLAudioElement | null>(null)   // block voice audio
  const ambienceRef  = useRef<HTMLAudioElement | null>(null)   // scene ambience loop
  const musicRef     = useRef<HTMLAudioElement | null>(null)   // scene music loop
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])

  useEffect(() => {
    if (typeof window === 'undefined') return
    synthRef.current = window.speechSynthesis
    const load = () => setVoices(window.speechSynthesis.getVoices())
    load()
    window.speechSynthesis.addEventListener('voiceschanged', load)
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', load)
      window.speechSynthesis.cancel()
      audioRef.current?.pause()
      ambienceRef.current?.pause()
      musicRef.current?.pause()
    }
  }, [])

  const chapter = story?.chapters[chapterIdx]
  const scene   = chapter?.scenes[sceneIdx]
  const blocks  = scene?.blocks ?? []
  const block   = blocks[blockIdx]

  // ── Persist progress ──
  const persistProgress = useCallback((ci: number, si: number, bi: number) => {
    if (!story) return
    saveProgress({ storyId: story.id, chapterIdx: ci, sceneIdx: si, blockIdx: bi, timestamp: Date.now() })
  }, [story, saveProgress])

  // ── Advance block ──
  const advance = useCallback(() => {
    if (!story) return
    synthRef.current?.cancel()
    const ch = story.chapters[chapterIdx]
    const sc = ch?.scenes[sceneIdx]
    if (!sc) return

    if (blockIdx < sc.blocks.length - 1) {
      const nb = blockIdx + 1
      setBlockIdx(nb)
      setCurrentBlock(sc.blocks[nb].id)
      persistProgress(chapterIdx, sceneIdx, nb)
    } else if (sceneIdx < ch.scenes.length - 1) {
      const ns = sceneIdx + 1
      setSceneIdx(ns); setBlockIdx(0)
      setCurrentBlock(ch.scenes[ns].blocks[0]?.id ?? null)
      persistProgress(chapterIdx, ns, 0)
    } else if (chapterIdx < story.chapters.length - 1) {
      const nc = chapterIdx + 1
      setChapterIdx(nc); setSceneIdx(0); setBlockIdx(0)
      const b0 = story.chapters[nc]?.scenes[0]?.blocks[0]
      setCurrentBlock(b0?.id ?? null)
      persistProgress(nc, 0, 0)
    } else {
      // Finished
      setPlaying(false)
      setCurrentBlock(null)
    }
  }, [story, chapterIdx, sceneIdx, blockIdx, setCurrentBlock, persistProgress, setPlaying])

  const retreat = useCallback(() => {
    if (!story) return
    synthRef.current?.cancel()
    if (blockIdx > 0) {
      const nb = blockIdx - 1
      setBlockIdx(nb)
      setCurrentBlock(blocks[nb]?.id ?? null)
      persistProgress(chapterIdx, sceneIdx, nb)
    } else if (sceneIdx > 0) {
      const ch = story.chapters[chapterIdx]
      const ns = sceneIdx - 1
      const sc = ch?.scenes[ns]
      if (sc) {
        const nb = sc.blocks.length - 1
        setSceneIdx(ns); setBlockIdx(nb)
        setCurrentBlock(sc.blocks[nb]?.id ?? null)
        persistProgress(chapterIdx, ns, nb)
      }
    }
  }, [story, chapterIdx, sceneIdx, blockIdx, blocks, setCurrentBlock, persistProgress])

  // ── Auto-play (audiobook / cinematic) — real audio first, TTS fallback ──
  useEffect(() => {
    const synth = synthRef.current
    if (timerRef.current) clearTimeout(timerRef.current)

    // Always stop previous audio/speech first
    synth?.cancel()
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.onended = null
      audioRef.current.onerror = null
      audioRef.current = null
    }

    if (!isPlaying || prefs.mode === 'reading') return
    if (!block || !story) return

    // ── Pause / SFX blocks: skip after duration ──
    if (block.type === 'pause' || block.type === 'sfx') {
      const ms = (block.duration ?? 1) * 1000 / prefs.playbackSpeed
      timerRef.current = setTimeout(advance, ms)
      return () => { if (timerRef.current) clearTimeout(timerRef.current) }
    }

    // ── Real audio file available → use it ──
    if (block.audioUrl) {
      const audio = new Audio(block.audioUrl)
      audio.playbackRate = Math.min(2, Math.max(0.5, prefs.playbackSpeed))
      audio.volume = block.type === 'narration'
        ? prefs.narratorVolume
        : prefs.characterVolume
      audio.onended = () => advance()
      audio.onerror = () => advance()   // fallback if file missing
      audioRef.current = audio
      audio.play().catch(() => advance())
      return () => {
        audio.pause()
        audio.onended = null
        audio.onerror = null
      }
    }

    // ── No audio file → fall back to Web Speech API ──
    if (!synth) return
    const speakText: string =
      block.type === 'narration' ? (block as any).text :
      block.type === 'dialogue'  ? (block as any).text :
      block.type === 'thought'   ? (block as any).text :
      block.type === 'quote'     ? (block as any).text : ''

    if (!speakText) { advance(); return }

    const utter = new SpeechSynthesisUtterance(speakText)
    utter.rate   = Math.min(2, Math.max(0.5, prefs.playbackSpeed))
    utter.volume = block.type === 'narration'
      ? prefs.narratorVolume
      : prefs.characterVolume

    if (voices.length > 0) {
      const speakable = voices.filter(v => v.lang.startsWith('en'))
      const pool = speakable.length > 0 ? speakable : voices
      if (block.type === 'dialogue' || block.type === 'thought') {
        const charList = story.characters.filter(c => c.role === 'character')
        const charPos  = charList.findIndex(c => c.id === (block as any).characterId)
        utter.voice = pool[(1 + charPos) % pool.length]
        utter.pitch = 0.8 + (charPos % 4) * 0.15
      } else {
        utter.voice = pool[0]
        utter.pitch = 0.85
      }
    }

    utter.onend   = () => advance()
    utter.onerror = () => advance()
    utterRef.current = utter
    synth.speak(utter)

    return () => { synth.cancel() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, block, prefs.mode, prefs.playbackSpeed,
      prefs.narratorVolume, prefs.characterVolume, voices])

  // ── Scene atmosphere: ambience + music loops ──────────────────────────────
  useEffect(() => {
    const fadeOut = (a: HTMLAudioElement, onDone: () => void) => {
      const step = () => {
        if (a.volume > 0.05) { a.volume = Math.max(0, a.volume - 0.05); setTimeout(step, 80) }
        else { a.pause(); a.volume = 0; onDone() }
      }
      step()
    }

    const prev = { ambience: ambienceRef.current, music: musicRef.current }

    // Fade out old layers
    if (prev.ambience) fadeOut(prev.ambience, () => { ambienceRef.current = null })
    if (prev.music)    fadeOut(prev.music,    () => { musicRef.current    = null })

    if (!scene) return

    // Start ambience
    if (scene.ambienceUrl) {
      const a = new Audio(scene.ambienceUrl)
      const targetVol = (scene.ambienceVolume ?? 0.4) * prefs.musicVolume
      a.loop   = true
      a.volume = 0
      a.play().catch(() => {})
      // Fade in
      const fadeIn = () => {
        if (a.volume < targetVol - 0.03) { a.volume = Math.min(targetVol, a.volume + 0.03); setTimeout(fadeIn, 80) }
        else { a.volume = targetVol }
      }
      fadeIn()
      ambienceRef.current = a
    }

    // Start music
    if (scene.musicUrl) {
      const m = new Audio(scene.musicUrl)
      const targetVol = (scene.musicVolume ?? 0.3) * prefs.musicVolume
      m.loop   = true
      m.volume = 0
      m.play().catch(() => {})
      const fadeIn = () => {
        if (m.volume < targetVol - 0.03) { m.volume = Math.min(targetVol, m.volume + 0.03); setTimeout(fadeIn, 80) }
        else { m.volume = targetVol }
      }
      fadeIn()
      musicRef.current = m
    }

    return () => {
      // Cleanup on scene change (fade handled by next run)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene?.id, prefs.musicVolume])

  // ── Sync currentBlockId ──
  useEffect(() => {
    if (block) setCurrentBlock(block.id)
  }, [block, setCurrentBlock])

  // ── TOC jump ──
  const jumpTo = (ci: number, si: number) => {
    setChapterIdx(ci); setSceneIdx(si); setBlockIdx(0)
    const b0 = story?.chapters[ci]?.scenes[si]?.blocks[0]
    setCurrentBlock(b0?.id ?? null)
    setShowTOC(false)
    persistProgress(ci, si, 0)
  }

  if (story === undefined) return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!story) return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center">
      <div className="text-center space-y-3">
        <BookOpen size={40} className="text-text-muted mx-auto" />
        <p className="text-text-secondary">Story not found.</p>
        <Link href="/library" className="btn-primary inline-flex"><ArrowLeft size={14} /> Library</Link>
      </div>
    </div>
  )

  const isLastBlock = blockIdx >= blocks.length - 1
    && sceneIdx >= (chapter?.scenes.length ?? 1) - 1
    && chapterIdx >= story.chapters.length - 1

  const progressPct = (() => {
    const total = story.chapters.reduce((a, c) => a + c.scenes.reduce((b, s) => b + s.blocks.length, 0), 0)
    let done = 0
    for (let ci = 0; ci < chapterIdx; ci++) {
      story.chapters[ci].scenes.forEach(sc => { done += sc.blocks.length })
    }
    const ch = story.chapters[chapterIdx]
    if (ch) {
      for (let si = 0; si < sceneIdx; si++) done += ch.scenes[si]?.blocks.length ?? 0
      done += blockIdx
    }
    return total > 0 ? (done / total) * 100 : 0
  })()

  return (
    <div className={clsx(
      'min-h-screen flex flex-col transition-colors duration-500',
      cinemaMode ? 'bg-black' : 'bg-bg-primary'
    )}>

      {/* ── Top bar ── */}
      {!cinemaMode && (
        <header className="sticky top-0 z-40 h-12 flex items-center justify-between px-4 bg-bg-secondary/90 backdrop-blur-md border-b border-bg-border">
          <div className="flex items-center gap-3">
            <Link href="/library" className="btn-ghost px-2 py-1.5 text-text-muted hover:text-text-primary">
              <ArrowLeft size={15} />
            </Link>
            <div className="hidden sm:block">
              <p className="text-text-primary text-xs font-semibold leading-tight">{story.title}</p>
              <p className="text-text-muted text-[10px]">{chapter?.title} · {scene?.title}</p>
            </div>
          </div>

          {/* Mode pills */}
          <div className="flex items-center gap-1 bg-bg-elevated rounded-lg p-1">
            {MODES.map(({ id: modeId, label, icon: Icon }) => (
              <button
                key={modeId}
                onClick={() => { setMode(modeId); if (modeId === 'cinematic') setCinemaMode(true) }}
                className={clsx(
                  'flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all',
                  prefs.mode === modeId
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-text-muted hover:text-text-primary'
                )}
                title={label}
              >
                <Icon size={11} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <button onClick={() => setShowTOC(true)}
              className="btn-ghost px-2 py-1.5 text-text-muted" title="Table of contents">
              <List size={15} />
            </button>
            <button onClick={() => setShowSettings(s => !s)}
              className="btn-ghost px-2 py-1.5 text-text-muted" title="Settings">
              <Settings size={15} />
            </button>
          </div>
        </header>
      )}

      {/* ── Progress bar ── */}
      <div className="h-0.5 bg-bg-elevated">
        <div className="h-full bg-accent transition-all duration-500" style={{ width: `${progressPct}%` }} />
      </div>

      {/* ── Settings panel ── */}
      {showSettings && (
        <div className="fixed top-12 right-4 z-50 w-72 card-elevated p-5 shadow-elevated animate-slide-down">
          <div className="flex items-center justify-between mb-4">
            <span className="text-text-primary font-semibold text-sm">Settings</span>
            <button onClick={() => setShowSettings(false)} className="text-text-muted hover:text-text-primary">
              <X size={14} />
            </button>
          </div>

          <div className="space-y-4 text-xs">
            {/* Theme */}
            <div>
              <label className="text-text-secondary mb-2 block">Theme</label>
              <div className="flex gap-2">
                {(['dark', 'light', 'sepia'] as ReaderTheme[]).map(t => (
                  <button key={t}
                    onClick={() => setTheme(t)}
                    className={clsx(
                      'flex-1 py-2 rounded-lg capitalize font-medium border transition-all',
                      prefs.theme === t
                        ? 'border-accent text-accent bg-accent/10'
                        : 'border-bg-border text-text-muted hover:border-text-muted'
                    )}>
                    {t === 'dark' ? <Moon size={12} className="mx-auto" /> :
                     t === 'light' ? <Sun size={12} className="mx-auto" /> :
                     <AlignLeft size={12} className="mx-auto" />}
                    <span className="block mt-1 text-[10px]">{t}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Font size */}
            <div>
              <label className="text-text-secondary mb-2 flex items-center justify-between">
                <span>Font size</span>
                <span className="text-text-primary capitalize">{prefs.fontSize}</span>
              </label>
              <div className="flex gap-2">
                {(['sm','base','lg','xl'] as const).map(s => (
                  <button key={s}
                    onClick={() => setPref('fontSize', s)}
                    className={clsx(
                      'flex-1 py-1.5 rounded-lg capitalize border transition-all text-center',
                      prefs.fontSize === s
                        ? 'border-accent text-accent bg-accent/10'
                        : 'border-bg-border text-text-muted hover:border-text-muted'
                    )}>
                    {s === 'sm' ? 'A' : s === 'base' ? 'A' : s === 'lg' ? 'A' : 'A'}
                  </button>
                ))}
              </div>
            </div>

            {/* Playback speed */}
            <div>
              <label className="text-text-secondary mb-2 flex items-center justify-between">
                <span>Speed</span>
                <span className="text-text-primary">{prefs.playbackSpeed}x</span>
              </label>
              <div className="flex items-center gap-2">
                <button onClick={() => setPref('playbackSpeed', Math.max(0.5, +(prefs.playbackSpeed - 0.25).toFixed(2)))}
                  className="btn-ghost p-1.5"><Minus size={12} /></button>
                <div className="flex-1 bg-bg-elevated rounded-full h-1.5">
                  <div className="bg-accent h-full rounded-full transition-all"
                    style={{ width: `${((prefs.playbackSpeed - 0.5) / 1.5) * 100}%` }} />
                </div>
                <button onClick={() => setPref('playbackSpeed', Math.min(2, +(prefs.playbackSpeed + 0.25).toFixed(2)))}
                  className="btn-ghost p-1.5"><Plus size={12} /></button>
              </div>
            </div>

            {/* Volumes */}
            {[
              { key: 'narratorVolume' as const,  label: 'Narrator' },
              { key: 'characterVolume' as const, label: 'Characters' },
              { key: 'musicVolume' as const,     label: 'Music' },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="text-text-secondary mb-1.5 flex items-center justify-between">
                  <span>{label}</span>
                  <span className="text-text-primary">{Math.round(prefs[key] * 100)}%</span>
                </label>
                <input type="range" min={0} max={1} step={0.05}
                  value={prefs[key]}
                  onChange={e => setPref(key, parseFloat(e.target.value))}
                  className="w-full accent-accent h-1 cursor-pointer" />
              </div>
            ))}

            {/* Dyslexia font */}
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-text-secondary flex items-center gap-1.5"><Type size={11} /> Dyslexia font</span>
              <div onClick={() => setPref('dyslexiaFont', !prefs.dyslexiaFont)}
                className={clsx(
                  'w-10 h-5 rounded-full transition-colors relative cursor-pointer',
                  prefs.dyslexiaFont ? 'bg-accent' : 'bg-bg-elevated border border-bg-border'
                )}>
                <span className={clsx(
                  'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                  prefs.dyslexiaFont ? 'translate-x-5' : 'translate-x-0.5'
                )} />
              </div>
            </label>
          </div>
        </div>
      )}

      {/* ── TOC Drawer ── */}
      {showTOC && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowTOC(false)} />
          <div className="relative w-80 max-w-[90vw] bg-bg-secondary h-full ml-0 shadow-elevated flex flex-col animate-slide-down overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-bg-border">
              <span className="text-text-primary font-semibold">Contents</span>
              <button onClick={() => setShowTOC(false)} className="text-text-muted hover:text-text-primary">
                <X size={16} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 py-2">
              {story.chapters.map((ch, ci) => (
                <div key={ch.id}>
                  <div className="px-5 py-2 text-text-muted text-[10px] uppercase tracking-widest font-semibold">
                    {ci + 1}. {ch.title}
                  </div>
                  {ch.scenes.map((sc, si) => {
                    const isCurrent = ci === chapterIdx && si === sceneIdx
                    return (
                      <button
                        key={sc.id}
                        onClick={() => jumpTo(ci, si)}
                        className={clsx(
                          'w-full text-left px-6 py-2.5 text-sm transition-colors flex items-center gap-2',
                          isCurrent
                            ? 'text-accent bg-accent/10'
                            : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
                        )}>
                        {isCurrent && <ChevronRight size={11} />}
                        {sc.title}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <main className={clsx(
        'flex-1 overflow-y-auto transition-all duration-500',
        cinemaMode ? 'pb-0' : 'pb-32'
      )}>
        {cinemaMode ? (
          // ── Cinematic mode ──
          <div className="min-h-screen flex flex-col items-center justify-center px-8 relative">
            <button
              onClick={() => { setCinemaMode(false); setMode('reading') }}
              className="absolute top-5 left-5 text-white/40 hover:text-white transition-colors">
              <X size={18} />
            </button>
            {block && (
              <div className="max-w-2xl w-full text-center animate-fade-in">
                {block.type === 'narration' && (
                  <p className={clsx('text-white/70 italic', `font-${prefs.fontSize}`, 'reader-text text-lg leading-loose')}>
                    {(block as any).text}
                  </p>
                )}
                {(block.type === 'dialogue' || block.type === 'thought') && (() => {
                  const char = story.characters.find(c => c.id === (block as any).characterId)
                  return (
                    <div>
                      {char && (
                        <span className="text-sm font-bold uppercase tracking-widest mb-4 block"
                          style={{ color: char.color }}>
                          {char.displayName}
                        </span>
                      )}
                      <p className={clsx('text-white', `font-${prefs.fontSize}`, 'reader-text text-2xl leading-loose font-serif italic')}>
                        "{(block as any).text}"
                      </p>
                    </div>
                  )
                })()}
  
                {block.type === 'quote' && (
                  <div className="text-center">
                    <p className={clsx('text-white/90 font-serif italic text-xl leading-relaxed', `font-${prefs.fontSize}`, 'reader-text')}>
                      "{(block as any).text}"
                    </p>
                    {(block as any).attribution && (
                      <p className="text-white/40 text-sm mt-4">— {(block as any).attribution}</p>
                    )}
                  </div>
                )}

                {/* Cinematic nav */}
                <div className="flex items-center justify-center gap-6 mt-12">
                  <button onClick={retreat}
                    className="text-white/40 hover:text-white transition-colors">
                    <ChevronLeft size={28} />
                  </button>
                  <button
                    onClick={() => setPlaying(!isPlaying)}
                    className="w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all">
                    {isPlaying
                      ? <Pause size={22} className="text-white" />
                      : <Play  size={22} className="text-white fill-white" />
                    }
                  </button>
                  <button onClick={advance}
                    className="text-white/40 hover:text-white transition-colors">
                    <ChevronRight size={28} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          // ── Reading / Audiobook mode ──
          <div className="max-w-2xl mx-auto px-6 py-10">
            {/* Scene header */}
            <div className="mb-8 pb-6 border-b border-bg-border">
              <p className="text-text-muted text-xs uppercase tracking-widest mb-1">
                Chapter {chapterIdx + 1} · Scene {sceneIdx + 1}
              </p>
              <h2 className="text-text-primary font-bold text-xl">{scene?.title}</h2>
            </div>

            {/* Blocks */}
            <div className="space-y-1">
              {blocks.map((b, i) => (
                <div key={b.id} onClick={() => {
                  setBlockIdx(i)
                  setCurrentBlock(b.id)
                  persistProgress(chapterIdx, sceneIdx, i)
                }}>
                  <BlockView
                    block={b}
                    chars={story.characters}
                    active={i === blockIdx && !!currentBlockId}
                    past={i < blockIdx}
                    fontSize={prefs.fontSize}
                    dyslexia={prefs.dyslexiaFont}
                  />
                </div>
              ))}
            </div>

            {/* Scene navigation */}
            <div className="flex items-center justify-between mt-12 pt-6 border-t border-bg-border">
              <button
                onClick={() => { if (sceneIdx > 0) jumpTo(chapterIdx, sceneIdx - 1) }}
                disabled={sceneIdx === 0 && chapterIdx === 0}
                className="btn-ghost flex items-center gap-2 disabled:opacity-30">
                <ChevronLeft size={15} /> Previous scene
              </button>
              <button
                onClick={() => {
                  if (!story) return
                  const ch = story.chapters[chapterIdx]
                  if (sceneIdx < (ch?.scenes.length ?? 1) - 1) {
                    jumpTo(chapterIdx, sceneIdx + 1)
                  } else if (chapterIdx < story.chapters.length - 1) {
                    jumpTo(chapterIdx + 1, 0)
                  }
                }}
                disabled={isLastBlock}
                className="btn-ghost flex items-center gap-2 disabled:opacity-30">
                Next scene <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ── Bottom player bar ── */}
      {!cinemaMode && (
        <footer className="fixed bottom-0 left-0 right-0 z-40 bg-bg-secondary/95 backdrop-blur-md border-t border-bg-border">
          {/* Progress bar */}
          <div className="h-0.5 bg-bg-border">
            <div className="h-full bg-accent transition-all duration-300" style={{ width: `${progressPct}%` }} />
          </div>

          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-4">
            {/* Block info */}
            <div className="flex-1 min-w-0">
              <p className="text-text-muted text-[10px] truncate">
                {scene?.title} · {blockIdx + 1} / {blocks.length}
              </p>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={retreat} className="btn-ghost p-1.5 text-text-muted hover:text-text-primary">
                <Rewind size={16} />
              </button>
              <button
                onClick={() => setPlaying(!isPlaying)}
                className="w-9 h-9 rounded-full bg-accent hover:bg-accent/80 flex items-center justify-center shadow-accent transition-all">
                {isPlaying
                  ? <Pause size={15} className="text-white" />
                  : <Play  size={15} className="text-white fill-white" />
                }
              </button>
              <button onClick={advance} className="btn-ghost p-1.5 text-text-muted hover:text-text-primary">
                <FastForward size={16} />
              </button>
            </div>

            {/* Speed */}
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => setPref('playbackSpeed', Math.max(0.5, prefs.playbackSpeed - 0.25))}
                className="btn-ghost p-1 text-text-muted text-xs">
                <Minus size={11} />
              </button>
              <span className="text-text-secondary text-xs w-8 text-center">{prefs.playbackSpeed}x</span>
              <button onClick={() => setPref('playbackSpeed', Math.min(2, prefs.playbackSpeed + 0.25))}
                className="btn-ghost p-1 text-text-muted text-xs">
                <Plus size={11} />
              </button>
            </div>
          </div>
        </footer>
      )}
    </div>
  )
}
