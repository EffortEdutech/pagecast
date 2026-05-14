const INLINE_PERFORMANCE_TAG_RE = /\s*\[[a-z][a-z\s'-]{0,40}\]\s*/gi
const INLINE_PERFORMANCE_VOCALIZATION_RE = /\s*\|[^|\r\n]{0,120}\|\s*/g

export function stripPerformanceTagsForDisplay(text: string): string {
  return text
    .replace(INLINE_PERFORMANCE_TAG_RE, ' ')
    .replace(INLINE_PERFORMANCE_VOCALIZATION_RE, ' ')
    .replace(/\s+([.,!?;:])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
}
