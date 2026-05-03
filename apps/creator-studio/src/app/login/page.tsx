'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BookOpen, Mic, Music, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-bg-primary flex">
      {/* Left — branding */}
      <div className="hidden lg:flex flex-col justify-between w-[46%] bg-bg-secondary border-r border-bg-border p-12 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -left-40 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-gold/5 rounded-full blur-3xl" />
        </div>

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-9 h-9 bg-accent rounded-xl flex items-center justify-center">
            <BookOpen size={18} className="text-white" />
          </div>
          <span className="font-semibold text-text-primary text-lg tracking-tight">PageCast</span>
          <span className="text-text-muted text-sm">Creator Studio</span>
        </div>

        {/* Center content */}
        <div className="relative z-10 space-y-8">
          <div className="space-y-3">
            <h1 className="text-4xl font-bold text-text-primary leading-tight">
              Where stories<br />find their voice.
            </h1>
            <p className="text-text-secondary text-lg leading-relaxed">
              Create cinematic audio storybooks that readers can read, hear, and experience in the browser.
            </p>
          </div>

          {/* Feature chips */}
          <div className="space-y-3">
            {[
              { icon: BookOpen, label: 'Block-based story editor', color: 'text-accent' },
              { icon: Mic, label: 'AI & recorded voice studio', color: 'text-gold' },
              { icon: Music, label: 'Cinematic sound design', color: 'text-info' },
            ].map(({ icon: Icon, label, color }) => (
              <div key={label} className="flex items-center gap-3 text-text-secondary">
                <Icon size={15} className={color} />
                <span className="text-sm">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Demo story preview card */}
        <div className="relative z-10 card p-4 space-y-3">
          <div className="flex items-center gap-2 text-text-muted text-xs">
            <div className="flex gap-0.5 items-end h-4">
              {[3,5,4,6,3,5,4,3,6,5].map((h, i) => (
                <div key={i} className="waveform-bar" style={{ height: `${h * 2}px`, animationDelay: `${i * 0.1}s` }} />
              ))}
            </div>
            <span>Now playing — The Whispering Forest</span>
          </div>
          <div className="space-y-2">
            <p className="text-text-secondary text-xs italic">The night was silent. Too silent.</p>
            <div className="flex items-start gap-2">
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-accent/20 text-accent-hover shrink-0">Aisha</span>
              <p className="text-text-primary text-xs">&quot;Did you hear that?&quot;</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right — login form */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2 mb-10">
          <div className="w-8 h-8 bg-accent rounded-xl flex items-center justify-center">
            <BookOpen size={16} className="text-white" />
          </div>
          <span className="font-semibold text-text-primary">PageCast</span>
        </div>

        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-1.5">
            <h2 className="text-2xl font-bold text-text-primary">Sign in to Creator Studio</h2>
            <p className="text-text-secondary text-sm">Enter your credentials to continue.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="creator@example.com"
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input pr-10"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-danger text-sm bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-2.5 text-base disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Signing in…</>
                : 'Sign In'
              }
            </button>
          </form>

          {/* Quick-fill for dev testing */}
          <div className="border-t border-bg-border pt-4">
            <p className="text-text-muted text-xs text-center mb-3">Test accounts</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Creator 1', email: 'creator1@pagecast.test' },
                { label: 'Creator 2', email: 'creator2@pagecast.test' },
              ].map(({ label, email: testEmail }) => (
                <button
                  key={testEmail}
                  type="button"
                  onClick={() => { setEmail(testEmail); setPassword('test123') }}
                  className="text-xs text-text-muted hover:text-text-secondary border border-bg-border hover:border-accent/30 rounded-lg px-3 py-2 transition-colors text-left"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <p className="text-text-muted text-xs text-center">
            PageCast Creator Studio — MVP Preview
          </p>
        </div>
      </div>
    </div>
  )
}
