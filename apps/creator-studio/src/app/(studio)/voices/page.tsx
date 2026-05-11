'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useStudioStore } from '@/store/studioStore'
import { useBooks } from '@/hooks/useBooks'
import { Header } from '@/components/layout/Header'
import {
  Mic, Play, Square, Plus, Check, Trash2, Loader2, AlertCircle,
  Volume2, Users, Settings2, ChevronRight,
} from 'lucide-react'
import { clsx } from 'clsx'
import {
  fetchCharacters,
  createCharacter as dbCreateCharacter,
  updateCharacter as dbUpdateCharacter,
  deleteCharacter as dbDeleteCharacter,
} from '@/lib/supabase/characters'
import * as BooksApi from '@/lib/supabase/books'
import { CATEGORIES, VOICE_LIBRARY, type PageCastVoiceProfile } from '@/lib/voiceLibrary'
import { getTtsSettings } from '@/lib/tts'
import type { Character } from '@/types'

// ── Voice catalogue ────────────────────────────────────────────────────────────

const CHARACTER_COLORS = ['#A98BFF', '#4DB8FF', '#F5C842', '#3DD68C', '#F05F6E', '#FF9F43', '#C44AE8', '#48DBFB']

interface ProviderVoice {
  id: string
  label: string
  provider: 'elevenlabs'
  category: string
  description?: string
  labels?: Record<string, string>
  previewUrl?: string | null
}

const ELEVENLABS_SAMPLE_TEXT = 'PageCast premium voice sample. Every character deserves a voice that feels truly alive.'

// ── TTS preview parameters ─────────────────────────────────────────────────────

// Resolve best browser voice for gender
const FEMALE_HINTS = ['female', 'woman', 'zira', 'samantha', 'victoria', 'karen', 'moira', 'fiona', 'tessa', 'veena', 'aria', 'jenny', 'sonia', 'libby', 'natasha', 'google uk english female']
const MALE_HINTS   = ['male', 'man', 'david', 'mark', 'alex', 'daniel', 'lee', 'ryan', 'brian', 'guy', 'ravi', 'reed', 'thomas', 'microsoft david', 'google uk english male']

function pickVoice(voices: SpeechSynthesisVoice[], gender: string): SpeechSynthesisVoice | null {
  const eng = voices.filter(v => v.lang.startsWith('en'))
  const pool = eng.length ? eng : voices
  const hints = gender === 'female' ? FEMALE_HINTS : gender === 'male' ? MALE_HINTS : []
  if (hints.length) {
    const match = pool.find(v => hints.some(h => v.name.toLowerCase().includes(h)))
    if (match) return match
  }
  return pool[0] ?? null
}

function previewVoice(voiceId: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const profile = VOICE_LIBRARY.find(v => v.id === voiceId)
  if (!profile) return
  const utterance = new SpeechSynthesisUtterance(profile.sample)
  utterance.pitch  = profile.pitch
  utterance.rate   = profile.rate
  utterance.volume = 1
  const voices = window.speechSynthesis.getVoices()
  const voice  = pickVoice(voices, profile.browserGender)
  if (voice) utterance.voice = voice
  window.speechSynthesis.speak(utterance)
}

// ── Voice card ────────────────────────────────────────────────────────────────

function VoiceCard({ voice, selected, onSelect }: { voice: PageCastVoiceProfile; selected: boolean; onSelect: () => void }) {
  const [playing, setPlaying] = useState(false)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (playing) {
      window.speechSynthesis?.cancel()
      setPlaying(false)
      return
    }
    setPlaying(true)
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setTimeout(() => setPlaying(false), 1800)
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(voice.sample)
    utterance.pitch  = voice.pitch
    utterance.rate   = voice.rate
    utterance.volume = 1
    const voices = window.speechSynthesis.getVoices()
    const bVoice = pickVoice(voices, voice.browserGender)
    if (bVoice) utterance.voice = bVoice
    utterance.onend = () => setPlaying(false)
    utterance.onerror = () => setPlaying(false)
    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }

  return (
    <div
      onClick={onSelect}
      className={clsx(
        'card p-3 cursor-pointer transition-all duration-150 flex items-center gap-3',
        selected ? 'border-accent/60 bg-accent/10' : 'hover:border-bg-hover hover:bg-bg-elevated'
      )}
    >
      <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
        selected ? 'bg-accent/30 text-accent' : 'bg-bg-elevated text-text-muted')}>
        <Mic size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-text-primary text-sm font-medium truncate">{voice.label}</div>
        <div className="text-text-muted text-[10px] capitalize">{voice.category} / OpenAI {voice.openAiVoice}</div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={handlePlay}
          title={playing ? 'Stop' : 'Preview voice'}
          className={clsx('w-7 h-7 rounded-full flex items-center justify-center transition-colors',
            playing ? 'bg-accent text-white' : 'bg-bg-elevated hover:bg-bg-hover text-text-muted')}
        >
          {playing
            ? <Square size={9} className="fill-white" />
            : <Play size={10} className="ml-0.5" />}
        </button>
        {selected && <Check size={14} className="text-accent" />}
      </div>
    </div>
  )
}

function ElevenLabsVoiceCard({
  voice,
  selected,
  sampleUrl,
  loading,
  onSelect,
  onSample,
}: {
  voice: ProviderVoice
  selected: boolean
  sampleUrl?: string
  loading: boolean
  onSelect: () => void
  onSample: () => void
}) {
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const playSample = (e: React.MouseEvent) => {
    e.stopPropagation()

    if (playing) {
      audioRef.current?.pause()
      setPlaying(false)
      return
    }

    const url = sampleUrl ?? voice.previewUrl
    if (!url) {
      onSample()
      return
    }

    const audio = new Audio(url)
    audioRef.current = audio
    audio.onended = () => setPlaying(false)
    audio.onerror = () => setPlaying(false)
    setPlaying(true)
    audio.play().catch(() => setPlaying(false))
  }

  const labelText = Object.entries(voice.labels ?? {})
    .slice(0, 2)
    .map(([key, value]) => `${key}: ${value}`)
    .join(' / ')

  return (
    <div
      onClick={onSelect}
      className={clsx(
        'card p-3 cursor-pointer transition-all duration-150 flex items-center gap-3',
        selected ? 'border-gold/70 bg-gold/10' : 'hover:border-bg-hover hover:bg-bg-elevated'
      )}
    >
      <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
        selected ? 'bg-gold/25 text-gold' : 'bg-bg-elevated text-text-muted')}>
        <Mic size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-text-primary text-sm font-medium truncate">{voice.label}</div>
        <div className="text-text-muted text-[10px] truncate">ElevenLabs / {labelText || voice.category}</div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={playSample}
          title={sampleUrl || voice.previewUrl ? (playing ? 'Stop sample' : 'Play sample') : 'Generate sample'}
          className={clsx('w-7 h-7 rounded-full flex items-center justify-center transition-colors',
            playing ? 'bg-gold text-black' : 'bg-bg-elevated hover:bg-bg-hover text-text-muted')}
        >
          {loading
            ? <Loader2 size={11} className="animate-spin" />
            : playing
              ? <Square size={9} className="fill-current" />
              : <Play size={10} className="ml-0.5" />}
        </button>
        {selected && <Check size={14} className="text-gold" />}
      </div>
    </div>
  )
}

// ── Add character modal ────────────────────────────────────────────────────────

interface AddModalProps {
  storyId: string
  existingCount: number
  elevenVoices: ProviderVoice[]
  sampleUrls: Record<string, string>
  syncingVoices: boolean
  onSyncElevenLabsVoices: () => void
  onGenerateElevenLabsSample: (voice: ProviderVoice) => void
  onAdd: (char: Character) => void
  onClose: () => void
}

function AddCharacterModal({
  storyId,
  existingCount,
  elevenVoices,
  sampleUrls,
  syncingVoices,
  onSyncElevenLabsVoices,
  onGenerateElevenLabsSample,
  onAdd,
  onClose,
}: AddModalProps) {
  const [name,    setName]    = useState('')
  const [role,    setRole]    = useState<'character' | 'narrator'>('character')
  const [color,   setColor]   = useState(CHARACTER_COLORS[existingCount % CHARACTER_COLORS.length])
  const [voiceId, setVoiceId] = useState('ai_female_soft')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const pageCastVoice = VOICE_LIBRARY.find(v => v.id === voiceId)
  const elevenLabsVoice = voiceId.startsWith('elevenlabs:')
    ? elevenVoices.find(v => `elevenlabs:${v.id}` === voiceId)
    : undefined
  const voiceLabel = elevenLabsVoice
    ? `ElevenLabs - ${elevenLabsVoice.label}`
    : pageCastVoice?.label ?? ''

  const handlePreviewVoice = () => {
    if (elevenLabsVoice) {
      const sampleUrl = sampleUrls[elevenLabsVoice.id] ?? elevenLabsVoice.previewUrl
      if (sampleUrl) {
        new Audio(sampleUrl).play().catch(() => {})
      } else {
        onGenerateElevenLabsSample(elevenLabsVoice)
      }
      return
    }
    previewVoice(voiceId)
  }

  const handleAdd = async () => {
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    const newChar = await dbCreateCharacter(storyId, {
      name: name.trim(),
      role,
      displayName: name.trim(),
      color,
      voiceSource: 'ai',
      voiceId,
      voiceLabel,
      defaultVolume: 1,
    }, existingCount)
    if (!newChar) { setError('Failed to save. Check your connection.'); setSaving(false); return }
    onAdd(newChar)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="card-elevated w-full max-w-md p-6 space-y-5">
        <div>
          <h2 className="text-text-primary font-bold text-lg">Add Cast Member</h2>
          <p className="text-text-secondary text-sm mt-1">Create a new character or narrator for this story.</p>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Name</label>
              <input className="input" placeholder="e.g. Maya" value={name}
                onChange={e => setName(e.target.value)} autoFocus
                onKeyDown={e => e.key === 'Enter' && handleAdd()} />
            </div>
            <div>
              <label className="label">Role</label>
              <select className="input" value={role} onChange={e => setRole(e.target.value as 'character' | 'narrator')}>
                <option value="character">Character</option>
                <option value="narrator">Narrator</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">Colour</label>
            <div className="flex gap-2 flex-wrap">
              {CHARACTER_COLORS.map(c => (
                <button key={c}
                  className={clsx('w-7 h-7 rounded-full border-2 transition-all',
                    color === c ? 'border-white scale-110' : 'border-transparent')}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="label">Default Voice</label>
            <div className="flex gap-2">
              <select className="input flex-1" value={voiceId} onChange={e => setVoiceId(e.target.value)}>
                <optgroup label="PageCast / OpenAI presets">
                  {VOICE_LIBRARY.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                </optgroup>
                {elevenVoices.length > 0 && (
                  <optgroup label="ElevenLabs real voices">
                    {elevenVoices.map(v => (
                      <option key={v.id} value={`elevenlabs:${v.id}`}>ElevenLabs - {v.label}</option>
                    ))}
                  </optgroup>
                )}
              </select>
              <button
                type="button"
                title="Preview voice"
                onClick={handlePreviewVoice}
                className="btn-secondary px-3"
              >
                <Play size={13} />
              </button>
            </div>
            <button
              type="button"
              className="btn-ghost mt-2 text-xs px-2 py-1 border border-bg-border hover:border-gold/40 hover:text-gold"
              onClick={onSyncElevenLabsVoices}
              disabled={syncingVoices}
            >
              {syncingVoices ? <Loader2 size={11} className="animate-spin" /> : <Volume2 size={11} />}
              Sync ElevenLabs voices
            </button>
          </div>
        </div>

        {error && (
          <p className="text-danger text-xs flex items-center gap-1.5">
            <AlertCircle size={12} /> {error}
          </p>
        )}

        <div className="flex gap-2 justify-end">
          <button className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn-primary" disabled={!name.trim() || saving} onClick={handleAdd}>
            {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Plus size={15} /> Add to Cast</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function VoicesPage() {
  const { loading: booksLoading } = useBooks()
  const { stories, updateCharacter: storeUpdate, deleteCharacter: storeDelete, addCharacter: storeAdd } = useStudioStore()
  const [selectedStoryId, setSelectedStoryId] = useState('')
  const [categoryFilter,  setCategoryFilter]  = useState('all')
  const [showAddModal,    setShowAddModal]     = useState(false)
  const [editingCharId,   setEditingCharId]    = useState<string | null>(null)
  const [loadingChars,    setLoadingChars]     = useState(false)
  const [savingVoice,     setSavingVoice]      = useState<string | null>(null)
  const [activeTab,       setActiveTab]        = useState<'cast' | 'settings'>('cast')
  const [savingSettings,  setSavingSettings]   = useState(false)
  const [elevenVoices,    setElevenVoices]     = useState<ProviderVoice[]>([])
  const [syncingVoices,   setSyncingVoices]    = useState(false)
  const [voiceSyncError,  setVoiceSyncError]   = useState<string | null>(null)
  const [sampleUrls,      setSampleUrls]       = useState<Record<string, string>>({})
  const [samplingVoiceId, setSamplingVoiceId]  = useState<string | null>(null)

  // Select first story once books load
  useEffect(() => {
    if (!selectedStoryId && stories.length > 0) {
      setSelectedStoryId(stories[0].id)
    }
  }, [stories, selectedStoryId])

  useEffect(() => {
    return () => {
      Object.values(sampleUrls).forEach(url => URL.revokeObjectURL(url))
    }
  }, [sampleUrls])

  const story = stories.find(s => s.id === selectedStoryId)
  const filteredVoices = VOICE_LIBRARY.filter(v => categoryFilter === 'all' || v.category === categoryFilter)
  const providerFilteredVoices = categoryFilter === 'all' ? elevenVoices : []

  // Narrator character for narrator-only mode
  const narratorChar = story?.characters.find(c => c.role === 'narrator')

  // Load characters from Supabase when story changes (only if it's a real UUID)
  useEffect(() => {
    if (!selectedStoryId) return
    // Guard: only call Supabase for UUID-shaped IDs
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRe.test(selectedStoryId)) return
    setLoadingChars(true)
    fetchCharacters(selectedStoryId).then(chars => {
      if (chars.length > 0) {
        useStudioStore.setState(state => ({
          stories: state.stories.map(s =>
            s.id === selectedStoryId ? { ...s, characters: chars } : s
          ),
        }))
      }
      setLoadingChars(false)
    })
  }, [selectedStoryId])

  const handleAddChar = useCallback((char: Character) => {
    storeAdd(selectedStoryId, char)
    useStudioStore.setState(state => ({
      stories: state.stories.map(s => {
        if (s.id !== selectedStoryId) return s
        const chars = [...s.characters]
        chars[chars.length - 1] = char
        return { ...s, characters: chars }
      }),
    }))
  }, [selectedStoryId, storeAdd])

  const handleVoiceChange = useCallback(async (charId: string, voiceId: string, voiceLabel: string) => {
    storeUpdate(selectedStoryId, charId, { voiceId, voiceLabel })
    setSavingVoice(charId)
    await dbUpdateCharacter(charId, { voiceId, voiceLabel })
    setSavingVoice(null)
  }, [selectedStoryId, storeUpdate])

  const syncElevenLabsVoices = useCallback(async () => {
    const { apiKey, provider } = getTtsSettings()
    setVoiceSyncError(null)

    if (!apiKey || provider !== 'elevenlabs') {
      setVoiceSyncError('Choose ElevenLabs in Settings and save your ElevenLabs API key first.')
      return
    }

    setSyncingVoices(true)
    try {
      const res = await fetch('/api/tts/voices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'elevenlabs', apiKey }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? 'Could not sync ElevenLabs voices.')
      setElevenVoices(Array.isArray(body.voices) ? body.voices : [])
    } catch (e: any) {
      setVoiceSyncError(e.message ?? 'Could not sync ElevenLabs voices.')
    } finally {
      setSyncingVoices(false)
    }
  }, [])

  const generateElevenLabsSample = useCallback(async (voice: ProviderVoice) => {
    const { apiKey } = getTtsSettings()
    setVoiceSyncError(null)

    if (!apiKey) {
      setVoiceSyncError('Add your ElevenLabs API key in Settings before generating samples.')
      return
    }

    setSamplingVoiceId(voice.id)
    try {
      const res = await fetch('/api/tts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'elevenlabs',
          apiKey,
          voiceId: `elevenlabs:${voice.id}`,
          voiceLabel: `ElevenLabs - ${voice.label}`,
          text: ELEVENLABS_SAMPLE_TEXT,
          speed: 0.95,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Could not generate sample.')
      }
      const blob = await res.blob()
      setSampleUrls(prev => {
        if (prev[voice.id]) URL.revokeObjectURL(prev[voice.id])
        return { ...prev, [voice.id]: URL.createObjectURL(blob) }
      })
    } catch (e: any) {
      setVoiceSyncError(e.message ?? 'Could not generate sample.')
    } finally {
      setSamplingVoiceId(null)
    }
  }, [])

  const previewCastVoice = useCallback((voiceId?: string) => {
    if (!voiceId) return

    if (voiceId.startsWith('elevenlabs:')) {
      const providerVoiceId = voiceId.slice('elevenlabs:'.length)
      const voice = elevenVoices.find(v => v.id === providerVoiceId)
      if (!voice) {
        setVoiceSyncError('Sync ElevenLabs voices first to preview this cast voice.')
        return
      }

      const sampleUrl = sampleUrls[voice.id] ?? voice.previewUrl
      if (sampleUrl) {
        new Audio(sampleUrl).play().catch(() => {})
      } else {
        generateElevenLabsSample(voice)
      }
      return
    }

    previewVoice(voiceId)
  }, [elevenVoices, sampleUrls, generateElevenLabsSample])

  const handleDelete = useCallback(async (charId: string) => {
    storeDelete(selectedStoryId, charId)
    await dbDeleteCharacter(charId)
    if (editingCharId === charId) setEditingCharId(null)
  }, [selectedStoryId, storeDelete, editingCharId])

  const handleNarratorOnlyToggle = useCallback(async (enabled: boolean) => {
    if (!story) return
    const update = {
      narratorOnlyMode: enabled,
      narratorVoiceId: enabled ? (narratorChar?.voiceId ?? 'ai_narrator_warm') : undefined,
    }
    useStudioStore.setState(state => ({
      stories: state.stories.map(s => s.id === selectedStoryId ? { ...s, ...update } : s),
    }))
    setSavingSettings(true)
    await BooksApi.updateBook(selectedStoryId, update)
    setSavingSettings(false)
  }, [story, selectedStoryId, narratorChar])

  // Loading state
  if (booksLoading && stories.length === 0) {
    return (
      <>
        <Header title="Characters & Voices" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <Loader2 size={24} className="animate-spin text-accent mx-auto" />
            <p className="text-text-muted text-sm">Loading your books…</p>
          </div>
        </div>
      </>
    )
  }

  // No books at all
  if (!booksLoading && stories.length === 0) {
    return (
      <>
        <Header title="Characters & Voices" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 max-w-xs">
            <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto">
              <Users size={24} className="text-accent" />
            </div>
            <div>
              <h3 className="text-text-primary font-semibold">No books yet</h3>
              <p className="text-text-muted text-sm mt-1">Create a book from the Dashboard first, then come back to add your cast.</p>
            </div>
            <a href="/dashboard" className="btn-primary inline-flex">
              <ChevronRight size={15} /> Go to Dashboard
            </a>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Header title="Characters & Voices">
        {story && activeTab === 'cast' && (
          <button className="btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={15} /> Add Cast Member
          </button>
        )}
      </Header>

      <div className="flex-1 overflow-hidden flex">

        {/* ── Left panel: cast + settings ── */}
        <div className="w-72 shrink-0 border-r border-bg-border flex flex-col overflow-hidden">

          {/* Story selector */}
          <div className="p-4 border-b border-bg-border">
            <label className="label">Story</label>
            <select className="input text-sm" value={selectedStoryId}
              onChange={e => { setSelectedStoryId(e.target.value); setEditingCharId(null) }}>
              {stories.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </div>

          {/* Tab bar */}
          <div className="flex border-b border-bg-border">
            {(['cast', 'settings'] as const).map(tab => (
              <button key={tab}
                onClick={() => setActiveTab(tab)}
                className={clsx(
                  'flex-1 py-2 text-xs font-medium capitalize transition-colors flex items-center justify-center gap-1.5',
                  activeTab === tab
                    ? 'text-accent border-b-2 border-accent bg-accent/5'
                    : 'text-text-muted hover:text-text-primary'
                )}>
                {tab === 'cast' ? <Users size={12} /> : <Settings2 size={12} />}
                {tab}
              </button>
            ))}
          </div>

          {/* Cast tab */}
          {activeTab === 'cast' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              <div className="flex items-center justify-between mb-1">
                <span className="label mb-0">
                  Cast {loadingChars ? <Loader2 size={10} className="inline animate-spin ml-1" /> : `(${story?.characters.length ?? 0})`}
                </span>
              </div>

              {story?.characters.map(char => (
                <div key={char.id}
                  className={clsx('card p-3 cursor-pointer transition-all',
                    editingCharId === char.id ? 'border-accent/60' : 'hover:border-bg-hover')}
                  onClick={() => setEditingCharId(char.id === editingCharId ? null : char.id)}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ backgroundColor: char.color + '30', color: char.color }}>
                      {char.displayName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-text-primary text-sm font-medium truncate">{char.displayName}</div>
                      <div className="text-text-muted text-[10px] flex items-center gap-1">
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-medium capitalize"
                          style={{ backgroundColor: char.color + '20', color: char.color }}>
                          {char.role}
                        </span>
                        <span className="truncate">{char.voiceLabel || 'No voice'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={e => { e.stopPropagation(); previewCastVoice(char.voiceId) }}
                        className="text-text-muted hover:text-accent transition-colors p-0.5"
                        title="Preview voice"
                      >
                        <Volume2 size={11} />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(char.id) }}
                        className="text-text-muted hover:text-danger transition-colors p-0.5"
                        title="Remove"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>

                  {/* Inline voice picker */}
                  {editingCharId === char.id && (
                    <div className="mt-3 pt-3 border-t border-bg-border space-y-1">
                      <p className="text-text-muted text-[10px] uppercase tracking-wide font-medium">Assign Voice</p>
                      <div className="max-h-44 overflow-y-auto space-y-0.5">
                        {VOICE_LIBRARY.map(v => (
                          <button key={v.id}
                            className={clsx(
                              'flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-xs transition-colors',
                              char.voiceId === v.id
                                ? 'bg-accent/20 text-accent font-medium'
                                : 'hover:bg-bg-elevated text-text-secondary'
                            )}
                            onClick={e => { e.stopPropagation(); handleVoiceChange(char.id, v.id, v.label) }}
                          >
                            {savingVoice === char.id && char.voiceId === v.id
                              ? <Loader2 size={10} className="animate-spin shrink-0" />
                              : char.voiceId === v.id
                                ? <Check size={10} className="shrink-0 text-accent" />
                                : <span className="w-2.5 shrink-0" />
                            }
                            <span className="truncate flex-1">{v.label}</span>
                            <button
                              onClick={e2 => { e2.stopPropagation(); previewVoice(v.id) }}
                              className="text-text-muted hover:text-accent p-0.5"
                              title="Preview"
                            >
                              <Play size={8} />
                            </button>
                          </button>
                        ))}
                        {elevenVoices.length > 0 && (
                          <div className="pt-2 mt-2 border-t border-bg-border">
                            <p className="px-2 pb-1 text-[9px] uppercase tracking-wide text-gold font-medium">ElevenLabs</p>
                            {elevenVoices.map(v => {
                              const id = `elevenlabs:${v.id}`
                              return (
                                <button key={v.id}
                                  className={clsx(
                                    'flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-xs transition-colors',
                                    char.voiceId === id
                                      ? 'bg-gold/20 text-gold font-medium'
                                      : 'hover:bg-bg-elevated text-text-secondary'
                                  )}
                                  onClick={e => { e.stopPropagation(); handleVoiceChange(char.id, id, `ElevenLabs - ${v.label}`) }}
                                >
                                  {savingVoice === char.id && char.voiceId === id
                                    ? <Loader2 size={10} className="animate-spin shrink-0" />
                                    : char.voiceId === id
                                      ? <Check size={10} className="shrink-0 text-gold" />
                                      : <span className="w-2.5 shrink-0" />
                                  }
                                  <span className="truncate flex-1">{v.label}</span>
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {(!story || story.characters.length === 0) && !loadingChars && (
                <div className="text-center py-6 space-y-2">
                  <p className="text-text-muted text-xs">No cast members yet.</p>
                  {story && (
                    <button className="btn-secondary text-xs" onClick={() => setShowAddModal(true)}>
                      <Plus size={11} /> Add first character
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Settings tab */}
          {activeTab === 'settings' && story && (
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* Narrator-only mode */}
              <div className="card p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-text-primary text-sm font-medium">Narrator-Only Mode</div>
                    <div className="text-text-muted text-[11px] mt-0.5 leading-relaxed">
                      One narrator voice reads the entire book, including all dialogue. Great for audiobook style.
                    </div>
                  </div>
                  <button
                    onClick={() => handleNarratorOnlyToggle(!story.narratorOnlyMode)}
                    className={clsx(
                      'relative w-10 h-5.5 rounded-full transition-colors shrink-0 mt-0.5',
                      story.narratorOnlyMode ? 'bg-accent' : 'bg-bg-elevated border border-bg-border'
                    )}
                    style={{ height: '22px', minWidth: '40px' }}
                  >
                    <span className={clsx(
                      'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                      story.narratorOnlyMode ? 'translate-x-5' : 'translate-x-0.5'
                    )} />
                    {savingSettings && <Loader2 size={10} className="absolute inset-0 m-auto animate-spin text-accent" />}
                  </button>
                </div>

                {story.narratorOnlyMode && narratorChar && (
                  <div className="bg-accent/10 rounded-lg p-3 space-y-2">
                    <p className="text-accent text-[11px] font-medium">Narrator voice active</p>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                        style={{ backgroundColor: narratorChar.color + '30', color: narratorChar.color }}>
                        {narratorChar.displayName.charAt(0)}
                      </div>
                      <span className="text-text-secondary text-xs flex-1">{narratorChar.displayName} &mdash; {narratorChar.voiceLabel}</span>
                      <button
                        onClick={() => previewCastVoice(narratorChar.voiceId)}
                        className="text-text-muted hover:text-accent transition-colors"
                        title="Preview narrator voice"
                      >
                        <Volume2 size={12} />
                      </button>
                    </div>
                    <p className="text-text-muted text-[10px]">
                      To change the narrator voice, go to the Cast tab and update the Narrator character.
                    </p>
                  </div>
                )}

                {story.narratorOnlyMode && !narratorChar && (
                  <div className="bg-warning/10 rounded-lg p-3">
                    <p className="text-warning text-[11px]">
                      No Narrator character found. Add a cast member with role “Narrator” to use this mode.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'settings' && !story && (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-text-muted text-xs">Select a story above.</p>
            </div>
          )}
        </div>

        {/* ── Voice library browser ── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="flex justify-end">
            <button
              className="btn-secondary text-xs"
              onClick={syncElevenLabsVoices}
              disabled={syncingVoices}
              title="Load real voices from your ElevenLabs account"
            >
              {syncingVoices ? <Loader2 size={12} className="animate-spin" /> : <Volume2 size={12} />}
              Sync ElevenLabs
            </button>
          </div>

          {voiceSyncError && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs">
              <AlertCircle size={13} /> {voiceSyncError}
            </div>
          )}
          <div>
            <h2 className="text-text-primary font-semibold text-base">Voice Library</h2>
            <p className="text-text-secondary text-sm mt-0.5">
              Click ▶ to preview any voice using your browser’s built-in text-to-speech.
              {editingCharId ? ' Click a voice to assign it to the selected cast member.' : ' Select a cast member on the left first.'}
            </p>
          </div>

          <div className="flex gap-1.5 flex-wrap">
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setCategoryFilter(cat)}
                className={clsx('px-3 py-1 rounded-full text-xs font-medium capitalize transition-all',
                  categoryFilter === cat
                    ? 'bg-accent/20 text-accent border border-accent/30'
                    : 'bg-bg-elevated text-text-secondary hover:text-text-primary border border-bg-border'
                )}>
                {cat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredVoices.map(voice => {
              const assignedChar = story?.characters.find(c => c.voiceId === voice.id)
              return (
                <div key={voice.id} className="relative">
                  <VoiceCard
                    voice={voice}
                    selected={!!assignedChar}
                    onSelect={() => {
                      if (editingCharId) {
                        handleVoiceChange(editingCharId, voice.id, voice.label)
                      }
                    }}
                  />
                  {assignedChar && (
                    <div className="absolute top-1.5 right-8 px-1.5 py-0.5 rounded-full text-[9px] font-medium"
                      style={{ backgroundColor: assignedChar.color + '30', color: assignedChar.color }}>
                      {assignedChar.displayName}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {providerFilteredVoices.length > 0 && (
            <div className="space-y-3 pt-3 border-t border-bg-border">
              <div>
                <h3 className="text-text-primary font-semibold text-sm">ElevenLabs Voices</h3>
                <p className="text-text-muted text-xs mt-0.5">These are real voices from your ElevenLabs account. Samples are generated with ElevenLabs audio.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {providerFilteredVoices.map(voice => {
                  const id = `elevenlabs:${voice.id}`
                  const assignedChar = story?.characters.find(c => c.voiceId === id)
                  return (
                    <div key={voice.id} className="relative">
                      <ElevenLabsVoiceCard
                        voice={voice}
                        selected={!!assignedChar}
                        sampleUrl={sampleUrls[voice.id]}
                        loading={samplingVoiceId === voice.id}
                        onSample={() => generateElevenLabsSample(voice)}
                        onSelect={() => {
                          if (editingCharId) {
                            handleVoiceChange(editingCharId, id, `ElevenLabs - ${voice.label}`)
                          }
                        }}
                      />
                      {assignedChar && (
                        <div className="absolute top-1.5 right-8 px-1.5 py-0.5 rounded-full text-[9px] font-medium"
                          style={{ backgroundColor: assignedChar.color + '30', color: assignedChar.color }}>
                          {assignedChar.displayName}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {showAddModal && story && (
        <AddCharacterModal
          storyId={story.id}
          existingCount={story.characters.length}
          elevenVoices={elevenVoices}
          sampleUrls={sampleUrls}
          syncingVoices={syncingVoices}
          onSyncElevenLabsVoices={syncElevenLabsVoices}
          onGenerateElevenLabsSample={generateElevenLabsSample}
          onAdd={handleAddChar}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </>
  )
}
