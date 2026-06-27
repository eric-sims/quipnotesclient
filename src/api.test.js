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
    const { api, IS_OFFLINE } = await import('./api.js')

    expect(IS_OFFLINE).toBe(true)

    // Dispatches to the real mock (no fetch involved): a draw comes back
    // with parsed data, proving it never touched the network.
    const data = await api.draw('1', 2)
    expect(data.words).toHaveLength(2)
  })
})

describe('when VITE_OFFLINE is not set', () => {
  it('calls fetch against VITE_API_URL with a JSON body and parses the result', async () => {
    vi.stubEnv('VITE_OFFLINE', 'false')
    vi.stubEnv('VITE_API_URL', 'http://api.test')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: '7' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const { api, IS_OFFLINE } = await import('./api.js')
    expect(IS_OFFLINE).toBe(false)

    const data = await api.createPlayer('7')
    expect(data).toEqual({ id: '7' })
    expect(fetchMock).toHaveBeenCalledWith('http://api.test/players', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: '7' }),
    })
  })

  it('omits the body on a GET', async () => {
    vi.stubEnv('VITE_OFFLINE', 'false')
    vi.stubEnv('VITE_API_URL', 'http://api.test')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ words: [] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const { api } = await import('./api.js')
    await api.getTiles('7')

    expect(fetchMock).toHaveBeenCalledWith('http://api.test/players/7/tiles', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })
  })

  it('falls back to the local default when VITE_API_URL is unset', async () => {
    vi.stubEnv('VITE_OFFLINE', 'false')
    vi.stubEnv('VITE_API_URL', '')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ words: [] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const { api } = await import('./api.js')
    await api.getTiles('7')

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8081/players/7/tiles',
      expect.any(Object)
    )
  })

  it('throws an ApiError carrying the server message on a non-2xx response', async () => {
    vi.stubEnv('VITE_OFFLINE', 'false')
    vi.stubEnv('VITE_API_URL', 'http://api.test')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: 'id required' }),
      })
    )

    const { api, ApiError } = await import('./api.js')
    await expect(api.createPlayer('')).rejects.toMatchObject({
      message: 'id required',
      status: 400,
    })
    await expect(api.createPlayer('')).rejects.toBeInstanceOf(ApiError)
  })

  it('throws a friendly ApiError when the server is unreachable', async () => {
    vi.stubEnv('VITE_OFFLINE', 'false')
    vi.stubEnv('VITE_API_URL', 'http://api.test')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('failed')))

    const { api } = await import('./api.js')
    await expect(api.getTiles('7')).rejects.toMatchObject({
      message: 'Cannot reach the server. Is it running?',
      status: 0,
    })
  })
})
