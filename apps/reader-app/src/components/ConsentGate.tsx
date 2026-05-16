'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react'
import { acceptConsents, fetchMissingReaderConsents, RequiredConsent } from '@/lib/supabase/consents'
import { createClient } from '@/lib/supabase/client'

export function ConsentGate() {
  const [missing, setMissing] = useState<RequiredConsent[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    const load = async () => {
      setLoading(true)
      setMissing(await fetchMissingReaderConsents())
      setLoading(false)
    }

    load()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      load()
    })

    return () => subscription.unsubscribe()
  }, [])

  const accept = async () => {
    setSaving(true)
    setError(null)
    const ok = await acceptConsents(missing, 'reader_app_access')
    setSaving(false)
    if (!ok) {
      setError('Could not record consent. Please try again.')
      return
    }
    setMissing([])
  }

  if (loading || !missing.length) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4">
      <section className="card-elevated w-full max-w-lg p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent/15 text-accent flex items-center justify-center shrink-0">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h2 className="text-text-primary font-semibold">Review PageCast terms</h2>
            <p className="text-text-secondary text-sm leading-relaxed mt-1">
              Please accept the current legal documents before continuing with your PageCast account.
            </p>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-danger text-xs">
            <AlertCircle size={13} className="shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        <div className="space-y-2">
          {missing.map(item => (
            <Link key={`${item.type}:${item.version}`} href={item.href} target="_blank" className="flex items-center justify-between gap-3 rounded-lg border border-bg-border bg-bg-elevated/50 px-3 py-2 hover:border-accent/40">
              <div>
                <p className="text-text-primary text-sm font-medium">{item.title}</p>
                <p className="text-text-muted text-xs">Version {item.version}</p>
              </div>
              <CheckCircle2 size={15} className="text-text-muted" />
            </Link>
          ))}
        </div>

        <button className="btn-primary w-full justify-center" onClick={accept} disabled={saving}>
          {saving ? <><Loader2 size={14} className="animate-spin" /> Recording</> : 'Accept and continue'}
        </button>
      </section>
    </div>
  )
}
