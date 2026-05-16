'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Settings, ShieldCheck, X } from 'lucide-react'

type CookieChoice = {
  necessary: true
  analytics: boolean
  marketing: boolean
  region: string
  acceptedAt: string
}

const STORAGE_KEY = 'pagecast_cookie_preferences_v1'

function getBrowserRegion() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || 'global'
  } catch {
    return 'global'
  }
}

export function RegionalPrivacyBanner() {
  const [open, setOpen] = useState(false)
  const [customizing, setCustomizing] = useState(false)
  const [analytics, setAnalytics] = useState(false)
  const [marketing, setMarketing] = useState(false)

  useEffect(() => {
    setOpen(!localStorage.getItem(STORAGE_KEY))
  }, [])

  const save = (choice: Pick<CookieChoice, 'analytics' | 'marketing'>) => {
    const payload: CookieChoice = {
      necessary: true,
      analytics: choice.analytics,
      marketing: choice.marketing,
      region: getBrowserRegion(),
      acceptedAt: new Date().toISOString(),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    setOpen(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-[70] px-4 pb-4">
      <section className="mx-auto max-w-3xl card-elevated border border-bg-border p-4 shadow-elevated">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-accent/15 text-accent flex items-center justify-center shrink-0">
            <ShieldCheck size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-text-primary font-semibold text-sm">Privacy preferences</h2>
                <p className="text-text-secondary text-xs leading-relaxed mt-1">
                  PageCast uses necessary storage for sign-in, purchases, and reading progress. Optional analytics and marketing preferences help us improve and promote Casts worldwide.
                </p>
              </div>
              <button className="text-text-muted hover:text-text-primary" onClick={() => save({ analytics: false, marketing: false })}>
                <X size={16} />
              </button>
            </div>

            {customizing && (
              <div className="grid sm:grid-cols-2 gap-3 mt-4">
                <label className="flex items-start gap-2 rounded-lg border border-bg-border bg-bg-elevated/50 p-3 text-xs text-text-secondary">
                  <input type="checkbox" checked disabled className="mt-0.5" />
                  <span><span className="text-text-primary font-medium block">Necessary</span>Account, access, checkout, and security functions.</span>
                </label>
                <label className="flex items-start gap-2 rounded-lg border border-bg-border bg-bg-elevated/50 p-3 text-xs text-text-secondary">
                  <input type="checkbox" checked={analytics} onChange={event => setAnalytics(event.target.checked)} className="mt-0.5" />
                  <span><span className="text-text-primary font-medium block">Analytics</span>Product usage and reliability insights.</span>
                </label>
                <label className="flex items-start gap-2 rounded-lg border border-bg-border bg-bg-elevated/50 p-3 text-xs text-text-secondary sm:col-span-2">
                  <input type="checkbox" checked={marketing} onChange={event => setMarketing(event.target.checked)} className="mt-0.5" />
                  <span><span className="text-text-primary font-medium block">Marketing</span>Campaign attribution and promotional measurement.</span>
                </label>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4">
              <Link href="/legal/privacy" className="text-accent hover:text-accent/80 text-xs">Privacy Policy</Link>
              <div className="flex flex-wrap gap-2">
                <button className="btn-secondary text-xs h-9" onClick={() => setCustomizing(!customizing)}>
                  <Settings size={13} />
                  Preferences
                </button>
                <button className="btn-secondary text-xs h-9" onClick={() => save({ analytics: false, marketing: false })}>
                  Necessary only
                </button>
                <button className="btn-primary text-xs h-9" onClick={() => save({ analytics: true, marketing: true })}>
                  Accept all
                </button>
                {customizing && (
                  <button className="btn-primary text-xs h-9" onClick={() => save({ analytics, marketing })}>
                    Save choices
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
