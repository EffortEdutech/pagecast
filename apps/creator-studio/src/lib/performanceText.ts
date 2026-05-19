const DISPLAY_SPEECH_PAIR_RE = /\{([^{}\r\n]{1,160})\}\{([^{}\r\n]{1,240})\}/g

export function formatTextForTts(text: string): string {
  return text
    .replace(DISPLAY_SPEECH_PAIR_RE, '$2')
    .replace(/\s{2,}/g, ' ')
    .trim()
}
