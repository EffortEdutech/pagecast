import { createBrowserClient } from '@supabase/ssr'

// Singleton browser client — one instance avoids the "Lock stolen by another
// request" AbortError that occurs in React 18 Strict Mode when multiple
// concurrent getUser() calls race over the same navigator.locks key.
let _client: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (_client) return _client
  _client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // Replace the Web Locks API with a simple promise-based mutex.
        // This prevents "lock stolen" AbortErrors in Strict Mode while still
        // serialising concurrent token refreshes correctly.
        lock: makeLock(),
      },
    }
  )
  return _client
}

// Simple async mutex — no Web Locks API dependency
type LockFn = (name: string, acquireTimeout: number, fn: () => Promise<any>) => Promise<any>

function makeLock(): LockFn {
  const queues = new Map<string, Promise<void>>()
  return (name, _timeout, fn) => {
    const prev = queues.get(name) ?? Promise.resolve()
    let resolve!: () => void
    const next = new Promise<void>(r => { resolve = r })
    queues.set(name, next)
    return prev.then(() => fn()).finally(resolve)
  }
}
