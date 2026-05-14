'use client'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { useReaderStore } from '@/store/readerStore'
import { getStory } from '@/data/stories'
import { fetchBook } from '@/lib/supabase/books'
import { stripPerformanceTagsForDisplay } from '@/lib/performanceTags'
import type { Story, StoryBlock, Character, ReaderMode, ReaderTheme } from '@/types'
import { clsx } from 'clsx'
import {
  Play, Pause, SkipForward, SkipBack, ArrowLeft,
  BookOpen, Headphones, Film, Volume2, VolumeX,
  Settings, ChevronLeft, ChevronRight, List, X,
  Check, Mic, Type, Moon, Sun, AlignLeft,
  FastForward, Rewind, Minus, Plus, Bookmark, BookmarkCheck,
  Trash2, RotateCcw, Timer, Users
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
  const displayText = 'text' in block
    ? stripPerformanceTagsForDisplay(String((block as any).text ?? ''))
    : ''

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
          {displayText}
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
          {displayText}
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
          "{displayText}"
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
          <pre className={clsx('text-text-primary whitespace-pre-wrap font-serif', fontClass)}>{displayText}</pre>
        ) : (
          <p className={clsx('text-text-primary font-serif italic', fontClass)}>"{displayText}"</p>
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
  { id: 'reading',   label: 'Page Mode',  icon: BookOpen },
  { id: 'audiobook', label: 'Voice Mode', icon: Headphones },
  { id: 'cinematic', label: 'Dream Mode', icon: Film },
]

const BEAT_GAP_MS = 550

function blockSummary(block: StoryBlock, index: number): string {
  const prefix = `Moment ${index + 1}`
  if (block.type === 'pause') return `${prefix} - Pause`
  if (block.type === 'sfx') return `${prefix} - ${(block as any).label ?? 'Sound effect'}`

  const text = 'text' in block ? String((block as any).text ?? '') : ''
  if (!text.trim()) return prefix
  const clean = stripPerformanceTagsForDisplay(text).replace(/\s+/g, ' ').trim()
  return `${prefix} - ${clean.slice(0, 72)}${clean.length > 72 ? '...' : ''}`
}

// ─── Main component ───────────────────────────────────────────────────
function findPrevSceneLocation(story: Story, chapterIdx: number, sceneIdx: number) {
  for (let ci = chapterIdx; ci >= 0; ci--) {
    const scenes = story.chapters[ci]?.scenes ?? []
    const start = ci === chapterIdx ? sceneIdx - 1 : scenes.length - 1
    for (let si = start; si >= 0; si--) {
      if (scenes[si]) return { chapterIdx: ci, sceneIdx: si }
    }
  }
  return null
}

function findNextSceneLocation(story: Story, chapterIdx: number, sceneIdx: number) {
  for (let ci = chapterIdx; ci < story.chapters.length; ci++) {
    const scenes = story.chapters[ci]?.scenes ?? []
    const start = ci === chapterIdx ? sceneIdx + 1 : 0
    for (let si = start; si < scenes.length; si++) {
      if (scenes[si]) return { chapterIdx: ci, sceneIdx: si }
    }
  }
  return null
}

export default function ReaderPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const {
    isOwned, prefs, setMode, setTheme, setPref,
    isPlaying, setPlaying, currentBlockId, setCurrentBlock,
    saveProgress, getProgress, addBookmark, removeBookmark,
    getBookmarks, isBookmarked
  } = useReaderStore()

  const [story, setStory] = useState<Story | null | undefined>(undefined)
  const [serverAccess, setServerAccess] = useState<boolean | null>(null)

  // Load story: Supabase first, demo fallback
  useEffect(() => {
    if (!id) return
    fetchBook(id).then(book => {
      setStory(book ?? getStory(id) ?? null)
    }).catch(() => setStory(getStory(id) ?? null))
  }, [id])

  useEffect(() => {
    if (!id) return
    const isPreview = new URLSearchParams(window.location.search).get('preview') === '1'
    if (isPreview) {
      setServerAccess(true)
      return
    }

    fetch(`/api/books/${id}/access`)
      .then(res => res.ok ? res.json() : null)
      .then(data => setServerAccess(Boolean(data?.hasAccess)))
      .catch(() => setServerAccess(false))
  }, [id])

  // Gate: must own (bypass with ?preview=1 for creator studio preview)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const isPreview = new URLSearchParams(window.location.search).get('preview') === '1'
    if (story && serverAccess === false && !isOwned(story.id) && !isPreview) {
      router.replace(`/book/${id}`)
    }
  }, [story, id, isOwned, router, serverAccess])

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
  const [showTOC,        setShowTOC]        = useState(false)
  const [showBookmarks,  setShowBookmarks]  = useState(false)
  const [showSettings,   setShowSettings]   = useState(false)
  const [showResumePrompt, setShowResumePrompt] = useState(false)
  const [resumeHandled, setResumeHandled] = useState(false)
  const [expandedTocScenes, setExpandedTocScenes] = useState<Set<string>>(new Set())
  const [replayNonce, setReplayNonce] = useState(0)
  const [sleepTimerDuration, setSleepTimerDuration] = useState<number | null>(null)
  const [sleepTimerEndsAt, setSleepTimerEndsAt] = useState<number | null>(null)
  const [chapterComplete, setChapterComplete] = useState<{ chapterTitle: string; nextChapter?: string } | null>(null)
  const [bookComplete, setBookComplete] = useState(false)
  const [cinemaMode,     setCinemaMode]     = useState(false)
  const [muteAtmosphere, setMuteAtmosphere] = useState(false)
  const [navVisible,     setNavVisible]     = useState(true)
  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
  const bookmarks = story ? getBookmarks(story.id) : []
  const autoAdvance = prefs.autoAdvance ?? true
  const childMode = prefs.childMode ?? false
  const sleepTimerMinutesLeft = sleepTimerEndsAt
    ? Math.max(1, Math.ceil((sleepTimerEndsAt - Date.now()) / 60000))
    : null
  const currentIsBookmarked = story
    ? isBookmarked(story.id, chapterIdx, sceneIdx, blockIdx)
    : false

  useEffect(() => {
    if (!scene) return
    setExpandedTocScenes(prev => new Set([...Array.from(prev), scene.id]))
  }, [scene?.id])

  useEffect(() => {
    if (!sleepTimerEndsAt) return
    const delay = Math.max(0, sleepTimerEndsAt - Date.now())
    const timeout = window.setTimeout(() => {
      setPlaying(false)
      setSleepTimerDuration(null)
      setSleepTimerEndsAt(null)
    }, delay)
    return () => window.clearTimeout(timeout)
  }, [sleepTimerEndsAt, setPlaying])

  useEffect(() => {
    if (!story || resumeHandled) return
    const progress = getProgress(story.id)
    if (progress && (progress.chapterIdx > 0 || progress.sceneIdx > 0 || progress.blockIdx > 0)) {
      setShowResumePrompt(true)
    }
    setResumeHandled(true)
  }, [story, getProgress, resumeHandled])

  // ── Persist progress ──
  const persistProgress = useCallback((ci: number, si: number, bi: number) => {
    if (!story) return
    saveProgress({
      storyId: story.id,
      chapterIdx: ci,
      sceneIdx: si,
      blockIdx: bi,
      timestamp: Date.now(),
      lastReadAt: new Date().toISOString(),
    })
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
      setChapterComplete({
        chapterTitle: ch.title,
        nextChapter: story.chapters[nc]?.title,
      })
      setChapterIdx(nc); setSceneIdx(0); setBlockIdx(0)
      const b0 = story.chapters[nc]?.scenes[0]?.blocks[0]
      setCurrentBlock(b0?.id ?? null)
      persistProgress(nc, 0, 0)
    } else {
      // Finished
      setPlaying(false)
      setCurrentBlock(null)
      setBookComplete(true)
      saveProgress({
        storyId: story.id,
        chapterIdx,
        sceneIdx,
        blockIdx,
        timestamp: Date.now(),
        lastReadAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      })
    }
  }, [story, chapterIdx, sceneIdx, blockIdx, setCurrentBlock, persistProgress, setPlaying, saveProgress])

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

    const advanceAfterBeat = () => {
      if (!autoAdvance) {
        setPlaying(false)
        return
      }
      timerRef.current = setTimeout(advance, BEAT_GAP_MS / prefs.playbackSpeed)
    }

    // ── Pause block: skip after duration ──
    if (block.type === 'pause') {
      const ms = ((block.duration ?? 1) * 1000 + BEAT_GAP_MS) / prefs.playbackSpeed
      timerRef.current = setTimeout(() => {
        if (autoAdvance) advance()
        else setPlaying(false)
      }, ms)
      return () => { if (timerRef.current) clearTimeout(timerRef.current) }
    }

    // ── SFX block: play audio file if available (no loop, wait for finish) ──
    if (block.type === 'sfx') {
      if (block.audioUrl) {
        const sfxAudio = new Audio(block.audioUrl)
        sfxAudio.loop = false
        sfxAudio.volume = prefs.sfxVolume ?? 1
        sfxAudio.onended = advanceAfterBeat
        sfxAudio.onerror = () => {
          // File missing — fall back to duration timer
          const ms = ((block.duration ?? 1) * 1000 + BEAT_GAP_MS) / prefs.playbackSpeed
          timerRef.current = setTimeout(() => {
            if (autoAdvance) advance()
            else setPlaying(false)
          }, ms)
        }
        audioRef.current = sfxAudio
        sfxAudio.play().catch(() => {
          const ms = ((block.duration ?? 1) * 1000 + BEAT_GAP_MS) / prefs.playbackSpeed
          timerRef.current = setTimeout(() => {
            if (autoAdvance) advance()
            else setPlaying(false)
          }, ms)
        })
        return () => { sfxAudio.pause(); sfxAudio.onended = null; sfxAudio.onerror = null }
      }
      // No audio URL — skip after nominal duration
      const ms = (block.duration ?? 1) * 1000 / prefs.playbackSpeed
      timerRef.current = setTimeout(() => {
        if (autoAdvance) advance()
        else setPlaying(false)
      }, ms)
      return () => { if (timerRef.current) clearTimeout(timerRef.current) }
    }

    // ── Real audio file available → use it ──
    if (block.audioUrl) {
      const audio = new Audio(block.audioUrl)
      audio.playbackRate = Math.min(2, Math.max(0.5, prefs.playbackSpeed))
      // Use narrator volume for narrator-only mode, or narration/quote blocks with no assigned character
      const hasAssignedChar = !!(block as any).characterId
      audio.volume = (block.type === 'narration' || block.type === 'quote') && !hasAssignedChar
        ? prefs.narratorVolume
        : prefs.characterVolume
      audio.onended = advanceAfterBeat
      audio.onerror = advanceAfterBeat   // fallback if file missing
      audioRef.current = audio
      audio.play().catch(advanceAfterBeat)
      return () => {
        audio.pause()
        audio.onended = null
        audio.onerror = null
      }
    }

    // ── No audio file → fall back to Web Speech API ──
    if (!synth) return
    const speakText: string =
      block.type === 'narration' ? stripPerformanceTagsForDisplay((block as any).text) :
      block.type === 'dialogue'  ? stripPerformanceTagsForDisplay((block as any).text) :
      block.type === 'thought'   ? stripPerformanceTagsForDisplay((block as any).text) :
      block.type === 'quote'     ? stripPerformanceTagsForDisplay((block as any).text) : ''

    if (!speakText) { advanceAfterBeat(); return }

    const utter = new SpeechSynthesisUtterance(speakText)
    utter.rate   = Math.min(2, Math.max(0.5, prefs.playbackSpeed))
    // Narrator-only mode — all blocks use narrator volume
    utter.volume = (block.type === 'narration' || story.narratorOnlyMode)
      ? prefs.narratorVolume
      : prefs.characterVolume

    if (voices.length > 0) {
      const speakable = voices.filter(v => v.lang.startsWith('en'))
      const pool = speakable.length > 0 ? speakable : voices
      const blockCharId = (block as any).characterId as string | undefined
      if (story.narratorOnlyMode) {
        // Narrator-only: single voice reads everything
        utter.voice  = pool[0]
        utter.pitch  = 0.88
        utter.volume = prefs.narratorVolume
      } else if (blockCharId) {
        // Any block type with an assigned characterId → use that character's voice slot
        const charList = story.characters.filter(c => c.role === 'character')
        const charPos  = charList.findIndex(c => c.id === blockCharId)
        utter.voice  = pool[(1 + Math.max(0, charPos)) % pool.length]
        utter.pitch  = 0.8 + (Math.max(0, charPos) % 4) * 0.15
        utter.volume = prefs.characterVolume
      } else {
        // No character assigned → narrator voice
        utter.voice  = pool[0]
        utter.pitch  = 0.85
        utter.volume = prefs.narratorVolume
      }
    }

    utter.onend   = advanceAfterBeat
    utter.onerror = advanceAfterBeat
    utterRef.current = utter
    synth.speak(utter)

    return () => { synth.cancel() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, block, prefs.mode, prefs.playbackSpeed, autoAdvance,
      prefs.narratorVolume, prefs.characterVolume, voices, replayNonce])

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
      a.loop   = scene.ambienceLoop !== false   // default: loops
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
      m.loop   = scene.musicLoop !== false   // default: loops
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

  // ── Mute / unmute atmosphere ──
  useEffect(() => {
    if (ambienceRef.current) ambienceRef.current.muted = muteAtmosphere
    if (musicRef.current)    musicRef.current.muted    = muteAtmosphere
  }, [muteAtmosphere])

  // ── Navbar auto-hide during playback ──
  useEffect(() => {
    if (!isPlaying || prefs.mode === 'reading') {
      setNavVisible(true)
      if (navTimerRef.current) clearTimeout(navTimerRef.current)
      return
    }
    // Auto-hide after 3s of playing
    navTimerRef.current = setTimeout(() => setNavVisible(false), 3000)
    return () => { if (navTimerRef.current) clearTimeout(navTimerRef.current) }
  }, [isPlaying, prefs.mode])

  // ── Controlled jumps ──
  const jumpTo = (ci: number, si: number, bi = 0) => {
    const targetBlock = story?.chapters[ci]?.scenes[si]?.blocks[bi]
    setChapterIdx(ci); setSceneIdx(si); setBlockIdx(bi)
    setCurrentBlock(targetBlock?.id ?? null)
    setShowTOC(false)
    setShowBookmarks(false)
    persistProgress(ci, si, bi)
  }

  const pointStartAt = (ci: number, si: number, bi: number) => {
    const wasPlaying = isPlaying
    setPlaying(false)
    synthRef.current?.cancel()
    if (timerRef.current) clearTimeout(timerRef.current)
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.onended = null
      audioRef.current.onerror = null
      audioRef.current = null
    }
    jumpTo(ci, si, bi)
    if (wasPlaying) window.setTimeout(() => setPlaying(true), 0)
  }

  const replayCurrentBeat = () => {
    synthRef.current?.cancel()
    if (timerRef.current) clearTimeout(timerRef.current)
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.onended = null
      audioRef.current.onerror = null
      audioRef.current = null
    }
    setReplayNonce(n => n + 1)
    setPlaying(true)
  }

  const toggleTocScene = (sceneId: string) => {
    setExpandedTocScenes(prev => {
      const next = new Set(prev)
      next.has(sceneId) ? next.delete(sceneId) : next.add(sceneId)
      return next
    })
  }

  const setSleepTimer = (minutes: number | null) => {
    setSleepTimerDuration(minutes)
    setSleepTimerEndsAt(minutes ? Date.now() + minutes * 60_000 : null)
  }

  const continueFromLastStop = () => {
    if (!story) return
    const progress = getProgress(story.id)
    if (!progress) return
    jumpTo(progress.chapterIdx, progress.sceneIdx, progress.blockIdx)
    setShowResumePrompt(false)
  }

  const startOver = () => {
    setBookComplete(false)
    setChapterComplete(null)
    jumpTo(0, 0, 0)
    setShowResumePrompt(false)
  }

  const toggleBookmark = () => {
    if (!story || !chapter || !scene) return
    const existing = bookmarks.find(b =>
      b.chapterIdx === chapterIdx && b.sceneIdx === sceneIdx && b.blockIdx === blockIdx
    )
    if (existing) {
      removeBookmark(story.id, existing.id)
      return
    }

    addBookmark({
      storyId: story.id,
      chapterIdx,
      sceneIdx,
      blockIdx,
      label: `${chapter.title} - ${scene.title} - Beat ${blockIdx + 1}`,
    })
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

  if (serverAccess === null && !isOwned(story.id)) return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const isLastBlock = blockIdx >= blocks.length - 1
    && sceneIdx >= (chapter?.scenes.length ?? 1) - 1
    && chapterIdx >= story.chapters.length - 1
  const isFirstBlock = blockIdx <= 0 && sceneIdx <= 0 && chapterIdx <= 0

  const prevSceneLocation = findPrevSceneLocation(story, chapterIdx, sceneIdx)
  const nextSceneLocation = findNextSceneLocation(story, chapterIdx, sceneIdx)
  const prevSceneLabel = prevSceneLocation && prevSceneLocation.chapterIdx !== chapterIdx ? 'Previous chapter' : 'Previous scene'
  const nextSceneLabel = nextSceneLocation && nextSceneLocation.chapterIdx !== chapterIdx ? 'Next chapter' : 'Next scene'

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
  const totalBeats = story.chapters.reduce((a, c) => a + c.scenes.reduce((b, s) => b + s.blocks.length, 0), 0)
  const completedBeats = story.chapters.reduce((done, ch, ci) => {
    if (ci < chapterIdx) return done + ch.scenes.reduce((n, sc) => n + sc.blocks.length, 0)
    if (ci > chapterIdx) return done
    return done + ch.scenes.reduce((n, sc, si) => si < sceneIdx ? n + sc.blocks.length : n, 0) + blockIdx
  }, 0)
  const currentBeatNumber = totalBeats > 0 ? Math.min(totalBeats, completedBeats + 1) : 0
  const remainingMinutes = story.durationMinutes && totalBeats > 0
    ? Math.max(1, Math.ceil(((totalBeats - completedBeats) / totalBeats) * story.durationMinutes))
    : null

  return (
    <div className={clsx(
      'min-h-screen flex flex-col transition-colors duration-500',
      cinemaMode ? 'bg-black' : 'bg-bg-primary'
    )}>

      {/* ── Top bar ── */}
      {!cinemaMode && (
        <>
          {/* Invisible hover strip — always present, reveals nav when hidden */}
          <div
            className="fixed top-0 left-0 right-0 h-4 z-50 pointer-events-auto"
            onMouseEnter={() => {
              setNavVisible(true)
              if (navTimerRef.current) clearTimeout(navTimerRef.current)
              if (isPlaying && prefs.mode !== 'reading') {
                navTimerRef.current = setTimeout(() => setNavVisible(false), 2500)
              }
            }}
          />

          <header
            className={clsx(
              "fixed top-0 left-0 right-0 z-40 h-12 flex items-center justify-between px-4 bg-bg-secondary/90 backdrop-blur-md border-b border-bg-border transition-all duration-300",
              !navVisible && "opacity-0 -translate-y-full pointer-events-none"
            )}
            onMouseEnter={() => {
              setNavVisible(true)
              if (navTimerRef.current) clearTimeout(navTimerRef.current)
              if (isPlaying && prefs.mode !== 'reading') {
                navTimerRef.current = setTimeout(() => setNavVisible(false), 2500)
              }
            }}
          >
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
          {!childMode && (
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
          )}

          <div className="flex items-center gap-1">
            <button onClick={() => setShowTOC(true)}
              className="btn-ghost px-2 py-1.5 text-text-muted" title="Table of contents">
              <List size={15} />
            </button>
            <button onClick={() => setShowBookmarks(true)}
              className="btn-ghost px-2 py-1.5 text-text-muted" title="Bookmarks">
              <Bookmark size={15} />
            </button>
            <button onClick={toggleBookmark}
              className={clsx('btn-ghost px-2 py-1.5', currentIsBookmarked ? 'text-accent' : 'text-text-muted')}
              title={currentIsBookmarked ? 'Remove bookmark' : 'Bookmark this beat'}>
              {currentIsBookmarked ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
            </button>
            <button onClick={() => setShowSettings(s => !s)}
              className="btn-ghost px-2 py-1.5 text-text-muted" title="Settings">
              <Settings size={15} />
            </button>
          </div>
          </header>
        </>
      )}

      {/* ── Settings panel ── */}
      {/* Resume prompt */}
      {showResumePrompt && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 px-4 pb-4 sm:pb-0">
          <div className="card-elevated w-full max-w-sm p-5 shadow-elevated animate-slide-up space-y-4">
            <div>
              <p className="text-text-primary font-semibold">Resume your Journey?</p>
              <p className="text-text-muted text-xs mt-1">
                You have a saved Moment in this Cast.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={startOver} className="btn-secondary text-sm justify-center">
                <RotateCcw size={13} /> Begin again
              </button>
              <button onClick={continueFromLastStop} className="btn-primary text-sm justify-center">
                <Play size={13} /> Resume
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chapter complete */}
      {chapterComplete && !bookComplete && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 pb-4 sm:pb-0">
          <div className="card-elevated w-full max-w-sm p-5 shadow-elevated animate-slide-up space-y-4">
            <div>
              <p className="text-text-primary font-semibold">Chapter complete</p>
              <p className="text-text-muted text-xs mt-1">{chapterComplete.chapterTitle}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { setPlaying(false); setChapterComplete(null) }}
                className="btn-secondary text-sm justify-center"
              >
                Rest here
              </button>
              <button
                onClick={() => { setChapterComplete(null); setPlaying(true) }}
                className="btn-primary text-sm justify-center"
              >
                <Play size={13} /> Continue Journey
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Book complete */}
      {bookComplete && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 px-4 pb-4 sm:pb-0">
          <div className="card-elevated w-full max-w-sm p-5 shadow-elevated animate-slide-up space-y-4">
            <div>
              <p className="text-text-primary font-semibold">Cast completed</p>
              <p className="text-text-muted text-xs mt-1">You reached the end of {story.title}.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={startOver} className="btn-secondary text-sm justify-center">
                <RotateCcw size={13} /> Begin again
              </button>
              <Link href="/library" className="btn-primary text-sm justify-center">
                <BookOpen size={13} /> My Casts
              </Link>
            </div>
          </div>
        </div>
      )}

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

            {/* Mute scene atmosphere */}
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-text-secondary flex items-center gap-1.5">
                <VolumeX size={11} /> Mute ambience/music
              </span>
              <div onClick={() => setMuteAtmosphere(m => !m)}
                className={clsx(
                  'w-10 h-5 rounded-full transition-colors relative cursor-pointer',
                  muteAtmosphere ? 'bg-danger/70' : 'bg-bg-elevated border border-bg-border'
                )}>
                <span className={clsx(
                  'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                  muteAtmosphere ? 'translate-x-5' : 'translate-x-0.5'
                )} />
              </div>
            </label>

            {/* Auto-advance */}
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-text-secondary flex items-center gap-1.5">
                <FastForward size={11} /> Auto-advance beats
              </span>
              <div onClick={() => setPref('autoAdvance', !autoAdvance)}
                className={clsx(
                  'w-10 h-5 rounded-full transition-colors relative cursor-pointer',
                  autoAdvance ? 'bg-accent' : 'bg-bg-elevated border border-bg-border'
                )}>
                <span className={clsx(
                  'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                  autoAdvance ? 'translate-x-5' : 'translate-x-0.5'
                )} />
              </div>
            </label>

            {/* Child mode */}
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-text-secondary flex items-center gap-1.5">
                <Users size={11} /> Child mode
              </span>
              <div onClick={() => setPref('childMode', !childMode)}
                className={clsx(
                  'w-10 h-5 rounded-full transition-colors relative cursor-pointer',
                  childMode ? 'bg-accent' : 'bg-bg-elevated border border-bg-border'
                )}>
                <span className={clsx(
                  'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                  childMode ? 'translate-x-5' : 'translate-x-0.5'
                )} />
              </div>
            </label>

            {/* Sleep timer */}
            <div>
              <label className="text-text-secondary mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5"><Timer size={11} /> Sleep timer</span>
                <span className="text-text-primary">{sleepTimerMinutesLeft ? `${sleepTimerMinutesLeft}m` : 'Off'}</span>
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { label: 'Off', value: null },
                  { label: '5m', value: 5 },
                  { label: '10m', value: 10 },
                  { label: '15m', value: 15 },
                ].map(option => (
                  <button
                    key={option.label}
                    onClick={() => setSleepTimer(option.value)}
                    className={clsx(
                      'py-1.5 rounded-lg border text-[11px] transition-colors',
                      sleepTimerDuration === option.value
                        ? 'border-accent/40 text-accent bg-accent/10'
                        : 'border-bg-border text-text-muted hover:text-text-primary'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TOC Drawer ── */}
      {showTOC && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowTOC(false)} />
          <div className="relative w-80 max-w-[90vw] bg-bg-secondary h-full ml-0 shadow-elevated flex flex-col animate-slide-down overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-bg-border">
              <div>
                <span className="text-text-primary font-semibold">Start anywhere</span>
                <p className="text-text-muted text-[10px] mt-0.5">Choose a chapter, scene, or exact beat.</p>
              </div>
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
                    const expanded = expandedTocScenes.has(sc.id)
                    return (
                      <div key={sc.id}>
                        <div className={clsx(
                          'flex items-center gap-1 px-5 py-1.5',
                          isCurrent && 'bg-accent/5'
                        )}>
                          <button
                            onClick={() => toggleTocScene(sc.id)}
                            className="text-text-muted hover:text-text-primary p-1"
                            title={expanded ? 'Hide beats' : 'Show beats'}
                          >
                            <ChevronRight size={11} className={clsx('transition-transform', expanded && 'rotate-90')} />
                          </button>
                          <button
                            onClick={() => pointStartAt(ci, si, 0)}
                            className={clsx(
                              'flex-1 text-left text-sm transition-colors truncate',
                              isCurrent ? 'text-accent' : 'text-text-secondary hover:text-text-primary'
                            )}
                          >
                            {sc.title}
                          </button>
                        </div>
                        {expanded && (
                          <div className="pb-1">
                            {sc.blocks.map((tocBlock, bi) => {
                              const isActiveBeat = ci === chapterIdx && si === sceneIdx && bi === blockIdx
                              return (
                                <button
                                  key={tocBlock.id}
                                  onClick={() => pointStartAt(ci, si, bi)}
                                  className={clsx(
                                    'w-full text-left pl-12 pr-4 py-1.5 text-xs transition-colors flex items-center gap-2',
                                    isActiveBeat
                                      ? 'text-accent bg-accent/10'
                                      : 'text-text-muted hover:text-text-secondary hover:bg-bg-elevated'
                                  )}
                                  title="Start from this beat"
                                >
                                  {isActiveBeat && <Play size={10} />}
                                  <span className="truncate">{blockSummary(tocBlock, bi)}</span>
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      {/* Bookmarks drawer */}
      {showBookmarks && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowBookmarks(false)} />
          <div className="relative w-80 max-w-[90vw] bg-bg-secondary h-full ml-0 shadow-elevated flex flex-col animate-slide-down overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-bg-border">
              <span className="text-text-primary font-semibold">Bookmarks</span>
              <button onClick={() => setShowBookmarks(false)} className="text-text-muted hover:text-text-primary">
                <X size={16} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 py-2">
              {bookmarks.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <Bookmark size={24} className="text-text-muted mx-auto mb-2" />
                  <p className="text-text-secondary text-sm">No bookmarks yet</p>
                  <p className="text-text-muted text-xs mt-1">Use the bookmark button in the top bar to save the current beat.</p>
                </div>
              ) : (
                bookmarks.map(bookmark => {
                  const bookmarkChapter = story.chapters[bookmark.chapterIdx]
                  const bookmarkScene = bookmarkChapter?.scenes[bookmark.sceneIdx]
                  return (
                    <div key={bookmark.id} className="group flex items-start gap-2 px-5 py-3 hover:bg-bg-elevated transition-colors">
                      <button
                        onClick={() => pointStartAt(bookmark.chapterIdx, bookmark.sceneIdx, bookmark.blockIdx)}
                        className="flex-1 min-w-0 text-left"
                      >
                        <p className="text-text-primary text-sm font-medium truncate">{bookmark.label}</p>
                        <p className="text-text-muted text-[11px] mt-0.5 truncate">
                          {bookmarkChapter?.title ?? 'Chapter'} - {bookmarkScene?.title ?? 'Scene'}
                        </p>
                      </button>
                      <button
                        onClick={() => removeBookmark(story.id, bookmark.id)}
                        className="text-text-muted hover:text-danger opacity-60 group-hover:opacity-100 transition-opacity p-1"
                        title="Remove bookmark"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      <main className={clsx(
        'flex-1 overflow-y-auto transition-all duration-500',
        cinemaMode ? 'pb-0' : 'pb-32',
        !cinemaMode && 'pt-12'
      )}>
        {cinemaMode ? (
          // ── Cinematic mode ──
          <div className="min-h-screen flex flex-col items-center justify-center px-8 relative">
            {/* Cinematic scene image background */}
            {scene?.sceneImage && (
              <div className="absolute inset-0 z-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={scene.sceneImage} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/70" />
              </div>
            )}
            <button
              onClick={() => { setCinemaMode(false); setMode('reading') }}
              className="absolute top-5 left-5 z-10 text-white/40 hover:text-white transition-colors">
              <X size={18} />
            </button>
            {block && (
              <div className="relative z-10 max-w-2xl w-full text-center animate-fade-in">
                {block.type === 'narration' && (
                  <p className={clsx('text-white/70 italic', `font-${prefs.fontSize}`, 'reader-text text-lg leading-loose')}>
                    {stripPerformanceTagsForDisplay((block as any).text)}
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
                        "{stripPerformanceTagsForDisplay((block as any).text)}"
                      </p>
                    </div>
                  )
                })()}
  
                {block.type === 'quote' && (
                  <div className="text-center">
                    <p className={clsx('text-white/90 font-serif italic text-xl leading-relaxed', `font-${prefs.fontSize}`, 'reader-text')}>
                      "{stripPerformanceTagsForDisplay((block as any).text)}"
                    </p>
                    {(block as any).attribution && (
                      <p className="text-white/40 text-sm mt-4">— {(block as any).attribution}</p>
                    )}
                  </div>
                )}

                {/* Cinematic nav */}
                <div className="flex items-center justify-center gap-6 mt-12">
                  <button
                    onClick={retreat}
                    disabled={isFirstBlock}
                    className="text-white/40 hover:text-white transition-colors disabled:opacity-25 disabled:hover:text-white/40">
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
                  <button
                    onClick={advance}
                    disabled={isLastBlock}
                    className="text-white/40 hover:text-white transition-colors disabled:opacity-25 disabled:hover:text-white/40">
                    <ChevronRight size={28} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          // ── Reading / Audiobook mode ──
          <div className="max-w-2xl mx-auto px-6 py-10">
            {/* Scene image banner */}
            {scene?.sceneImage && (
              <div className="relative -mx-6 -mt-10 mb-8 h-48 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={scene.sceneImage}
                  alt={scene.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-bg-primary" />
                <div className="absolute bottom-0 left-0 right-0 px-6 pb-4">
                  <p className="text-white/60 text-xs uppercase tracking-widest mb-0.5">
                    Chapter {chapterIdx + 1} · Scene {sceneIdx + 1}
                  </p>
                  <h2 className="text-white font-bold text-xl drop-shadow">{scene?.title}</h2>
                </div>
              </div>
            )}
            {/* Scene header (shown only when no image) */}
            {!scene?.sceneImage && (
              <div className="mb-8 pb-6 border-b border-bg-border">
                <p className="text-text-muted text-xs uppercase tracking-widest mb-1">
                  Chapter {chapterIdx + 1} · Scene {sceneIdx + 1}
                </p>
                <h2 className="text-text-primary font-bold text-xl">{scene?.title}</h2>
              </div>
            )}

            {/* Blocks */}
            <div className="space-y-1">
              {blocks.map((b, i) => (
                <div
                  key={b.id}
                  onClick={() => pointStartAt(chapterIdx, sceneIdx, i)}
                  className={clsx(
                    'rounded-lg transition-colors cursor-pointer',
                    i !== blockIdx && 'hover:bg-bg-elevated/50'
                  )}
                  title={isPlaying ? 'Restart playback from this beat' : 'Start from this beat'}
                >
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
                onClick={() => {
                  if (!prevSceneLocation) return
                  jumpTo(prevSceneLocation.chapterIdx, prevSceneLocation.sceneIdx)
                }}
                disabled={!prevSceneLocation}
                className="btn-ghost flex items-center gap-2 disabled:opacity-30">
                <ChevronLeft size={15} /> {prevSceneLabel}
              </button>
              <button
                onClick={() => {
                  if (!nextSceneLocation) return
                  jumpTo(nextSceneLocation.chapterIdx, nextSceneLocation.sceneIdx)
                }}
                disabled={!nextSceneLocation}
                className="btn-ghost flex items-center gap-2 disabled:opacity-30">
                {nextSceneLabel} <ChevronRight size={15} />
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
                {scene?.title}
              </p>
              <p className="text-text-muted text-[10px] truncate">
                {Math.round(progressPct)}% complete - {currentBeatNumber} / {totalBeats} beats
                {remainingMinutes ? ` - about ${remainingMinutes} min left` : ''}
              </p>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={retreat}
                disabled={isFirstBlock}
                className="btn-ghost p-1.5 text-text-muted hover:text-text-primary disabled:opacity-30">
                <Rewind size={16} />
              </button>
              <button
                onClick={replayCurrentBeat}
                className="btn-ghost p-1.5 text-text-muted hover:text-text-primary"
                title="Replay current beat">
                <RotateCcw size={15} />
              </button>
              <button
                onClick={() => setPlaying(!isPlaying)}
                className={clsx(
                  'rounded-full bg-accent hover:bg-accent/80 flex items-center justify-center shadow-accent transition-all',
                  childMode ? 'w-12 h-12' : 'w-9 h-9'
                )}>
                {isPlaying
                  ? <Pause size={childMode ? 20 : 15} className="text-white" />
                  : <Play  size={childMode ? 20 : 15} className="text-white fill-white" />
                }
              </button>
              <button
                onClick={advance}
                disabled={isLastBlock}
                className="btn-ghost p-1.5 text-text-muted hover:text-text-primary disabled:opacity-30">
                <FastForward size={16} />
              </button>
            </div>

            {/* Advance mode */}
            <button
              onClick={() => setPref('autoAdvance', !autoAdvance)}
              className={clsx(
                'hidden sm:flex items-center gap-1 shrink-0 rounded-lg border px-2 py-1 text-[10px] font-medium transition-colors',
                autoAdvance
                  ? 'border-accent/40 bg-accent/10 text-accent'
                  : 'border-bg-border text-text-muted hover:text-text-primary'
              )}
              title={autoAdvance ? 'Auto-advance is on' : 'Manual beat mode is on'}
            >
              <FastForward size={11} />
              {autoAdvance ? 'Auto' : 'Manual'}
            </button>

            {sleepTimerMinutesLeft && (
              <div className="hidden sm:flex items-center gap-1 shrink-0 text-[10px] text-text-muted">
                <Timer size={11} />
                {sleepTimerMinutesLeft}m
              </div>
            )}

            {/* Speed */}
            <div className={clsx('items-center gap-1 shrink-0', childMode ? 'hidden' : 'flex')}>
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
