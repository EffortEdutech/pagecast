'use client'
import { useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useStudioStore } from '@/store/studioStore'
import { Header } from '@/components/layout/Header'
import {
  Mic, Play, Plus, Check, Trash2, User, Users,
  Wand2, Upload, ChevronDown, Volume2
} from 'lucide-react'
import { clsx } from 'clsx'
import type { VoiceProfile, Character } from '@/types'

const CHARACTER_COLORS = ['#A98BFF', '#4DB8FF', '#F5C842', '#3DD68C', '#F05F6E', '#FF9F43', '#C44AE8', '#48DBFB']

const VOICE_LIBRARY: VoiceProfile[] = [
  { id: 'ai_female_soft',     label: 'Aria — Female Soft',      category: 'female',    gender: 'female' },
  { id: 'ai_female_warm',     label: 'Nova — Female Warm',      category: 'female',    gender: 'female' },
  { id: 'ai_male_deep',       label: 'Atlas — Male Deep',       category: 'male',      gender: 'male' },
  { id: 'ai_male_calm',       label: 'Echo — Male Calm',        category: 'male',      gender: 'male' },
  { id: 'ai_child_female',    label: 'Lily — Child Female',     category: 'child',     gender: 'female' },
  { id: 'ai_child_male',      label: 'Finn — Child Male',       category: 'child',     gender: 'male' },
  { id: 'ai_elder_female',    label: 'Sage — Elder Female',     category: 'elder',     gender: 'female' },
  { id: 'ai_elder_male',      label: 'Croft — Elder Male',      category: 'elder',     gender: 'male' },
  { id: 'ai_villain',         label: 'Void — Villain',          category: 'villain',   gender: 'neutral' },
  { id: 'ai_whisper',         label: 'Hush — Whisper',          category: 'whisper',   gender: 'neutral' },
  { id: 'ai_dramatic',        label: 'Rex — Dramatic',          category: 'dramatic',  gender: 'male' },
  { id: 'ai_cartoon',         label: 'Pip — Cartoon',           category: 'cartoon',   gender: 'neutral' },
  { id: 'ai_robot',           label: 'Core — Robot',            category: 'robot',     gender: 'neutral' },
  { id: 'ai_fantasy',         label: 'Elara — Fantasy',         category: 'fantasy',   gender: 'female' },
]

const CATEGORIES = ['all', 'female', 'male', 'child', 'elder', 'villain', 'whisper', 'dramatic', 'cartoon', 'robot', 'fantasy']

function VoiceCard({ voice, selected, onSelect }: { voice: VoiceProfile; selected: boolean; onSelect: () => void }) {
  const [playing, setPlaying] = useState(false)

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation()
    setPlaying(true)
    setTimeout(() => setPlaying(false), 1500)
  }

  return (
    <div
      onClick={onSelect}
      className={clsx(
        'card p-3 cursor-pointer transition-all duration-150 flex items-center gap-3',
        selected ? 'border-accent/60 bg-accent/10' : 'hover:border-bg-hover hover:bg-bg-elevated'
      )}
    >
      <div className={clsx(
        'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
        selected ? 'bg-accent/30 text-accent' : 'bg-bg-elevated text-text-muted'
      )}>
        <Mic size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-text-primary text-sm font-medium truncate">{voice.label}</div>
        <div className="text-text-muted text-[10px] capitalize">{voice.category}</div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={handlePlay}
          className={clsx('w-7 h-7 rounded-full flex items-center justify-center transition-colors',
            playing ? 'bg-accent text-white' : 'bg-bg-elevated hover:bg-bg-hover text-text-muted hover:text-text-primary'
          )}
        >
          {playing
            ? <span className="flex gap-0.5 items-end h-3">{[3,5,4,3,5].map((h,i) => <span key={i} className="waveform-bar" style={{height:`${h*2}px`,animationDelay:`${i*0.1}s`}} />)}</span>
            : <Play size={10} className="ml-0.5" />
          }
        </button>
        {selected && <Check size={14} className="text-accent" />}
      </div>
    </div>
  )
}

function AddCharacterModal({ storyId, onClose }: { storyId: string; onClose: () => void }) {
  const addCharacter = useStudioStore(s => s.addCharacter)
  const [name, setName] = useState('')
  const [role, setRole] = useState<'character' | 'narrator'>('character')
  const [color, setColor] = useState(CHARACTER_COLORS[0])
  const [voiceId, setVoiceId] = useState('ai_female_soft')

  const voice = VOICE_LIBRARY.find(v => v.id === voiceId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="card-elevated w-full max-w-md p-6 space-y-5 animate-slide-up">
        <div>
          <h2 className="text-text-primary font-bold text-lg">Add Cast Member</h2>
          <p className="text-text-secondary text-sm mt-1">Create a new character or narrator for this story.</p>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Name</label>
              <input className="input" placeholder="e.g. Aisha" value={name} onChange={e => setName(e.target.value)} autoFocus />
            </div>
            <div>
              <label className="label">Role</label>
              <select className="input" value={role} onChange={e => setRole(e.target.value as any)}>
                <option value="character">Character</option>
                <option value="narrator">Narrator</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Color</label>
            <div className="flex gap-2 flex-wrap">
              {CHARACTER_COLORS.map(c => (
                <button
                  key={c}
                  className={clsx('w-7 h-7 rounded-full border-2 transition-all', color === c ? 'border-white scale-110' : 'border-transparent')}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="label">Default Voice</label>
            <select className="input" value={voiceId} onChange={e => setVoiceId(e.target.value)}>
              {VOICE_LIBRARY.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            disabled={!name.trim()}
            onClick={() => {
              addCharacter(storyId, {
                name: name.trim(),
                role,
                displayName: name.trim(),
                color,
                voiceSource: 'ai',
                voiceId,
                voiceLabel: voice?.label,
                defaultVolume: 1,
              })
              onClose()
            }}
          >
            <Plus size={15} /> Add to Cast
          </button>
        </div>
      </div>
    </div>
  )
}

export default function VoicesPage() {
  const { stories, updateCharacter, deleteCharacter } = useStudioStore()
  const [selectedStoryId, setSelectedStoryId] = useState(stories[0]?.id ?? '')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingCharId, setEditingCharId] = useState<string | null>(null)

  const story = stories.find(s => s.id === selectedStoryId)
  const filteredVoices = VOICE_LIBRARY.filter(v => categoryFilter === 'all' || v.category === categoryFilter)

  return (
    <>
      <Header title="Voice Library">
        {story && (
          <button className="btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={15} /> Add Cast Member
          </button>
        )}
      </Header>

      <div className="flex-1 overflow-hidden flex">
        {/* Cast panel */}
        <div className="w-72 shrink-0 border-r border-bg-border overflow-y-auto p-4 space-y-4">
          {/* Story selector */}
          <div>
            <label className="label">Story</label>
            <select className="input text-sm" value={selectedStoryId} onChange={e => setSelectedStoryId(e.target.value)}>
              {stories.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </div>

          {/* Cast */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Cast ({story?.characters.length ?? 0})</label>
            </div>
            <div className="space-y-2">
              {story?.characters.map(char => (
                <div
                  key={char.id}
                  className={clsx(
                    'card p-3 cursor-pointer transition-all',
                    editingCharId === char.id ? 'border-accent/60' : 'hover:border-bg-hover'
                  )}
                  onClick={() => setEditingCharId(char.id === editingCharId ? null : char.id)}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: char.color + '30', color: char.color }}>
                      {char.displayName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-text-primary text-sm font-medium truncate">{char.displayName}</div>
                      <div className="text-text-muted text-[10px] truncate">{char.voiceLabel ?? 'No voice'}</div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); deleteCharacter(selectedStoryId, char.id) }}
                      className="text-text-muted hover:text-danger transition-colors p-0.5"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  {/* Inline voice picker */}
                  {editingCharId === char.id && (
                    <div className="mt-3 pt-3 border-t border-bg-border space-y-2">
                      <p className="text-text-muted text-[10px] uppercase tracking-wide">Assign Voice</p>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {VOICE_LIBRARY.map(v => (
                          <button
                            key={v.id}
                            className={clsx(
                              'flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-xs transition-colors',
                              char.voiceId === v.id
                                ? 'bg-accent/20 text-accent'
                                : 'hover:bg-bg-elevated text-text-secondary'
                            )}
                            onClick={() => updateCharacter(selectedStoryId, char.id, { voiceId: v.id, voiceLabel: v.label })}
                          >
                            {char.voiceId === v.id && <Check size={10} className="shrink-0" />}
                            <span className="truncate">{v.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {(!story || story.characters.length === 0) && (
                <p className="text-text-muted text-xs text-center py-4">No cast members yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* Voice library browser */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <h2 className="text-text-primary font-semibold text-base">Voice Library</h2>
            <p className="text-text-secondary text-sm mt-0.5">Browse and preview AI voice profiles.</p>
          </div>

          {/* Category filter */}
          <div className="flex gap-1.5 flex-wrap">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={clsx(
                  'px-3 py-1 rounded-full text-xs font-medium capitalize transition-all',
                  categoryFilter === cat
                    ? 'bg-accent/20 text-accent border border-accent/30'
                    : 'bg-bg-elevated text-text-secondary hover:text-text-primary border border-bg-border'
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Voice grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredVoices.map(voice => (
              <VoiceCard
                key={voice.id}
                voice={voice}
                selected={story?.characters.some(c => c.voiceId === voice.id) ?? false}
                onSelect={() => {}}
              />
            ))}
          </div>
        </div>
      </div>

      {showAddModal && story && (
        <AddCharacterModal storyId={story.id} onClose={() => setShowAddModal(false)} />
      )}
    </>
  )
}
