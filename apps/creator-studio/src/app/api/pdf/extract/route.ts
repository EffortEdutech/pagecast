/**
 * POST /api/pdf/extract
 *
 * PDF extraction via pdfjs-dist is incompatible with Next.js 14 SSR bundling
 * (pdfjs-dist uses DOMMatrix / @napi-rs/canvas at module load time).
 *
 * Until a compatible PDF parser is available, this endpoint returns a helpful
 * error so the UI can guide users to convert their PDF to .txt first.
 */
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST() {
  return NextResponse.json(
    {
      error:
        'PDF import is not available in this environment. ' +
        'Please convert your PDF to a .txt file first ' +
        '(use Adobe Acrobat, Google Docs, or any online PDF-to-text converter), ' +
        'then import the .txt file.',
    },
    { status: 501 }
  )
}
