/**
 * lib/ttsRateLimit.ts
 * Per-provider throttling for background TTS generation, so a "Generate All
 * Missing" run never trips 429s from ElevenLabs / Gemini / OpenAI.
 *
 * Numbers below are deliberately conservative defaults, not the provider's
 * actual ceiling — they're safe for the LOWEST published tier of each
 * provider, since we can't know the user's account tier from the client.
 *
 *   ElevenLabs — gates by concurrent requests, not RPM. Free tier = 2
 *     concurrent, Starter = 3, Creator = 5, Pro = 10, Scale/Business = 15.
 *     We default to the Free-tier-safe value of 2.
 *   Gemini TTS (Flash-family) — free tier is ~10 RPM / 250 RPD. We stay
 *     under that with 8 RPM (one request every 7.5s) and 2 concurrent.
 *   OpenAI TTS — no official published per-key TTS RPM, so we use a
 *     moderate default (5 concurrent, ~40 RPM) rather than the much higher
 *     ceilings some accounts actually have.
 *
 * These are overridable — see PROVIDER_LIMIT_OVERRIDES_LS — so a user on a
 * higher paid tier can loosen them from Settings without a code change.
 */

import type { TtsProvider } from './tts'

export interface ProviderLimit {
  /** Max requests allowed to be in-flight at the same time. */
  concurrency: number
  /** Minimum ms between the *start* of consecutive requests for this provider. */
  minIntervalMs: number
}

export const DEFAULT_PROVIDER_LIMITS: Record<TtsProvider, ProviderLimit> = {
  elevenlabs: { concurrency: 2, minIntervalMs: 1200 },
  gemini:     { concurrency: 2, minIntervalMs: 7500 }, // ~8 RPM
  openai:     { concurrency: 5, minIntervalMs: 1500 }, // ~40 RPM
}

const OVERRIDES_LS = 'pagecast_tts_rate_limit_overrides'

export function getProviderLimits(): Record<TtsProvider, ProviderLimit> {
  if (typeof window === 'undefined') return DEFAULT_PROVIDER_LIMITS
  try {
    const raw = localStorage.getItem(OVERRIDES_LS)
    if (!raw) return DEFAULT_PROVIDER_LIMITS
    const parsed = JSON.parse(raw) as Partial<Record<TtsProvider, Partial<ProviderLimit>>>
    return {
      elevenlabs: { ...DEFAULT_PROVIDER_LIMITS.elevenlabs, ...parsed.elevenlabs },
      gemini:     { ...DEFAULT_PROVIDER_LIMITS.gemini,     ...parsed.gemini },
      openai:     { ...DEFAULT_PROVIDER_LIMITS.openai,     ...parsed.openai },
    }
  } catch {
    return DEFAULT_PROVIDER_LIMITS
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Sliding-window + concurrency limiter for one provider. Call `acquire()`
 * before making a request and invoke the returned release function when
 * the request settles (success or failure).
 */
export class ProviderRateLimiter {
  private inFlight = 0
  private lastStart = 0

  constructor(private limit: ProviderLimit) {}

  updateLimit(limit: ProviderLimit) {
    this.limit = limit
  }

  async acquire(shouldAbort?: () => boolean): Promise<() => void> {
    for (;;) {
      if (shouldAbort?.()) throw new RateLimitAbort()
      const now = Date.now()
      const sinceLast = now - this.lastStart
      const spacingOk = sinceLast >= this.limit.minIntervalMs
      const concurrencyOk = this.inFlight < this.limit.concurrency
      if (spacingOk && concurrencyOk) {
        this.inFlight++
        this.lastStart = Date.now()
        return () => { this.inFlight = Math.max(0, this.inFlight - 1) }
      }
      await sleep(Math.min(250, this.limit.minIntervalMs))
    }
  }
}

export class RateLimitAbort extends Error {
  constructor() { super('Run cancelled while waiting for a rate-limit slot.') }
}

/** One limiter instance per provider, shared across a single queue run. */
export function createRateLimiters(): Record<TtsProvider, ProviderRateLimiter> {
  const limits = getProviderLimits()
  return {
    elevenlabs: new ProviderRateLimiter(limits.elevenlabs),
    gemini:     new ProviderRateLimiter(limits.gemini),
    openai:     new ProviderRateLimiter(limits.openai),
  }
}

/** Exponential backoff schedule for 429 / rate-limit errors: 2s, 5s, 15s. */
export const RETRY_BACKOFF_MS = [2000, 5000, 15000]

export function isRateLimitError(message: string | null | undefined): boolean {
  if (!message) return false
  return /\b429\b/.test(message) || /rate.?limit/i.test(message) || /too many requests/i.test(message)
}
