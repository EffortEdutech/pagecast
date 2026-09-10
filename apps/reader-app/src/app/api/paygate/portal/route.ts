import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  return NextResponse.json(
    { error: 'PayGate portal is not wired for pageCast yet. Cast Pass checkout is the only enabled PayGate action in this slice.' },
    { status: 501 },
  )
}