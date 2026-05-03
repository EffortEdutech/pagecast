/**
 * POST /api/pdf/extract
 * ─────────────────────────────────────────────────────────────────────────────
 * Accepts a multipart/form-data upload with a single `file` field (PDF).
 * Returns the extracted plain text as JSON: { text: string, pages: number }
 *
 * Used by TextImportModal to let writers import PDF manuscripts directly.
 * The text is then handed to the same textParser.ts engine as .txt files.
 */
import { NextRequest, NextResponse } from 'next/server'
// @ts-ignore — pdf-parse has no default export type declaration
import pdfParse from 'pdf-parse'

export const runtime = 'nodejs' // pdf-parse needs Node.js runtime (not edge)
export const maxDuration = 30   // allow up to 30s for large PDFs

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
    const buffer = Buffer.from(arrayBuffer)

    // Extract text
    const data = await pdfParse(buffer)
    const rawText: string = data.text ?? ''
    const pages: number  = data.numpages ?? 0

    if (!rawText.trim()) {
      return NextResponse.json(
        { error: 'No readable text found. The PDF may be image-based (scanned). Please convert to text first.' },
        { status: 422 }
      )
    }

    // Clean up common PDF artifacts:
    //   • Multiple spaces → single space
    //   • Preserve paragraph breaks (double newlines)
    //   • Remove form feed characters
    const cleaned = rawText
      .replace(/\f/g, '\n\n')           // form feeds → paragraph breaks
      .replace(/[ \t]{2,}/g, ' ')       // multiple spaces → single space
      .replace(/\n{3,}/g, '\n\n')       // 3+ newlines → double newline
      .trim()

    return NextResponse.json({ text: cleaned, pages })
  } catch (err: any) {
    console.error('[pdf/extract]', err)
    return NextResponse.json(
      { error: 'PDF extraction failed: ' + (err.message ?? 'unknown error') },
      { status: 500 }
    )
  }
}
