import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type PdfTextItem = {
  str?: string
  hasEOL?: boolean
  transform?: number[]
  width?: number
}

class MinimalDOMMatrix {
  constructor(_init?: unknown) {}
}

function installPdfJsTextPolyfills() {
  const globalScope = globalThis as Record<string, unknown>
  globalScope.DOMMatrix ??= MinimalDOMMatrix
  globalScope.ImageData ??= class ImageData {}
  globalScope.Path2D ??= class Path2D {}
}

function joinPdfTextItems(items: PdfTextItem[]): string {
  const lines: string[] = []
  let current = ''
  let lastY: number | null = null

  for (const item of items) {
    const raw = item.str ?? ''
    const text = raw.replace(/\s+/g, ' ')
    const y = typeof item.transform?.[5] === 'number' ? item.transform[5] : null

    if (lastY !== null && y !== null && Math.abs(y - lastY) > 6 && current.trim()) {
      lines.push(current.trimEnd())
      current = ''
    }

    if (text) {
      const needsSpace =
        current.length > 0 &&
        !/\s$/.test(current) &&
        !/^[,.;:!?)]/.test(text) &&
        !/[-("']$/.test(current)
      current += needsSpace ? ` ${text}` : text
    }

    if (item.hasEOL && current.trim()) {
      lines.push(current.trimEnd())
      current = ''
    }

    if (y !== null) lastY = y
  }

  if (current.trim()) lines.push(current.trimEnd())

  return lines
    .join('\n')
    .replace(/([A-Za-z])-\n([A-Za-z])/g, '$1$2')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No PDF file was uploaded.' }, { status: 400 })
    }

    installPdfJsTextPolyfills()
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const data = new Uint8Array(await file.arrayBuffer())
    const loadingTask = pdfjs.getDocument({ data, disableWorker: true } as Parameters<typeof pdfjs.getDocument>[0])
    const pdf = await loadingTask.promise
    const pageTexts: string[] = []

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber)
      const content = await page.getTextContent()
      const pageText = joinPdfTextItems(content.items as PdfTextItem[])
      if (pageText) pageTexts.push(pageText)
    }

    const text = pageTexts.join('\n\n').trim()
    if (!text) {
      return NextResponse.json({
        error: 'No selectable text was found in this PDF. It may be scanned image pages.',
      }, { status: 422 })
    }

    return NextResponse.json({ text, pages: pdf.numPages })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown PDF extraction error'
    return NextResponse.json({ error: `PDF extraction failed: ${message}` }, { status: 500 })
  }
}
