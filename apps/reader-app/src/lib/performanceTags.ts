const INLINE_PERFORMANCE_TAG_RE = /\s*\[[a-z][a-z\s'-]{0,40}\]\s*/gi
const INLINE_DISPLAY_PERFORMANCE_TAG_RE = /[^\S\r\n]*\[[a-z][a-z \t'-]{0,40}\][^\S\r\n]*/gi
const INLINE_PERFORMANCE_VOCALIZATION_RE = /\s*\|[^|\r\n]{0,120}\|\s*/g
const INLINE_DISPLAY_PERFORMANCE_VOCALIZATION_RE = /[^\S\r\n]*\|[^|\r\n]{0,120}\|[^\S\r\n]*/g
const DISPLAY_SPEECH_PAIR_RE = /\{([^{}\r\n]{1,160})\}\{([^{}\r\n]{1,240})\}/g

function tidyInlineText(text: string): string {
  return text
    .replace(/\s+([.,!?;:])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

function tidyDisplayText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(line => line
      .replace(/[ \t]+([.,!?;:])/g, '$1')
      .replace(/[ \t]{2,}/g, ' ')
      .trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function stripPerformanceTagsForDisplay(text: string): string {
  return tidyDisplayText(text
    .replace(DISPLAY_SPEECH_PAIR_RE, '$1')
    .replace(INLINE_DISPLAY_PERFORMANCE_TAG_RE, ' ')
    .replace(INLINE_DISPLAY_PERFORMANCE_VOCALIZATION_RE, ' '))
}

export function formatPerformanceTextForSpeech(text: string): string {
  return tidyInlineText(text
    .replace(DISPLAY_SPEECH_PAIR_RE, '$2')
    .replace(INLINE_PERFORMANCE_TAG_RE, ' ')
    .replace(INLINE_PERFORMANCE_VOCALIZATION_RE, ' '))
}
