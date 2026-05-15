'use client'
import { useState } from 'react'
import { X, Save, Loader2, Palette } from 'lucide-react'
import { clsx } from 'clsx'
import { STORY_LANGUAGES } from '@/lib/voiceLibrary'
import type { Story } from '@/types'

const GENRES = ['Fantasy', 'Sci-Fi', 'Romance', 'Mystery', 'Thriller', 'Horror',
  "Children's", 'Non-fiction', 'History', 'Poetry', 'Other']
const AGE_RATINGS = ['All ages', '6+', 'Teen+', 'Mature']
const PREF_PRICE_KEY = 'pagecast_default_price'
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
  onSave: (updates: Partial<Story>) => Promise<boolean>
}

function readDefaultPrice(): string {
  if (typeof window === 'undefined') return '4.99'
  const saved = Number(localStorage.getItem(PREF_PRICE_KEY) ?? '')
  return Number.isFinite(saved) && saved > 0 ? saved.toFixed(2) : '4.99'
}

export function BookSettingsPanel({ story, onClose, onSave }: Props) {
  const [genre,     setGenre]     = useState(story.genre     ?? '')
  const [ageRating, setAgeRating] = useState(story.ageRating ?? 'All ages')
  const [estTime,   setEstTime]   = useState(story.durationMinutes?.toString() ?? '')
  const [accessMode, setAccessMode] = useState(story.isFree === false ? 'paid' : 'free')
  const [price,      setPrice]      = useState(story.price > 0 ? story.price.toFixed(2) : readDefaultPrice)
  const [gradient,  setGradient]  = useState(story.coverGradient ?? GRADIENTS[0].value)
  const [emoji,     setEmoji]     = useState((story as any).coverImage ?? '📖')
  const [language,  setLanguage]  = useState(story.language ?? 'en')
  const [desc,      setDesc]      = useState(story.description ?? '')
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    const ok = await onSave({
      genre:           genre || undefined,
      ageRating:       ageRating,
      durationMinutes: estTime ? parseInt(estTime) : undefined,
      coverGradient:   gradient,
      coverImage:      emoji,
      description:     desc,
      language,
      price:           accessMode === 'paid' ? Math.max(0.5, Number(price) || Number(readDefaultPrice())) : 0,
      isFree:          accessMode !== 'paid',
    })
    setSaving(false)
    if (ok) onClose()
    else setError('Could not save Cast settings. Please check your session and try again.')
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
          {error && (
            <div className="rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger">
              {error}
            </div>
          )}

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

          <div>
            <label className="label">Story Language</label>
            <select className="input text-sm" value={language} onChange={e => setLanguage(e.target.value)}>
              {STORY_LANGUAGES.map(lang => (
                <option key={lang.code} value={lang.code}>{lang.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Estimated time</label>
              <input
                type="number" min={1} max={999}
                className="input text-sm"
                value={estTime}
                onChange={e => setEstTime(e.target.value)}
                placeholder="Minutes"
              />
            </div>
            <div>
              <label className="label">Access</label>
              <select
                className="input text-sm"
                value={accessMode}
                onChange={e => {
                  const nextMode = e.target.value
                  setAccessMode(nextMode)
                  if (nextMode === 'paid' && Number(price) <= 0) {
                    setPrice(readDefaultPrice())
                  }
                }}
              >
                <option value="free">Starter Cast</option>
                <option value="paid">Premium Cast</option>
              </select>
            </div>
          </div>

          {accessMode === 'paid' && (
            <div>
              <label className="label">Unlock Price</label>
              <input
                type="number"
                min="0.50"
                step="0.01"
                className="input text-sm"
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder={readDefaultPrice()}
              />
            </div>
          )}

          {accessMode === 'free' && (
            <div className="rounded-lg border border-bg-border bg-bg-elevated px-3 py-2 text-xs text-text-muted">
              Starter Casts can be opened without checkout.
            </div>
          )}

          {accessMode === 'paid' && (
            <div className="rounded-lg border border-gold/25 bg-gold/10 px-3 py-2 text-xs text-text-secondary">
              Premium Casts require unlock before the full Journey opens.
            </div>
          )}

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
