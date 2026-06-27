import { describe, it, expect, beforeEach, vi } from 'vitest'

// mockApi.js holds module-level state (the games map + tile counter) and loads
// from localStorage at import time. Reset the module registry and storage
// before each test so cases don't leak into one another.
beforeEach(() => {
  window.localStorage.clear()
  vi.resetModules()
})

async function freshApi() {
  const mod = await import('./mockApi.js')
  return mod.mockApiRequest
}

const CODE = '1234'

describe('GET /games/:code', () => {
  it('auto-creates the game and reports its (initially empty) players', async () => {
    const api = await freshApi()
    const res = await api('GET', `/games/${CODE}`)
    expect(res.ok).toBe(true)
    const data = await res.json()
    expect(data.code).toBe(CODE)
    expect(data.players).toEqual([])
  })
})

describe('POST /games/:code/players', () => {
  it('joins a player and returns 201', async () => {
    const api = await freshApi()
    const res = await api('POST', `/games/${CODE}/players`, { id: '42' })
    expect(res.status).toBe(201)
    expect(res.ok).toBe(true)
    await expect(res.json()).resolves.toEqual({ id: '42' })
  })

  it('rejects a missing id with 400', async () => {
    const api = await freshApi()
    const res = await api('POST', `/games/${CODE}/players`, {})
    expect(res.status).toBe(400)
    expect(res.ok).toBe(false)
  })
})

describe('POST /games/:code/draw', () => {
  it('appends N tiles and returns the full set', async () => {
    const api = await freshApi()
    const first = await (await api('POST', `/games/${CODE}/draw`, { id: '1', count: 3 })).json()
    expect(first.words).toHaveLength(3)

    const second = await (await api('POST', `/games/${CODE}/draw`, { id: '1', count: 2 })).json()
    expect(second.words).toHaveLength(5)
    // The earlier tiles are still present (draw appends, never replaces).
    expect(second.words.slice(0, 3)).toEqual(first.words)
  })

  it('gives each tile a unique id in "<id>|<word>" form', async () => {
    const api = await freshApi()
    const { words } = await (await api('POST', `/games/${CODE}/draw`, { id: '1', count: 10 })).json()
    for (const tile of words) {
      expect(tile).toMatch(/^\d+\|[a-z]+$/)
    }
    const ids = words.map((t) => t.split('|')[0])
    expect(new Set(ids).size).toBe(words.length)
  })

  it('draws nothing when count is missing or invalid', async () => {
    const api = await freshApi()
    const { words } = await (await api('POST', `/games/${CODE}/draw`, { id: '1' })).json()
    expect(words).toHaveLength(0)
  })

  it('keeps each player\'s tiles separate', async () => {
    const api = await freshApi()
    await api('POST', `/games/${CODE}/draw`, { id: 'a', count: 2 })
    const b = await (await api('POST', `/games/${CODE}/draw`, { id: 'b', count: 3 })).json()
    expect(b.words).toHaveLength(3)
  })

  it('keeps separate games isolated', async () => {
    const api = await freshApi()
    await api('POST', '/games/1111/draw', { id: '1', count: 4 })
    const other = await (await api('GET', '/games/2222/players/1/tiles')).json()
    expect(other.words).toEqual([])
  })
})

describe('POST /games/:code/submit', () => {
  it('removes exactly the submitted tiles', async () => {
    const api = await freshApi()
    const { words } = await (await api('POST', `/games/${CODE}/draw`, { id: '1', count: 5 })).json()
    const note = [words[1], words[3]]

    await api('POST', `/games/${CODE}/submit`, { id: '1', note })

    const after = await (await api('GET', `/games/${CODE}/players/1/tiles`)).json()
    expect(after.words).toHaveLength(3)
    expect(after.words).toEqual(words.filter((t) => !note.includes(t)))
  })
})

describe('GET /games/:code/players/:id/tiles', () => {
  it('returns the player\'s current tiles', async () => {
    const api = await freshApi()
    const drawn = await (await api('POST', `/games/${CODE}/draw`, { id: '7', count: 4 })).json()
    const fetched = await (await api('GET', `/games/${CODE}/players/7/tiles`)).json()
    expect(fetched.words).toEqual(drawn.words)
  })

  it('returns an empty set for an unknown player', async () => {
    const api = await freshApi()
    const { words } = await (await api('GET', `/games/${CODE}/players/nobody/tiles`)).json()
    expect(words).toEqual([])
  })
})

describe('unknown routes', () => {
  it('returns 404', async () => {
    const api = await freshApi()
    const res = await api('DELETE', `/games/${CODE}/draw`)
    expect(res.status).toBe(404)
    expect(res.ok).toBe(false)
  })
})

describe('persistence', () => {
  it('round-trips state through localStorage across reloads', async () => {
    const api = await freshApi()
    const drawn = await (await api('POST', `/games/${CODE}/draw`, { id: '1', count: 3 })).json()

    // Simulate a page reload: drop the module (and its in-memory state) and
    // re-import, which re-runs load() against the same localStorage.
    vi.resetModules()
    const reloaded = await freshApi()
    const after = await (await reloaded('GET', `/games/${CODE}/players/1/tiles`)).json()
    expect(after.words).toEqual(drawn.words)
  })
})
