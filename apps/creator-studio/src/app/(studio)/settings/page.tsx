'use client'
import { useState, useEffect } from 'react'
import { useUser } from '@/hooks/useUser'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/Header'
import { Check, Key, User, Globe, BookOpen, Sparkles, AlertCircle } from 'lucide-react'
import { getTtsSettings, saveTtsSettings } from '@/lib/tts'

const PREF_LANGUAGE_KEY = 'pagecast_default_language'
const PREF_PRICE_KEY    = 'pagecast_default_price'

export default function SettingsPage() {
  const { displayName, email } = useUser()
  const supabase = createClient()

  const [name, setName]         = useState('')
  const [language, setLanguage] = useState('en')
  const [price, setPrice]       = useState('4.99')
  const [ttsKey, setTtsKey]     = useState('')
  const [provider, setProvider] = useState('openai')
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [error, setError]       = useState<string | null>(null)

  // Seed state once displayName is available
  useEffect(() => {
    if (displayName) setName(displayName)
  }, [displayName])

  // Load persisted prefs from localStorage
  useEffect(() => {
    const lang       = localStorage.getItem(PREF_LANGUAGE_KEY)
    const savedPrice = localStorage.getItem(PREF_PRICE_KEY)
    if (lang)       setLanguage(lang)
    if (savedPrice) setPrice(savedPrice)

    const tts = getTtsSettings()
    if (tts.apiKey)   setTtsKey(tts.apiKey)
    if (tts.provider) setProvider(tts.provider)
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    // 1 — Update display name in Supabase auth metadata
    const { error: authErr } = await supabase.auth.updateUser({
      data: { display_name: name.trim() || displayName },
    })

    if (authErr) {
      setError('Failed to save display name: ' + authErr.message)
      setSaving(false)
      return
    }

    // 2 — Persist language + price defaults locally
    localStorage.setItem(PREF_LANGUAGE_KEY, language)
    localStorage.setItem(PREF_PRICE_KEY, price)

    // 3 — Persist TTS key + provider locally
    saveTtsSettings(ttsKey.trim(), provider)

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <>
      <Header title="Settings" />
      <div className="flex-1 overflow-y-auto p-6 max-w-2xl space-y-6">

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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Display Name</label>
              <input
                className="input"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your display name"
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" value={email} disabled />
            </div>
          </div>
        </section>

        {/* TTS API Keys */}
        <section className="card p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Key size={15} className="text-gold" />
            <h2 className="text-text-primary font-semibold">AI Voice (TTS) Provider</h2>
          </div>
          <p className="text-text-secondary text-sm">
            Connect your own TTS API key. PageCast supports OpenAI, ElevenLabs, and Google TTS. Your key is stored locally.
          </p>
          <div>
            <label className="label">Provider</label>
            <select className="input max-w-xs" value={provider} onChange={e => setProvider(e.target.value)}>
              <option value="openai">OpenAI TTS</option>
              <option value="elevenlabs">ElevenLabs</option>
              <option value="google">Google TTS</option>
            </select>
          </div>
          <div>
            <label className="label">API Key</label>
            <input
              className="input max-w-md font-mono text-sm"
              type="password"
              placeholder={`Your ${provider === 'openai' ? 'OpenAI' : provider === 'elevenlabs' ? 'ElevenLabs' : 'Google'} API key`}
              value={ttsKey}
              onChange={e => setTtsKey(e.target.value)}
            />
          </div>
          <div className="flex items-start gap-2 p-3 rounded-lg bg-accent/10 border border-accent/20">
            <Sparkles size={14} className="text-accent shrink-0 mt-0.5" />
            <p className="text-text-secondary text-xs leading-relaxed">
              Your API key is used directly from your bro