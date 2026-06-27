import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('when VITE_OFFLINE is set', () => {
  it('flags IS_OFFLINE and routes requests to the mock backend', async () => {
    vi.stubEnv('VITE_OFFLINE', 'true')
    window.localStorage.clear()
    const { apiRequest, IS_OFFLINE } = await import('./api.js')

    expect(IS_OFFLINE).toBe(true)

    // Dispatches to the real mock (no fetch involved): a draw comes back
    // with a tiles payload, proving it never touched the network.
    const res = await apiRequest('POST', '/game/draw', { id: '1', count: 2 })
    const data = await res.json()
    expect(res.ok).toBe(true)
    expect(data.words).toHaveLength(2)
  })
})

describe('when VITE_OFFLINE is not set', () => {
  it('calls fetch against VITE_API_URL with a JSON body', async () => {
    vi.stubEnv('VITE_OFFLINE', 'false')
    vi.stubEnv('VITE_API_URL', 'http://api.test')
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    const { apiRequest, IS_OFFLINE } = await import('./api.js')
    expect(IS_OFFLINE).toBe(false)

    await apiRequest('POST', '/players', { id: '7' }, { 'Content-Type': 'application/json' })

    expect(fetchMock).toHaveBeenCalledWith('http://api.test/players', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: '7' }),
    })
  })

  it('omits the body when none is given', async () => {
    vi.stubEnv('VITE_OFFLINE', 'false')
    vi.stubEnv('VITE_API_URL', 'http://api.test')
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    const { apiRequest } = await import('./api.js')
    await apiRequest('GET', '/players/7/tiles', null, { 'Content-Type': 'application/json' })

    expect(fetchMock).toHaveBeenCalledWith('http://api.test/players/7/tiles', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })
  })
})
