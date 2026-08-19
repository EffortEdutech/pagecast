import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { resolveCastDir, IMAGE_EXT_RE } from '@/lib/localImagesFs'

const SCENE_FILENAME_RE = /^ch\s*(\d+)[\s_-]*sc\s*(\d+)/i
const COVER_FILENAME_RE = /^cover\.(jpe?g|png|webp)$/i

export interface LocalCharacterFile { name: string; path: string }
export interface LocalSceneFile { chapterNum: number; sceneNum: number; path: string }
export interface LocalImagesScanResult {
  exists: boolean
  characterFiles: LocalCharacterFile[]
  sceneFiles: LocalSceneFile[]
  coverPath: string | null
}

async function readDirFiles(dir: string): Promise<{ name: string }[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    return entries.filter(e => e.isFile()).map(e => ({ name: e.name }))
  } catch {
    return []
  }
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug') ?? ''
  const castDir = resolveCastDir(slug)
  if (!castDir) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })
  }

  const exists = await fs.stat(castDir).then(s => s.isDirectory()).catch(() => false)
  if (!exists) {
    const empty: LocalImagesScanResult = { exists: false, characterFiles: [], sceneFiles: [], coverPath: null }
    return NextResponse.json(empty)
  }

  const characterFiles: LocalCharacterFile[] = (await readDirFiles(path.join(castDir, 'CHARACTER_REFS')))
    .filter(f => IMAGE_EXT_RE.test(f.name))
    .map(f => ({ name: f.name.replace(IMAGE_EXT_RE, ''), path: `CHARACTER_REFS/${f.name}` }))

  const sceneFiles: LocalSceneFile[] = (await readDirFiles(path.join(castDir, 'images')))
    .filter(f => IMAGE_EXT_RE.test(f.name))
    .map(f => ({ match: f.name.match(SCENE_FILENAME_RE), name: f.name }))
    .filter((f): f is { match: RegExpMatchArray; name: string } => !!f.match)
    .map(f => ({ chapterNum: parseInt(f.match[1], 10), sceneNum: parseInt(f.match[2], 10), path: `images/${f.name}` }))

  let coverPath: string | null = null
  const rootFiles = await readDirFiles(castDir)
  const rootCover = rootFiles.find(f => COVER_FILENAME_RE.test(f.name))
  if (rootCover) {
    coverPath = rootCover.name
  } else {
    const imageFiles = await readDirFiles(path.join(castDir, 'images'))
    const nestedCover = imageFiles.find(f => COVER_FILENAME_RE.test(f.name))
    if (nestedCover) coverPath = `images/${nestedCover.name}`
  }

  const result: LocalImagesScanResult = { exists: true, characterFiles, sceneFiles, coverPath }
  return NextResponse.json(result)
}
