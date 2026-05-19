const INLINE_PERFORMANCE_TAG_RE = /\s*\[[a-z][a-z\s'-]{0,40}\]\s*/gi
const INLINE_PERFORMANCE_VOCALIZATION_RE = /\s*\|[^|\r\n]{0,120}\|\s*/g
const DISPLAY_SPEECH_PAIR_RE = /\{([^{}\r\n]{1,160})\}\{([^{}\r\n]{1,240})\}/g

function tidyInlineText(text: string): string {
  return text
    .replace(/\s+([.,!?;:])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function stripPerformanceTagsForDisplay(text: string): string {
  return tidyInlineText(text
    .replace(DISPLAY_SPEECH_PAIR_RE, '$1')
    .replace(INLINE_PERFORMANCE_TAG_RE, ' ')
    .replace(INLINE_PERFORMANCE_VOCALIZATION_RE, ' '))
}

export function formatPerformanceTextForSpeech(text: string): string {
  return tidyInlineText(text
    .replace(DISPLAY_SPEECH_PAIR_RE, '$2')
    .replace(INLINE_PERFORMANCE_TAG_RE, ' ')
    .replace(INLINE_PERFORMANCE_VOCALIZATION_RE, ' '))
}
