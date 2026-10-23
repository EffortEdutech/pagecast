import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const required = [
  '.casts/id-en-greetings-a1/pack.json',
  '.casts/id-en-greetings-a1/glossary.csv',
  '.casts/id-en-greetings-a1/script/01_welcome_pagecast.txt',
  '.casts/id-en-greetings-a1/script/02_core_phrases_pagecast.txt',
  '.casts/id-en-greetings-a1/script/03_guided_dialogue_pagecast.txt',
  '.casts/id-en-greetings-a1/script/04_review_pagecast.txt',
  'docs/migrations/022_language_pack_content.sql',
  'scripts/validate_language_pack.mjs',
  'skills/language-pack-author/SKILL.md',
  'apps/creator-studio/src/lib/textParser.ts',
  'apps/creator-studio/src/lib/supabase/books.ts',
  'apps/creator-studio/src/lib/supabase/blocks.ts',
  'apps/reader-app/src/lib/supabase/books.ts',
  'apps/reader-app/src/app/reader/[id]/page.tsx',
  'skills/generate_voices.py',
]

const missing = required.filter(file => !fs.existsSync(path.join(root, file)))
if (missing.length) {
  console.error('Language Pack artifact gate failed:')
  for (const file of missing) console.error(`- missing ${file}`)
  process.exitCode = 1
} else {
  console.log(`Language Pack artifact gate passed: ${required.length} required artifacts present`)
}
