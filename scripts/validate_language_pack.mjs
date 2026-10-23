import fs from 'node:fs'
import path from 'node:path'

const packDir = path.resolve(process.argv[2] ?? path.join(process.cwd(), '.casts', 'id-en-greetings-a1'))
const manifestPath = path.join(packDir, 'pack.json')
const errors = []

if (!fs.existsSync(manifestPath)) {
  console.error(`Language Pack validation failed: missing ${manifestPath}`)
  process.exitCode = 1
} else {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  const languages = [manifest.l1, manifest.l2].filter(Boolean)
  if (manifest.type !== 'language_pack') errors.push('pack.json type must be language_pack')
  if (languages.length !== 2 || languages[0] === languages[1]) errors.push('pack.json must declare distinct l1 and l2 languages')
  if (manifest.practiceMode !== 'pause_and_speak') errors.push('practiceMode must be pause_and_speak')
  if (manifest.speechRule !== 'one_language_per_block') errors.push('speechRule must be one_language_per_block')
  if (!manifest.level) errors.push('pack.json must declare a learner level')
  if (!Array.isArray(manifest.chapters) || manifest.chapters.length === 0) errors.push('pack.json must contain ordered chapters')

  const castLanguages = new Map(Object.entries(manifest.narrators ?? {}))
  for (const chapter of manifest.chapters ?? []) {
    const file = path.join(packDir, chapter.file)
    if (!fs.existsSync(file)) {
      errors.push(`missing chapter file: ${chapter.file}`)
      continue
    }
    const text = fs.readFileSync(file, 'utf8')
    const castSection = text.match(/::CAST\s*\n([\s\S]*?)\n::/i)?.[1] ?? ''
    for (const line of castSection.split(/\r?\n/)) {
      const cast = line.match(/^[^:]+:\s*([^|]+)\|.*?\blanguage=([^|]+)/i)
      if (cast) castLanguages.set(cast[1].trim(), cast[2].trim())
    }

    const blockPattern = /^\[(NARRATION|DIALOGUE|THOUGHT|QUOTE)(?::\s*([^|\]]+))?\s*(?:\|([^\]]+))?\]\s*$/gim
    let match
    let spokenCount = 0
    while ((match = blockPattern.exec(text))) {
      spokenCount += 1
      const target = match[2]?.trim()
      const language = match[3]?.match(/\blanguage=([^|]+)/i)?.[1]?.trim()
      if (!language) errors.push(`${chapter.id}: spoken block ${target ?? '(unassigned)'} has no language`)
      if (language && !languages.includes(language)) errors.push(`${chapter.id}: unsupported language ${language}`)
      const castLanguage = target ? castLanguages.get(target) : undefined
      if (castLanguage && language && castLanguage !== 'multi' && castLanguage !== language) {
        errors.push(`${chapter.id}: ${target} is ${castLanguage}, block is ${language}`)
      }
    }
    if (spokenCount === 0) errors.push(`${chapter.id}: no spoken blocks found`)
    if (!/\[PAUSE:/i.test(text) && chapter.id !== 'welcome') errors.push(`${chapter.id}: expected a practice pause`)
  }

  if (errors.length) {
    console.error('Language Pack validation failed:')
    for (const error of errors) console.error(`- ${error}`)
    process.exitCode = 1
  } else {
    console.log(`Language Pack validation passed: ${manifest.chapters.length} chapters, ${manifest.l1} → ${manifest.l2}, ${manifest.practiceMode}`)
  }
}
