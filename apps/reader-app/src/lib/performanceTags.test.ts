import { describe, expect, it } from 'vitest'
import { formatPerformanceTextForSpeech, stripPerformanceTagsForDisplay } from './performanceTags'

describe('performance tag formatting', () => {
  it('preserves author-entered line breaks for display text', () => {
    expect(stripPerformanceTagsForDisplay('First line\nSecond line\n\nThird line')).toBe('First line\nSecond line\n\nThird line')
  })

  it('removes inline performance tags without flattening display lines', () => {
    expect(stripPerformanceTagsForDisplay('[whispers] First line\n[laughs] Second line')).toBe('First line\nSecond line')
  })

  it('keeps speech text inline for audio playback', () => {
    expect(formatPerformanceTextForSpeech('First line\nSecond line')).toBe('First line Second line')
  })
})
