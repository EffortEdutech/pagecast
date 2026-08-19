import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { resolveCastDir, resolveSafePath } from '@/lib/localImagesFs'

interface WriteBody {
  slug?: string
  path?: string
  dataBase64?: string
}

export async function POST(req: NextRequest) {
  let body: WriteBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { slug, path: relPath, dataBase64 } = body
  if (!slug || !relPath || !dataBase64) {
    return NextResponse.json({ error: 'Missing slug, path, or dataBase64' }, { status: 400 })
  }

  const castDir = resolveCastDir(slug)
  if (!castDir) return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })
  const abs = resolveSafePath(castDir, relPath)
  if (!abs) return NextResponse.json({ error: 'Invalid path' }, { status: 400 })

  try {
    await fs.mkdir(path.dirname(abs), { recursive: true })
    await fs.writeFile(abs, Buffer.from(dataBase64, 'base64'))
    return NextResponse.json({ ok: true, path: relPath })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Write failed' }, { status: 500 })
  }
}
