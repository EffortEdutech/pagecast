'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { saveMarketingConsent } from '@/lib/supabase/preferences'
import { BookOpen, Headphones, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  // NOTE: createClient() is deferred to inside the handler so Next.js prerender
  // (server-side, no env vars) never calls createBrowserClient() and never throws.
  const [tab, setTab] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [countryCode, setCountryCode] = useState('')
  const [regionCode, setRegionCode] = useState('')
  const [ageConfirmation, setAgeConfirmation] = useState('')
  const [marketingOptIn, setMarketingOptIn] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const isDevelopment = process.env.NODE_ENV === 'development'

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    const supabase = createClient()
    const searchParams = new URLSearchParams(window.location.search)
    const next = searchParams.get('next') || '/library'
    const signupSource = searchParams.get('utm_source') || localStorage.getItem('pagecast_signup_source') || undefined

    if (tab === 'login') {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) {
        setError(authError.message)
        setLoading(false)
        return
      }
      router.push(next)
      router.refresh()
    } else {
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: name || email.split('@')[0],
            role: 'reader',
            signup_source: signupSource,
            country_code: countryCode.trim().toUpperCase() || null,
            region_code: regionCode.trim().toUpperCase() || null,
            age_confirmation: ageConfirmation || null,
            marketing_opt_in: marketingOptIn,
            signup_consent_context: 'reader_signup_global',
          },
        },
      })
      if (authError) {
        setError(authError.message)
        setLoading(false)
        return
      }
      await saveMarketingConsent({
        optedIn: marketingOptIn,
        countryCode,
        regionCode,
        source: 'reader_signup',
      })
      setMessage('Check your email for a confirmation link.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center px-4">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-accent/8 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-info/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10 justify-center">
          <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center shadow-accent">
            <BookOpen size={20} className="text-white" />
          </div>
          <div>
            <div className="text-text-primary font-bold text-xl tracking-tight">PageCast</div>
            <div className="text-text-muted text-xs">A world of Tales with voices</div>
          </div>
        </div>

        {/* Card */}
        <div className="card p-8 space-y-6">
          {/* Tabs */}
          <div className="flex bg-bg-elevated rounded-lg p-1 gap-1">
            {(['login', 'signup'] as const).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(''); setMessage('') }}
                className={[
                  'flex-1 py-1.5 rounded-md text-sm font-medium transition-all',
                  tab === t
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-text-muted hover:text-text-secondary',
                ].join(' ')}
              >
                {t === 'login' ? 'Enter' : 'Join'}
              </button>
            ))}
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {tab === 'signup' && (
              <>
                <div>
                  <label className="label">Explorer Name</label>
                  <input
                    type="text"
                    className="input"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Your Explorer name"
                    autoComplete="name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Country</label>
                    <input
                      type="text"
                      className="input uppercase"
                      value={countryCode}
                      onChange={e => setCountryCode(e.target.value)}
                      placeholder="MY"
                      maxLength={2}
                    />
                  </div>
                  <div>
                    <label className="label">Region</label>
                    <input
                      type="text"
                      className="input uppercase"
                      value={regionCode}
                      onChange={e => setRegionCode(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Age confirmation</label>
                  <select className="input" value={ageConfirmation} onChange={e => setAgeConfirmation(e.target.value)} required>
                    <option value="">Select one</option>
                    <option value="adult_or_guardian">I am an adult or have guardian permission</option>
                    <option value="guardian_managed">This account is managed by a parent or guardian</option>
                  </select>
                </div>
                <label className="flex items-start gap-2 text-text-secondary text-xs leading-relaxed">
                  <input
                    type="checkbox"
                    checked={marketingOptIn}
                    onChange={e => setMarketingOptIn(e.target.checked)}
                    className="mt-0.5"
                  />
                  Send me PageCast updates, launch news, and creator recommendations. I can opt out later.
                </label>
              </>
            )}

            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
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
                  autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
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

            {message && (
              <p className="text-success text-sm bg-success/10 border border-success/20 rounded-lg px-3 py-2">
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {tab === 'login' ? 'Signing in…' : 'Creating account…'}</>
                : tab === 'login' ? 'Enter PageCast' : 'Begin Exploring'
              }
            </button>
          </form>

          {isDevelopment && (
            <div className="border-t border-bg-border pt-4">
              <p className="text-text-muted text-xs text-center mb-3">Test accounts (pw: test123)</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Explorer 1', email: 'reader1@pagecast.test' },
                  { label: 'Explorer 2', email: 'reader2@pagecast.test' },
                ].map(({ label, email: testEmail }) => (
                  <button
                    key={testEmail}
                    type="button"
                    onClick={() => { setEmail(testEmail); setPassword('test123'); setTab('login') }}
                    className="text-xs text-text-muted hover:text-text-secondary border border-bg-border hover:border-accent/30 rounded-lg px-3 py-2 transition-colors text-left"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Back to store */}
        <p className="text-center mt-6">
          <Link href="/" className="text-text-muted text-sm hover:text-text-secondary transition-colors flex items-center gap-1.5 justify-center">
            <Headphones size={13} />
            Explore Casts as a Visitor
          </Link>
        </p>
      </div>
    </div>
  )
}
