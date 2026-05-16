import { describe, expect, it } from 'vitest'
import { formatParsedImportAsPageCastText, normalizeImportedText, parseText } from './textParser'

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
