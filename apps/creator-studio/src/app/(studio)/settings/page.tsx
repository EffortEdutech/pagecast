'use client'
import { useState } from 'react'
import { useStudioStore } from '@/store/studioStore'
import { Header } from '@/components/layout/Header'
import { Check, Key, User, Globe, BookOpen, Sparkles } from 'lucide-react'

export default function SettingsPage() {
  const creator = useStudioStore(s => s.creator)
  const [saved, setSaved] = useState(false)
  const [ttsKey, setTtsKey] = useState('')
  const [provider, setProvider] = useState('openai')

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <>
      <Header title="Settings" />
      <div className="flex-1 overflow-y-auto p-6 max-w-2xl space-y-6">

        {/* Profile */}
        <section className="card p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <User size={15} className="text-accent" />
            <h2 className="text-text-primary font-semibold">Creator Profile</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Display Name</label>
              <input className="input" defaultValue={creator?.name ?? ''} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" defaultValue={creator?.email ?? ''} disabled />
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
              Your API key is used directly from your browser. PageCast never sees or stores it on our servers. This is the BYO (Bring Your Own) voice model.
            </p>
          </div>
        </section>

        {/* Platform */}
        <section className="card p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Globe size={15} className="text-info" />
            <h2 className="text-text-primary font-semibold">Platform</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Default Language</label>
              <select className="input">
                <option value="en">English</option>
                <option value="ms">Bahasa Melayu</option>
                <option value="ar">Arabic</option>
              </select>
            </div>
            <div>
              <label className="label">Default Story Price ($)</label>
              <input className="input" type="number" min="0" step="0.01" defaultValue="4.99" />
            </div>
          </div>
        </section>

        {/* About */}
        <section className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen size={15} className="text-text-muted" />
            <h2 className="text-text-primary font-semibold">About</h2>
          </div>
          <div className="space-y-1 text-xs text-text-muted">
            <div className="flex justify-between"><span>PageCast Creator Studio</span><span>v0.1.0 MVP</span></div>
            <div className="flex justify-between"><span>Book Format</span><span>PBF v1.0</span></div>
            <div className="flex justify-between"><span>Running on</span><span>localhost:3801</span></div>
          </div>
        </section>

        <div className="flex justify-end pb-6">
          <button className={saved ? 'btn-secondary text-success' : 'btn-primary'} onClick={handleSave}>
            {saved ? <><Check size={15} /> Saved!</> : 'Save Settings'}
          </button>
        </div>
      </div>
    </>
  )
}
