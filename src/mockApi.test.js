import { describe, it, expect, beforeEach, vi } from 'vitest'

// mockApi.js holds module-level state (the players Map + tile counter) and
// loads from localStorage at import time. Reset the module registry and
// storage before each test so cases don't leak into one another.
beforeEach(() => {
  window.localStorage.clear()
  vi.resetModules()
})

async function freshApi() {
  const mod = await import('./mockApi.js')
  return mod.mockApiRequest
}

describe('POST /players', () => {
  it('registers a player and returns 201', async () => {
    const api = await freshApi()
    const res = await api('POST', '/players', { id: '42' })
    expect(res.status).toBe(201)
    expect(res.ok).toBe(true)
    await expect(res.json()).resolves.toEqual({ id: '42' })
  })

  it('rejects a missing id with 400', async () => {
    const api = await freshApi()
    const res = await api('POST', '/players', {})
    expect(res.status).toBe(400)
    expect(res.ok).toBe(false)
  })
})

describe('POST /game/draw', () => {
  it('appends N tiles and returns the full set', async () => {
    const api = await freshApi()
    const first = await (await api('POST', '/game/draw', { id: '1', count: 3 })).json()
    expect(first.words).toHaveLength(3)

    const second = await (await api('POST', '/game/draw', { id: '1', count: 2 })).json()
    expect(second.words).toHaveLength(5)
    // The earlier tiles are still present (draw appends, never replaces).
    expect(second.words.slice(0, 3)).toEqual(first.words)
  })

  it('gives each tile a unique id in "<id>|<word>" form', async () => {
    const api = await freshApi()
    const { words } = await (await api('POST', '/game/draw', { id: '1', count: 10 })).json()
    for (const tile of words) {
      expect(tile).toMatch(/^\d+\|[a-z]+$/)
    }
    const ids = words.map((t) => t.split('|')[0])
    expect(new Set(ids).size).toBe(words.length)
  })

  it('draws nothing when count is missing or invalid', async () => {
    const api = await freshApi()
    const { words } = await (await api('POST', '/game/draw', { id: '1' })).json()
    expect(words).toHaveLength(0)
  })

  it('keeps each player\'s tiles separate', async () => {
    const api = await freshApi()
    await api('POST', '/game/draw', { id: 'a', count: 2 })
    const b = await (await api('POST', '/game/draw', { id: 'b', count: 3 })).json()
    expect(b.words).toHaveLength(3)
  })
})

describe('POST /game/submit', () => {
  it('removes exactly the submitted tiles', async () => {
    const api = await freshApi()
    const { words } = await (await api('POST', '/game/draw', { id: '1', count: 5 })).json()
    const note = [words[1], words[3]]

    await api('POST', '/game/submit', { id: '1', note })

    const after = await (await api('GET', '/players/1/tiles')).json()
    expect(after.words).toHaveLength(3)
    expect(after.words).toEqual(words.filter((t) => !note.includes(t)))
  })
})

describe('GET /players/:id/tiles', () => {
  it('returns the player\'s current tiles', async () => {
    const api = await freshApi()
    const drawn = await (await api('POST', '/game/draw', { id: '7', count: 4 })).json()
    const fetched = await (await api('GET', '/players/7/tiles')).json()
    expect(fetched.words).toEqual(drawn.words)
  })

  it('returns an empty set for an unknown player', async () => {
    const api = await freshApi()
    const { words } = await (await api('GET', '/players/nobody/tiles')).json()
    expect(words).toEqual([])
  })
})

describe('unknown routes', () => {
  it('returns 404', async () => {
    const api = await freshApi()
    const res = await api('DELETE', '/game/draw')
    expect(res.status).toBe(404)
    expect(res.ok).toBe(false)
  })
})

describe('persistence', () => {
  it('round-trips state through localStorage across reloads', async () => {
    const api = await freshApi()
    const drawn = await (await api('POST', '/game/draw', { id: '1', count: 3 })).json()

    // Simulate a page reload: drop the module (and its in-memory state) and
    // re-import, which re-runs load() against the same localStorage.
    vi.resetModules()
    const reloaded = await freshApi()
    const after = await (await reloaded('GET', '/players/1/tiles')).json()
    expect(after.words).toEqual(drawn.words)
  })
})
