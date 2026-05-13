'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

const KNOWN_SOURCES = new Set([
  'amazon',
  'direct',
  'facebook',
  'instagram',
  'shopee',
  'tiktok',
  'youtube',
])

export function UtmCapture() {
  const searchParams = useSearchParams()

  useEffect(() => {
    const source = searchParams.get('utm_source')?.toLowerCase().trim()
    if (!source) return

    const normalized = KNOWN_SOURCES.has(source) ? source : source.slice(0, 64)
    localStorage.setItem('pagecast_signup_source', normalized)
  }, [searchParams])

  return null
}
