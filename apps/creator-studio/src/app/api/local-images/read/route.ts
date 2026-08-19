import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import { resolveCastDir, resolveSafePath, guessImageMime } from '@/lib/localImagesFs'

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug') ?? ''
  const relPath = req.nextUrl.searchParams.get('path') ?? ''
  const castDir = resolveCastDir(slug)
  if (!castDir) return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })
  const abs = resolveSafePath(castDir, relPath)
  if (!abs) return NextResponse.json({ error: 'Invalid path' }, { status: 400 })

  try {
    const data = await fs.readFile(abs)
    return new NextResponse(new Uint8Array(data), {
      headers: {
        'Content-Type': guessImageMime(abs),
        'Content-Length': String(data.byteLength),
        'Cache-Control': 'no-store',
      },
    })
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }
}
