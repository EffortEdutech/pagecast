'use client'
import { useState, useEffect } from 'react'
import { useUser } from '@/hooks/useUser'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import { Check, Key, User, BookOpen, Sparkles, AlertCircle, Loader2, Zap, Rocket } from 'lucide-react'
import { GEMINI_TTS_MODELS, TTS_GEMINI_MODEL_LS, getTtsApiKey, getTtsSettings, saveTtsSettings, normalizeGeminiTtsModel } from '@/lib/tts'

const PREF_LANGUAGE_KEY = 'pagecast_default_language'
const PREF_PRICE_KEY    = 'pagecast_default_price'

type GuestCastOption = {
  id: string
  title: string
  genre: string | null
  language: string | null
  guest_access: boolean
  guest_access_rank: number | null
}

export default function SettingsPage() {
  const { user, displayName, email } = useUser()
  const supabase = createClient()

  const [name,     setName]     = useState('')
  const [language, setLanguage] = useState('en')
  const [price,    setPrice]    = useState('4.99')
  const [ttsKey,   setTtsKey]   = useState('')
  const [provider, setProvider] = useState<'openai' | 'elevenlabs' | 'gemini'>('openai')
  const [geminiModel, setGeminiModel] = useState(GEMINI_TTS_MODELS[0].id)
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [charsUsed,  setCharsUsed]  = useState<number | null>(null)
  const [charsLimit, setCharsLimit] = useState<number>(100000)
  const [isAdmin, setIsAdmin] = useState(false)
  const [guestCasts, setGuestCasts] = useState<GuestCastOption[]>([])
  const [guestCastIds, setGuestCastIds] = useState<string[]>([])
  const [guestLoading, setGuestLoading] = useState(false)
  const [guestSaving, setGuestSaving] = useState(false)
  const [guestSaved, setGuestSaved] = useState(false)
  const [guestError, setGuestError] = useState<string | null>(null)

  useEffect(() => { if (displayName) setName(displayName) }, [displayName])

  // Load TTS credit usage from profile
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('tts_chars_used, tts_chars_limit')
        .eq('id', data.user.id)
        .single()
      if (profile) {
        setCharsUsed(profile.tts_chars_used ?? 0)
        setCharsLimit(profile.tts_chars_limit ?? 100000)
      }
    })
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const lang       = localStorage.getItem(PREF_LANGUAGE_KEY)
    const savedPrice = localStorage.getItem(PREF_PRICE_KEY)
    if (lang)       setLanguage(lang)
    if (savedPrice) setPrice(savedPrice)
    const tts = getTtsSettings()
    if (tts.provider) setProvider(tts.provider)
    setGeminiModel(tts.geminiModel)
    setTtsKey(tts.apiKey)
  }, [])

  useEffect(() => {
    setTtsKey(getTtsApiKey(provider))
  }, [provider])

  useEffect(() => {
    if (!user) return

    let cancelled = false
    setGuestLoading(true)
    setGuestError(null)

    fetch('/api/admin/guest-casts')
      .then(async res => {
        if (res.status === 401 || res.status === 403) {
          if (!cancelled) setIsAdmin(false)
          return null
        }

        const payload = await res.json()
        if (!res.ok) throw new Error(payload?.error ?? 'Failed to load reader shelf.')
        return payload
      })
      .then(payload => {
        if (cancelled || !payload) return

        const casts = (payload.casts ?? []) as GuestCastOption[]
        setIsAdmin(true)
        setGuestCasts(casts)
        setGuestCastIds(
          casts
            .filter(cast => cast.guest_access)
            .sort((a, b) => (a.guest_access_rank ?? 99) - (b.guest_access_rank ?? 99))
            .map(cast => cast.id)
            .slice(0, 3)
        )
      })
      .catch(err => {
        if (!cancelled) {
          setIsAdmin(true)
          setGuestError(err instanceof Error ? err.message : 'Failed to load reader shelf.')
        }
      })
      .finally(() => {
        if (!cancelled) setGuestLoading(false)
      })

    return () => { cancelled = true }
  }, [user])

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    try {
      const { error: authErr } = await supabase.auth.updateUser({
        data: { display_name: name.trim() || displayName },
      })
      if (authErr) throw new Error('Failed to save display name: ' + authErr.message)

      localStorage.setItem(PREF_LANGUAGE_KEY, language)
      localStorage.setItem(PREF_PRICE_KEY, price)
      saveTtsSettings(ttsKey.trim(), provider)
      localStorage.setItem(TTS_GEMINI_MODEL_LS, normalizeGeminiTtsModel(geminiModel))

      if (isAdmin) {
        const guestSavedOk = await saveGuestCasts(false)
        if (!guestSavedOk) throw new Error('Settings saved, but the reader shelf could not be saved.')
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings.')
    } finally {
      setSaving(false)
    }
  }

  const handleGuestSlotChange = (index: number, castId: string) => {
    setGuestCastIds(current => {
      const next = [...current]
      next[index] = castId
      return [...new Set(next.filter(Boolean))].slice(0, 3)
    })
  }

  const saveGuestCasts = async (showSavedState = true): Promise<boolean> => {
    setGuestSaving(true)
    setGuestSaved(false)
    setGuestError(null)

    try {
      const castIds = guestCastIds.filter(Boolean).slice(0, 3)
      const res = await fetch('/api/admin/guest-casts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ castIds }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload?.error ?? 'Failed to save reader shelf.')

      setGuestCastIds(castIds)
      setGuestCasts(current => current.map(cast => {
        const rank = castIds.indexOf(cast.id)
        return {
          ...cast,
          guest_access: rank >= 0,
          guest_access_rank: rank >= 0 ? rank + 1 : null,
        }
      }))
      if (showSavedState) {
        setGuestSaved(true)
        setTimeout(() => setGuestSaved(false), 2500)
      }
      return true
    } catch (err) {
      setGuestError(err instanceof Error ? err.message : 'Failed to save reader shelf.')
      return false
    } finally {
      setGuestSaving(false)
    }
  }

  const handleSaveGuestCasts = () => {
    void saveGuestCasts()
  }

  return (
    <>
      <Header title="Settings" />
      <div className="flex-1 overflow-y-auto p-4 space-y-6 sm:p-6 md:max-w-2xl">

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm">
            <AlertCircle size={15} /> {error}
          </div>
        )}

        {/* Profile */}
        <section className="card p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <User size={15} className="text-accent" />
            <h2 className="text-text-primary font-semibold">Creator Profile</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Display Name</label>
              <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Your display name" />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" value={email} disabled />
            </div>
          </div>
        </section>

        {/* TTS */}
        <section className="card p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Key size={15} className="text-gold" />
            <h2 className="text-text-primary font-semibold">AI Voice (TTS) Provider</h2>
          </div>
          <p className="text-text-secondary text-sm">
            Connect your own TTS API key. PageCast supports OpenAI and ElevenLabs. Your key is stored locally in your browser only.
          </p>
          <div>
            <label className="label">Provider</label>
            <select className="input max-w-xs" value={provider} onChange={e => setProvider(e.target.value as 'openai' | 'elevenlabs' | 'gemini')}>
              <option value="openai">OpenAI TTS</option>
              <option value="elevenlabs">ElevenLabs v3</option>
              <option value="gemini">Google / Gemini TTS</option>
            </select>
          </div>
          <div>
            <label className="label">API Key</label>
            <input
              className="input max-w-md font-mono text-sm"
              type="password"
              placeholder={
                provider === 'openai'
                  ? 'sk-...'
                  : provider === 'elevenlabs'
                    ? 'Your ElevenLabs API key'
                    : 'Your Google AI Studio / Gemini API key'
              }
              value={ttsKey}
              onChange={e => setTtsKey(e.target.value)}
            />
          </div>
          {provider === 'gemini' && (
            <div>
              <label className="label">Gemini TTS Model</label>
              <select
                className="input max-w-md"
                value={geminiModel}
                onChange={e => setGeminiModel(normalizeGeminiTtsModel(e.target.value))}
              >
                {GEMINI_TTS_MODELS.map(model => (
                  <option key={model.id} value={model.id}>{model.label}</option>
                ))}
              </select>
              <p className="mt-1 text-[10px] text-text-muted max-w-md">
                {GEMINI_TTS_MODELS.find(model => model.id === geminiModel)?.description}
              </p>
            </div>
          )}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-accent/10 border border-accent/20">
            <Sparkles size={14} className="text-accent shrink-0 mt-0.5" />
            <p className="text-text-secondary text-xs leading-relaxed">
              Your API key is sent directly from your browser to the TTS provider via a server-side proxy route. It is never stored in the database.
            </p>
          </div>

          {/* ── TTS Credit Meter ── */}
          {charsUsed !== null && (
            <div className="space-y-1.5 pt-1 border-t border-bg-border/50">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-text-secondary font-medium">
                  <Zap size={11} className="text-gold" /> Characters generated (this account)
                </span>
                <span className="text-text-muted font-mono text-[11px]">
                  {charsUsed.toLocaleString()} / {charsLimit.toLocaleString()}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-bg-border overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    charsUsed / charsLimit > 0.9 ? 'bg-danger'
                    : charsUsed / charsLimit > 0.7 ? 'bg-warning'
                    : 'bg-gold'
                  }`}
                  style={{ width: `${Math.min(100, (charsUsed / charsLimit) * 100).toFixed(1)}%` }}
                />
              </div>
              <p className="text-[10px] text-text-muted">
                {Math.max(0, charsLimit - charsUsed).toLocaleString()} characters remaining · resets manually by admin · ~5 chars per word
              </p>
            </div>
          )}
        </section>

        {/* Cast settings */}
        <section className="card p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <BookOpen size={15} className="text-info" />
            <h2 className="text-text-primary font-semibold">Cast Settings</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Default Language</label>
              <select className="input" value={language} onChange={e => setLanguage(e.target.value)}>
                <option value="en">English</option>
                <option value="id">Indonesian</option>
                <option value="ms">Malay</option>
                <option value="ar">Arabic</option>
                <option value="fr">French</option>
                <option value="es">Spanish</option>
                <option value="de">German</option>
              </select>
            </div>
            <div>
              <label className="label">Default Price</label>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                placeholder="4.99"
                value={price}
                onChange={e => setPrice(e.target.value)}
              />
              <p className="mt-1 text-[10px] text-text-muted">
                Used when a new Premium Cast is created.
              </p>
            </div>
          </div>

          {isAdmin && (
            <div className="pt-4 mt-2 border-t border-bg-border/60 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-2">
                  <Rocket size={15} className="text-success mt-0.5" />
                  <div>
                    <h3 className="text-text-primary font-semibold text-sm">Reader Start Free Shelf</h3>
                    <p className="text-text-secondary text-xs mt-1">
                      Choose up to 3 published Starter Casts for visitors. Rotate these to test different Cast styles and grow subscribers.
                    </p>
                  </div>
                </div>
                {guestLoading && <Loader2 size={15} className="animate-spin text-text-muted shrink-0" />}
              </div>

              {guestError && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs">
                  <AlertCircle size={13} /> {guestError}
                </div>
              )}

              <div className="grid gap-3">
                {[0, 1, 2].map(index => {
                  const selectedInOtherSlots = new Set(
                    guestCastIds.filter((id, slot) => id && slot !== index)
                  )

                  return (
                    <div key={index} className="grid gap-2 sm:grid-cols-[72px_1fr] sm:items-center">
                      <label className="label mb-0">Slot {index + 1}</label>
                      <select
                        className="input"
                        value={guestCastIds[index] ?? ''}
                        onChange={e => handleGuestSlotChange(index, e.target.value)}
                        disabled={guestLoading || guestSaving}
                      >
                        <option value="">No Cast selected</option>
                        {guestCasts.map(cast => (
                          <option key={cast.id} value={cast.id} disabled={selectedInOtherSlots.has(cast.id)}>
                            {cast.title}{cast.language ? ` (${cast.language.toUpperCase()})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )
                })}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  className="btn-secondary min-w-32 justify-center"
                  onClick={handleSaveGuestCasts}
                  disabled={guestLoading || guestSaving}
                >
                  {guestSaving ? <><Loader2 size={14} className="animate-spin" /> Saving...</> :
                   guestSaved  ? <><Check size={14} /> Saved!</> :
                   'Save Free Shelf'}
                </button>
                <span className="text-text-muted text-xs">
                  {guestCastIds.filter(Boolean).length}/3 visitor Casts selected.
                </span>
              </div>
            </div>
          )}
        </section>

        {/* Save */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            className="btn-primary min-w-32 justify-center"
            onClick={handleSave}
            disabled={saving || guestSaving}
          >
            {saving  ? <><Loader2 size={14} className="animate-spin" /> Saving…</> :
             saved   ? <><Check   size={14} /> Saved!</>                            :
             'Save Cast Settings'}
          </button>
          {saved && <p className="text-success text-sm">Changes saved successfully.</p>}
        </div>
      </div>
    </>
  )
}
