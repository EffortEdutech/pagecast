import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const fixtureRoot = path.join(root, 'docs', 'contract-fixtures')
const failures = []

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function fail(message) {
  failures.push(message)
}

function parseHeader(text) {
  const header = {}
  const match = text.match(/::PAGECAST_BOOK\s*\n([\s\S]*?)\n::/i)
  if (!match) return header
  for (const line of match[1].split(/\r?\n/)) {
    const pair = line.match(/^([^:]+):\s*(.+)$/)
    if (pair) header[pair[1].trim().toLowerCase()] = pair[2].trim()
  }
  return header
}

function parseCast(text) {
  const cast = new Map()
  const match = text.match(/::CAST\s*\n([\s\S]*?)\n::/i)
  if (!match) return cast
  for (const line of match[1].split(/\r?\n/)) {
    const item = line.match(/^([^:]+):\s*([^|]+)(?:\|(.*))?$/)
    if (!item) continue
    const options = {}
    for (const part of (item[3] ?? '').split('|')) {
      const [key, ...value] = part.split('=')
      if (key && value.length) options[key.trim().toLowerCase()] = value.join('=').trim()
    }
    cast.set(item[2].trim(), { name: item[1].trim(), ...options })
  }
  return cast
}

function parseSpokenBlocks(text) {
  const blocks = []
  const tag = /^\[(NARRATION|DIALOGUE|THOUGHT|QUOTE)(?::\s*([^\]|]+))?(?:\s*\|\s*([^\]]+))?\]\s*$/i
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(tag)
    if (!match) continue
    const options = {}
    for (const part of (match[3] ?? '').split('|')) {
      const [key, ...value] = part.split('=')
      if (key && value.length) options[key.trim().toLowerCase()] = value.join('=').trim()
    }
    const body = []
    for (let j = i + 1; j < lines.length && !/^\[/.test(lines[j]); j += 1) body.push(lines[j])
    blocks.push({ type: match[1].toLowerCase(), target: match[2]?.trim(), options, body: body.join('\n').trim() })
  }
  return blocks
}

function validateFixture(name) {
  const dir = path.join(fixtureRoot, name)
  const manifest = readJson(path.join(dir, 'pack.json'))
  if (manifest.schemaVersion !== '1.0') fail(`${name}: schemaVersion must be 1.0`)
  if (!['cast', 'language_pack'].includes(manifest.contentType)) fail(`${name}: invalid contentType`)
  if (!Array.isArray(manifest.chapters) || manifest.chapters.length === 0) fail(`${name}: chapters are required`)

  for (const chapter of manifest.chapters ?? []) {
    const file = path.join(dir, chapter.file)
    if (!fs.existsSync(file)) {
      fail(`${name}: missing chapter file ${chapter.file}`)
      continue
    }
    const text = fs.readFileSync(file, 'utf8')
    const header = parseHeader(text)
    const cast = parseCast(text)
    if (header.contenttype !== manifest.contentType) fail(`${name}: file content type does not match pack.json`)

    if (manifest.contentType === 'language_pack') {
      if (!manifest.languages?.source?.code || !manifest.languages?.target?.code) fail(`${name}: source and target languages are required`)
      if (header.sourcelanguage !== manifest.languages.source.code) fail(`${name}: source language mismatch`)
      if (header.targetlanguage !== manifest.languages.target.code) fail(`${name}: target language mismatch`)
      if (header.practicemode !== manifest.practiceMode) fail(`${name}: practice mode mismatch`)
    }

    for (const block of parseSpokenBlocks(text)) {
      const language = block.options.language
      if (manifest.contentType === 'language_pack' && !language) fail(`${name}: spoken block is missing language`)
      if (block.target && !cast.has(block.target)) fail(`${name}: block target ${block.target} is not declared in CAST`)
      if (block.target && language && cast.get(block.target)?.language && cast.get(block.target).language !== language) {
        fail(`${name}: block language ${language} does not match cast language for ${block.target}`)
      }
      if (!block.body) fail(`${name}: empty ${block.type} block`)
    }
  }
}

validateFixture('ordinary-cast')
validateFixture('id-en-language-pack')

if (failures.length) {
  console.error('PageCast contract validation failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  console.log('PageCast contract validation passed: ordinary-cast, id-en-language-pack')
}
