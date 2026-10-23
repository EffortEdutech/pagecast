import { spawnSync } from 'node:child_process'
import path from 'node:path'

const script = path.join(process.cwd(), 'scripts', 'validate_language_pack.mjs')
const packDir = path.join(process.cwd(), '.casts', 'id-en-greetings-a1')
const result = spawnSync(process.execPath, [script, packDir], { stdio: 'inherit' })
process.exitCode = result.status ?? 1
