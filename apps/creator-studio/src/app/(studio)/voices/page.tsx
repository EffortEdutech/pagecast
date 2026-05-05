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
import type { VoiceProfile, Character } from '@/types'

// ── Voice catalogue ────────────────────────────────────────────────────────────

const VOICE_LIBRARY: VoiceProfile[] = [
  // Narrator
  { id: 'ai_narrator_warm', label: 'Sage — Warm Narrator',    category: 'narrator', gender: 'neutral' },
  { id: 'ai_narrator_deep', label: 'Reed — Deep Narrator',    category: 'narrator', gender: 'neutral' },
  // Female
  { id: 'ai_female_soft',   label: 'Aria — Female Soft',      category: 'female',   gender: 'female'  },
  { id: 'ai_female_warm',   label: 'Nova — Female Warm',      category: 'female',   gender: 'female'  },
  // Male
  { id: 'ai_male_deep',     label: 'Atlas — Male Deep',       category: 'male',     gender: 'male'    },
  { id: 'ai_male_calm',     label: 'Echo — Male Calm',        category: 'male',     gender: 'male'    },
  { id: 'ai_male_gruff',    label: 'Croft — Male Gruff',      category: 'male',     gender: 'male'    },
  // Child
  { id: 'ai_child_female',  label: 'Lily — Child Female',     category: 'child',    gender: 'female'  },
  { id: 'ai_child_male',    label: 'Finn — Child Male',       category: 'child',    gender: 'male'    },
  // Elder
  { id: 'ai_elder_female',  label: 'Sage — Elder Female',     category: 'elder',    gender: 'female'  },
  { id: 'ai_elder_male',    label: 'Croft — Elder Male',      category: 'elder',    gender: 'male'    },
  // Special
  { id: 'ai_villain',       label: 'Void — Villain',          category: 'villain',  gender: 'neutral' },
  { id: 'ai_whisper',       label: 'Hush — Whisper',          category: 'whisper',  gender: 'neutral' },
  { id: 'ai_dramatic',      label: 'Rex — Dramatic',          category: 'dramatic', gender: 'male'    },
  { id: 'ai_cartoon',       label: 'Pip — Cartoon',           category: 'cartoon',  gender: 'neutral' },
  { id: 'ai_robot',         label: 'Core — Robot',            category: 'robot',    gender: 'neutral' },
  { id: 'ai_fantasy',       label: 'Elara — Fantasy',         category: 'fantasy',  gender: 'female'  },
]

const CATEGORIES = ['all', 'narrator', 'female', 'male', 'child', 'elder', 'villain', 'whisper', 'dramatic', 'cartoon', 'robot', 'fantasy']
const CHARACTER_COLORS = ['#A98BFF', '#4DB8FF', '#F5C842', '#3DD68C', '#F05F6E', '#FF9F43', '#C44AE8', '#48DBFB']

// ── TTS preview parameters ─────────────────────────────────────────────────────

interface TtsParams { pitch: number; rate: number; gender: string; sample: string }

const VOICE_TTS: Record<string, TtsParams> = {
  ai_narrator_warm: { pitch: 1.05, rate: 0.9,  gender: 'female', sample: 'In a land far away, a great story was about to begin.' },
  ai_narrator_deep: { pitch: 0.8,  rate: 0.85, gender: 'male',   sample: 'The tale unfolds. Listen carefully, for every word matters.' },
  ai_female_soft:   { pitch: 1.2,  rate: 0.9,  gender: 'female', sample: 'The moon rose gently over the still, silver water.' },
  ai_female_warm:   { pitch: 1.1,  rate: 1.0,  gender: 'female', sample: 'Welcome! I am so glad you are here with me today.' },
  ai_male_deep:     { pitch: 0.7,  rate: 0.9,  gender: 'male',   sample: 'The fortress had stood for a thousand years, unmoved.' },
  ai_male_calm:     { pitch: 0.9,  rate: 0.95, gender: 'male',   sample: 'Take a breath. Everything is going to be alright.' },
  ai_male_gruff:    { pitch: 0.65, rate: 0.92, gender: 'male',   sample: 'Listen up. I am only going to say this once.' },
  ai_child_female:  { pitch: 1.5,  rate: 1.1,  gender: 'female', sample: 'Oh! Did you see that? A butterfly! Come look!' },
  ai_child_male:    { pitch: 1.4,  rate: 1.1,  gender: 'male',   sample: 'Race you to the big oak tree! Last one is a rotten egg!' },
  ai_elder_female:  { pitch: 1.0,  rate: 0.85, gender: 'female', sample: 'Child, sit with me. Let me tell you about the old days.' },
  ai_elder_male:    { pitch: 0.8,  rate: 0.85, gender: 'male',   sample: 'In my time, we walked ten miles. And we were grateful.' },
  ai_villain:       { pitch: 0.6,  rate: 0.85, gender: 'male',   sample: 'You cannot stop what has already begun. It is too late.' },
  ai_whisper:       { pitch: 1.0,  rate: 0.8,  gender: 'female', sample: 'Quiet now... can you hear that? Something is near.' },
  ai_dramatic:      { pitch: 0.85, rate: 1.1,  gender: 'male',   sample: 'This is the moment everything changes, forever!' },
  ai_cartoon:       { pitch: 1.6,  rate: 1.2,  gender: 'neutral',sample: 'Wheee! Let us go on an adventure, pals!' },
  ai_robot:         { pitch: 0.5,  rate: 0.9,  gender: 'neutral',sample: 'Initiating story sequence. Narrative data loaded.' },
  ai_fantasy:       { pitch: 1.3,  rate: 0.95, gender: 'female', sample: 'The ancient magic stirs. The old prophecy awakens.' },
}

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
  const params = VOICE_TTS[voiceId]
  if (!params) return
  const utterance = new SpeechSynthesisUtterance(params.sample)
  utterance.pitch  = params.pitch
  utterance.rate   = params.rate
  utterance.volume = 1
  const voices = window.speechSynthesis.getVoices()
  const voice  = pickVoice(voices, params.gender)
  if (voice) utterance.voice = voice
  window.speechSynthesis.speak(utterance)
}

// ── Voice card ────────────────────────────────────────────────────────────────

function VoiceCard({ voice, selected, onSelect }: { voice: VoiceProfile; selected: boolean; onSelect: () => void }) {
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
    const params = VOICE_TTS[voice.id]
    if (!params || typeof window === 'undefined' || !window.speechSynthesis) {
      setTimeout(() => setPlaying(false), 1800)
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(params.sample)
    utterance.pitch  = params.pitch
    utterance.rate   = params.rate
    utterance.volume = 1
    const voices = window.speechSynthesis.getVoices()
    const bVoice = pickVoice(voices, params.gender)
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
        <div className="text-text-muted text-[10px] capitalize">{voice.category}</div>
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

// ── Add character modal ────────────────────────────────────────────────────────

interface AddModalProps {
  storyId: string
  existingCount: number
  onAdd: (char: Character) => void
  onClose: () => void
}

function AddCharacterModal({ storyId, existingCount, onAdd, onClose }: AddModalProps) {
  const [name,    setName]    = useState('')
  const [role,    setRole]    = useState<'character' | 'narrator'>('character')
  const [color,   setColor]   = useState(CHARACTER_COLORS[existingCount % CHARACTER_COLORS.length])
  const [voiceId, setVoiceId] = useState('ai_female_soft')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const voice = VOICE_LIBRARY.find(v => v.id === voiceId)

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
      voiceLabel: voice?.label ?? '',
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
                {VOICE_LIBRARY.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
              <button
                type="button"
                title="Preview voice"
                onClick={() => previewVoice(voiceId)}
                className="btn-secondary px-3"
              >
                <Play size={13} />
              </button>
            </div>
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

  // Select first story once books load
  useEffect(() => {
    if (!selectedStoryId && stories.length > 0) {
      setSelectedStoryId(stories[0].id)
    }
  }, [stories, selectedStoryId])

  const story = stories.find(s => s.id === selectedStoryId)
  const filteredVoices = VOICE_LIBRARY.filter(v => categoryFilter === 'all' || v.category === categoryFilter)

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
                        onClick={e => { e.stopPropagation(); if (char.voiceId) previewVoice(char.voiceId) }}
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
                        onClick={() => narratorChar.voiceId && previewVoice(narratorChar.voiceId)}
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
        </div>
      </div>

      {showAddModal && story && (
        <AddCharacterModal
          storyId={story.id}
          existingCount={story.characters.length}
          onAdd={handleAddChar}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </>
  )
}
