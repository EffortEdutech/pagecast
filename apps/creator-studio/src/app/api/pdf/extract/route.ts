/**
 * POST /api/pdf/extract
 * Accepts multipart/form-data with a `file` field (PDF).
 * Returns extracted plain text: { text: string, pages: number }
 *
 * Uses pdf-parse v2 (PDFParse class API).
 * @napi-rs/canvas is externalized in next.config.js so native bindings
 * are not bundled at build time.
 */
import { NextRequest, NextResponse } from 'next/server'
import { PDFParse } from 'pdf-parse'

export const runtime    = 'nodejs' // pdf-parse needs Node.js runtime (not edge)
export const dynamic    = 'force-dynamic'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file')

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No PDF file provided' }, { status: 400 })
    }

    const typedFile = file as File
    if (!typedFile.type.includes('pdf') && !typedFile.name.endsWith('.pdf')) {
      return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 })
    }

    // Convert File → Buffer
    const arrayBuffer = await typedFile.arrayBuffer()
    const buffer      = Buffer.from(arrayBuffer)

    // pdf-parse v2: PDFParse class, pass data buffer as LoadParameters
    const parser = new PDFParse({ data: buffer })
    const result = await parser.getText()
    await parser.destroy()

    const rawText: string = result.text ?? ''
    const pages: number   = result.pages?.length ?? 0

    if (!rawText.trim()) {
      return NextResponse.json(
        { error: 'No readable text found. The PDF may be image-based (scanned). Please convert to text first.' },
        { status: 422 }
      )
    }

    // Clean up common PDF artifacts
    const cleaned = rawText
      .replace(/\f/g, '\n\n')        // form feeds → paragraph breaks
      .replace(/[ \t]{2,}/g, ' ')     // multiple spaces → single space
      .replace(/\n{3,}/g, '\n\n')    // 3+ newlines → double newline
      .trim()

    return NextResponse.json({ text: cleaned, pages })
  } catch (err: any) {
    console.error('[pdf/extract]', err)
    return NextResponse.json(
      { error: 'PDF extraction failed: ' + (err?.message ?? 'unknown error') },
      { status: 500 }
    )
  }
}
