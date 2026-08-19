/**
 * lib/imageRateLimit.ts
 * Throttling for Gemini image generation — intentionally separate from
 * lib/ttsRateLimit.ts (different quota track: Google meters image and
 * text/TTS generation independently, and product decision keeps image
 * generation infra fully independent from audio generation infra).
 *
 * Default: Tier 1 (billing linked) Gemini image generation is ~1,000
 * requests/day and 10 images/minute. We stay under that with roughly
 * 9/minute and no concurrency (image generation + server-side reference
 * fetch is already a heavier request than TTS; running them serially keeps
 * behaviour predictable).
 */

export interface ImageRateLimitConfig {
  concurrency: number
  minIntervalMs: number
}

export const DEFAULT_IMAGE_RATE_LIMIT: ImageRateLimitConfig = {
  concurrency: 1,
  minIntervalMs: 6500, // ~9 images/min, under Gemini Tier 1's 10 IPM cap
}

const OVERRIDE_LS = 'pagecast_image_rate_limit_override'

export function getImageRateLimit(): ImageRateLimitConfig {
  if (typeof window === 'undefined') return DEFAULT_IMAGE_RATE_LIMIT
  try {
    const raw = localStorage.getItem(OVERRIDE_LS)
    if (!raw) return DEFAULT_IMAGE_RATE_LIMIT
    const parsed = JSON.parse(raw) as Partial<ImageRateLimitConfig>
    return { ...DEFAULT_IMAGE_RATE_LIMIT, ...parsed }
  } catch {
    return DEFAULT_IMAGE_RATE_LIMIT
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export class ImageRateLimiter {
  private inFlight = 0
  private lastStart = 0

  constructor(private limit: ImageRateLimitConfig) {}

  async acquire(shouldAbort?: () => boolean): Promise<() => void> {
    for (;;) {
      if (shouldAbort?.()) throw new ImageRateLimitAbort()
      const now = Date.now()
      const spacingOk = now - this.lastStart >= this.limit.minIntervalMs
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

export class ImageRateLimitAbort extends Error {
  constructor() { super('Run cancelled while waiting for a rate-limit slot.') }
}

export const IMAGE_RETRY_BACKOFF_MS = [3000, 8000, 20000]

export function isImageRateLimitError(message: string | null | undefined): boolean {
  if (!message) return false
  return /\b429\b/.test(message) || /rate.?limit/i.test(message) || /resource_exhausted/i.test(message) || /too many requests/i.test(message)
}
