import { beforeEach, describe, expect, it, vi } from 'vitest'

// Plain function (not vi.fn) so a rejected getUser() is only observed via our code path.
let getUserImpl: () => Promise<unknown> = async () => ({ data: { user: null } })
vi.mock('./server', () => ({
  createClient: () => ({ auth: { getUser: () => getUserImpl() } }),
}))

import { requireApiUser } from './apiAuth'

describe('requireApiUser', () => {
  beforeEach(() => { getUserImpl = async () => ({ data: { user: null } }) })

  it('returns the user when signed in', async () => {
    getUserImpl = async () => ({ data: { user: { id: 'u1' } } })
    const result = await requireApiUser()
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.user.id).toBe('u1')
  })

  it('returns 401 when there is no session', async () => {
    getUserImpl = async () => ({ data: { user: null } })
    const result = await requireApiUser()
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(401)
      expect(await result.response.json()).toEqual({ error: 'Sign in to use AI voice generation.' })
    }
  })

  it('fails closed when the auth backend errors', async () => {
    getUserImpl = () => Promise.reject(new Error('network down'))
    const result = await requireApiUser()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(401)
  })
})
