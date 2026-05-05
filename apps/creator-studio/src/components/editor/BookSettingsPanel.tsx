'use client'
import { useState } from 'react'
import { X, Save, Loader2, Palette } from 'lucide-react'
import { clsx } from 'clsx'
import type { Story } from '@/types'

const GENRES = ['Fantasy', 'Sci-Fi', 'Romance', 'Mystery', 'Thriller', 'Horror',
  "Children's", 'Non-fiction', 'History', 'Poetry', 'Other']
const AGE_RATINGS = ['All ages', '6+', 'Teen+', 'Mature']
const GRADIENTS = [
  { label: 'Purple',   value: 'from-purple-900 via-violet-900 to-bg-primary' },
  { label: 'Emerald',  value: 'from-emerald-900 via-teal-900 to-bg-primary' },
  { label: 'Blue',     value: 'from-blue-900 via-cyan-900 to-bg-primary' },
  { label: 'Rose',     value: 'from-rose-900 via-pink-900 to-bg-primary' },
  { label: 'Amber',    value: 'from-amber-900 via-orange-900 to-bg-primary' },
  { label: 'Indigo',   value: 'from-indigo-900 via-blue-900 to-bg-primary' },
  { label: 'Slate',    value: 'from-slate-900 via-gray-900 to-bg-primary' },
  { label: 'Crimson',  value: 'from-red-900 via-rose-900 to-bg-primary' },
]
const EMOJIS = ['📖', '🌲', '🤖', '🌙', '⚔️', '🔮', '🚀', '🐉', '🌺', '🎭', '🗺️', '💫']

interface Props {
  story: Story
  onClose: () => void
  onSave: (updates: Partial<Story>) => Promise<void>
}

export function BookSettingsPanel({ story, onClose, onSave }: Props) {
  const [genre,     setGenre]     = useState(story.genre     ?? '')
  const [ageRating, setAgeRating] = useState(story.ageRating ?? 'All ages')
  const [estTime,   setEstTime]   = useState(story.durationMinutes?.toString() ?? '')
  const [gradient,  setGradient]  = useState(story.coverGradient ?? GRADIENTS[0].value)
  const [emoji,     setEmoji]     = useState((story as any).coverImage ?? '📖')
  const [desc,      setDesc]      = useState(story.description ?? '')
  const [saving,    setSaving]    = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await onSave({
      genre:           genre || undefined,
      ageRating:       ageRating,
      durationMinutes: estTime ? parseInt(estTime) : undefined,
      coverGradient:   gradient,
      coverImage:      emoji,
      description:     desc,
    })
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-80 h-full bg-bg-secondary border-l border-bg-border flex flex-col shadow-elevated animate-slide-down overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-bg-border shrink-0">
          <span className="text-text-primary font-semibold text-sm">Book Settings</span>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Description */}
          <div>
            <label className="label">Description</label>
            <textarea
              className="input resize-none text-sm"
              rows={3}
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="What is this book about?"
            />
          </div>

          {/* Genre + Age Rating */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Genre</label>
              <select className="input text-sm" value={genre} onChange={e => setGenre(e.target.value)}>
                <option value="">— none —</option>
                {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Age Rating</label>
              <select className="input text-sm" value={ageRating} onChange={e => setAgeRating(e.target.value)}>
                {AGE_RATINGS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          {/* Estimated reading time */}
          <div>
            <label className="label">Estimated time (minutes)</label>
            <input
              type="number" min={1} max={999}
              className="input text-sm"
              value={estTime}
              onChange={e => setEstTime(e.target.value)}
              placeholder="e.g. 15"
            />
          </div>

          {/* Cover emoji */}
          <div>
            <label className="label">Cover Icon</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {EMOJIS.map(em => (
                <button key={em}
                  onClick={() => setEmoji(em)}
                  className={clsx(
                    'w-9 h-9 rounded-lg text-xl flex items-center justify-center transition-all',
                    emoji === em ? 'bg-accent/20 ring-2 ring-accent/60 scale-110' : 'bg-bg-elevated hover:bg-bg-hover'
                  )}>
                  {em}
                </button>
              ))}
            </div>
          </div>

          {/* Cover gradient */}
          <div>
            <label className="label flex items-center gap-1.5"><Palette size={11} /> Cover Gradient</label>
            <div className="grid grid-cols-4 gap-2 mt-1">
              {GRADIENTS.map(g => (
                <button key={g.value}
                  onClick={() => setGradient(g.value)}
                  title={g.label}
                  className={clsx(
                    'h-10 rounded-lg transition-all bg-gradient-to-br',
                    g.value,
                    gradient === g.value ? 'ring-2 ring-white/60 scale-105' : 'opacity-70 hover:opacity-100'
                  )}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-bg-border shrink-0">
          <button className="btn-primary w-full justify-center" onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Save size={14} /> Save Settings</>}
          </button>
        </div>
      </div>
    </div>
  )
}
