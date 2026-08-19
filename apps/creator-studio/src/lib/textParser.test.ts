import { describe, expect, it } from 'vitest'
import {
  formatParsedImportAsPageCastText, normalizeImportedText, parseText,
  concatenatePageCastFiles, isPageCastFile, guessVoiceId, hexForColorWord,
} from './textParser'

describe('normalizeImportedText', () => {
  it('normalizes common paste and PDF extraction artifacts', () => {
    expect(normalizeImportedText('\uFEFFOne-\r\ntwo\u00A0  three\r\n\r\n\r\n\r\nfour')).toBe('Onetwo three\n\n\nfour')
  })
})

describe('parseText', () => {
  it('splits prose into chapters, scenes, narration, dialogue, pauses, and sfx', () => {
    const result = parseText([
      'Chapter 1',
      '',
      'Scene 1',
      '',
      'Mira opened the blue door. "Are you there?"',
      '',
      '[pause: 1.5s]',
      '',
      '[SFX: thunder clap]',
    ].join('\n'), 'prose')

    const blocks = result.chapters[0].scenes[0].blocks

    expect(result.stats).toMatchObject({
      chapters: 1,
      scenes: 1,
      blocks: 4,
      dialogues: 1,
      narrations: 1,
    })
    expect(blocks.map(block => block.type)).toEqual(['narration', 'dialogue', 'pause', 'sfx'])
    expect(blocks[1]).toMatchObject({ type: 'dialogue', text: 'Are you there?', characterId: '' })
    expect(blocks[2]).toMatchObject({ type: 'pause', duration: 1.5 })
    expect(blocks[3]).toMatchObject({ type: 'sfx', label: 'thunder clap', sfxFile: 'thunder-clap.mp3' })
  })

  it('parses PageCast tagged text and preserves dialogue emotion metadata', () => {
    const result = parseText([
      '::PAGECAST_BOOK',
      'Title: Test',
      '::',
      '# Chapter One',
      '## First Scene',
      '[NARRATION]',
      'The room listened.',
      '[DIALOGUE | emotion=scared]',
      '"Do not open it."',
    ].join('\n'), 'auto')

    expect(result.format).toBe('pagecast')
    expect(result.chapters[0].title).toBe('Chapter One')
    expect(result.chapters[0].scenes[0].title).toBe('First Scene')
    expect(result.chapters[0].scenes[0].blocks).toMatchObject([
      { type: 'narration', text: 'The room listened.' },
      { type: 'dialogue', text: 'Do not open it.', emotion: 'scared' },
    ])
  })
})

describe('parsePageCast cast/meta capture', () => {
  const oneFile = [
    '::PAGECAST_BOOK',
    'Title: Kampung Awan Club',
    'Author: pageCast Studios',
    'Language: en',
    'Genre: Children\'s Fantasy Comedy',
    'Default Narrator: narrator',
    '::',
    '',
    '::CAST',
    'Narrator: narrator | role=narrator | voice=warm_adult_female | color=amber',
    'Nino: nino | role=main_character | voice=young_boy_confident | color=teal',
    '::',
    '',
    '# Castlet 1: The Pancake Storm',
    '## Scene 1',
    '[DIALOGUE: nino | emotion=confident]',
    '"This is definitely going to work."',
  ].join('\n')

  it('captures ::CAST members and ::PAGECAST_BOOK metadata instead of discarding them', () => {
    const result = parseText(oneFile, 'pagecast')
    expect(result.meta).toMatchObject({ title: 'Kampung Awan Club', author: 'pageCast Studios', language: 'en' })
    expect(result.cast).toMatchObject([
      { name: 'Narrator', slug: 'narrator', role: 'narrator', voiceDescriptor: 'warm_adult_female', colorWord: 'amber' },
      { name: 'Nino', slug: 'nino', role: 'main_character', voiceDescriptor: 'young_boy_confident', colorWord: 'teal' },
    ])
  })

  it('still resolves the dialogue characterId hint from the CAST slug', () => {
    const result = parseText(oneFile, 'pagecast')
    expect(result.chapters[0].scenes[0].blocks[0]).toMatchObject({ type: 'dialogue', characterId: 'nino' })
  })
})

describe('concatenatePageCastFiles', () => {
  function castletFile(num: number, title: string): string {
    return [
      '::PAGECAST_BOOK', 'Title: Test Series', '::', '',
      '::CAST', 'Narrator: narrator | role=narrator', '::', '',
      `# Castlet ${num}: ${title}`, '## Scene 1', '[NARRATION]', `Content for castlet ${num}.`,
    ].join('\n')
  }

  it('sorts files by the trailing number in their filename, not lexicographically', () => {
    const files = [
      { name: 'kampung-awan-club_Cl08_pagecast.txt', text: castletFile(8, 'Eight') },
      { name: 'kampung-awan-club_Cl01_pagecast.txt', text: castletFile(1, 'One') },
      { name: 'kampung-awan-club_Cl02_pagecast.txt', text: castletFile(2, 'Two') },
    ]
    const { order } = concatenatePageCastFiles(files)
    expect(order).toEqual([
      'kampung-awan-club_Cl01_pagecast.txt',
      'kampung-awan-club_Cl02_pagecast.txt',
      'kampung-awan-club_Cl08_pagecast.txt',
    ])
  })

  it('produces N chapters from N concatenated castlet files, in order', () => {
    const files = [1, 2, 3].map(n => ({ name: `Cl0${n}_pagecast.txt`, text: castletFile(n, `Title${n}`) }))
    const { combinedText } = concatenatePageCastFiles(files)
    const result = parseText(combinedText, 'pagecast')
    expect(result.chapters.map(c => c.title)).toEqual([
      'Castlet 1: Title1', 'Castlet 2: Title2', 'Castlet 3: Title3',
    ])
  })

  it('sorts a filename with no digits to the end', () => {
    const files = [
      { name: 'intro_notes.txt', text: castletFile(1, 'X') }, // no digits in filename
      { name: 'Cl02_pagecast.txt', text: castletFile(2, 'Y') },
    ]
    const { order } = concatenatePageCastFiles(files)
    expect(order).toEqual(['Cl02_pagecast.txt', 'intro_notes.txt'])
  })
})

describe('isPageCastFile', () => {
  it('detects the ::PAGECAST_BOOK marker and rejects plain text', () => {
    expect(isPageCastFile('::PAGECAST_BOOK\nTitle: X\n::')).toBe(true)
    expect(isPageCastFile('Just a regular note, not a script.')).toBe(false)
  })
})

describe('guessVoiceId / hexForColorWord', () => {
  it('makes reasonable best-effort casting guesses', () => {
    expect(guessVoiceId('young_boy_confident', 'main_character')).toBe('ai_child_male')
    expect(guessVoiceId('elderly_male_dramatic', 'supporting')).toBe('ai_elder_male')
    expect(guessVoiceId('warm_adult_female', 'narrator')).toBe('ai_narrator_warm')
    expect(guessVoiceId('totally_unrecognizable_descriptor', 'supporting')).toBeUndefined()
  })

  it('maps known color words to hex and falls back to the palette for unknown ones', () => {
    expect(hexForColorWord('amber')).toBe('#F5C842')
    expect(hexForColorWord('teal')).toBe('#2DD4BF')
    expect(hexForColorWord('not-a-real-color', 0)).toMatch(/^#[0-9A-F]{6}$/i)
  })
})

describe('formatParsedImportAsPageCastText', () => {
  it('exports a parsed import as reusable PageCast tagged text', () => {
    const parsed = parseText('Chapter 1\n\n"Hello."\n\n[pause: 2s]', 'prose')
    const exported = formatParsedImportAsPageCastText(parsed)

    expect(exported).toContain('::PAGECAST_BOOK')
    expect(exported).toContain('# Chapter 1')
    expect(exported).toContain('[DIALOGUE]')
    expect(exported).toContain('"Hello."')
    expect(exported).toContain('[PAUSE: 2s]')
  })
})
