import { describe, it, expect, beforeEach, vi } from 'vitest'

// useGame talks to the server only through api.js; mock that seam so we can
// drive every branch deterministically without a network or the mock backend.
vi.mock('../api.js', () => {
  class ApiError extends Error {
    constructor(message, status = 0) {
      super(message)
      this.name = 'ApiError'
      this.status = status
    }
  }
  return {
    ApiError,
    api: {
      createPlayer: vi.fn(),
      draw: vi.fn(),
      submit: vi.fn(),
      getTiles: vi.fn(),
    },
  }
})

import { useGame } from './useGame.js'
import { api, ApiError } from '../api.js'

beforeEach(() => {
  window.localStorage.clear()
  api.createPlayer.mockReset().mockResolvedValue({ id: 'p1' })
  api.draw.mockReset().mockResolvedValue({ words: [] })
  api.submit.mockReset().mockResolvedValue({ ok: true })
  api.getTiles.mockReset().mockResolvedValue({ words: [] })
})

describe('player identity', () => {
  it('registers, trims, persists, and restores tiles on set', async () => {
    api.getTiles.mockResolvedValue({ words: ['7|robot'] })
    const game = useGame()

    await game.setPlayerID('  p9  ')

    expect(api.createPlayer).toHaveBeenCalledWith('p9')
    expect(game.playerID.value).toBe('p9')
    expect(window.localStorage.getItem('quipnotes.playerId')).toBe('p9')
    expect(game.pool.value).toEqual([{ id: '7', word: 'robot' }])
  })

  it('rejects an empty id without calling the server', async () => {
    const notify = vi.fn()
    const game = useGame({ notify })
    await game.setPlayerID('   ')
    expect(api.createPlayer).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('Player ID'), 'error')
  })

  it('loads a persisted id on construction', () => {
    window.localStorage.setItem('quipnotes.playerId', 'returning')
    const game = useGame()
    expect(game.playerID.value).toBe('returning')
  })

  it('resetPlayer clears id, pool, note, and localStorage', async () => {
    api.getTiles.mockResolvedValue({ words: ['1|foo'] })
    const game = useGame()
    await game.setPlayerID('p1')
    game.addToNote('1')

    game.resetPlayer()

    expect(game.playerID.value).toBe('')
    expect(game.pool.value).toEqual([])
    expect(game.noteTiles.value).toEqual([])
    expect(window.localStorage.getItem('quipnotes.playerId')).toBeNull()
  })
})

describe('drawing', () => {
  it('always draws between 3 and 12 tiles', async () => {
    const counts = []
    api.draw.mockImplementation((id, count) => {
      counts.push(count)
      return Promise.resolve({ words: [] })
    })
    const game = useGame()
    game.playerID.value = 'p1'

    for (let i = 0; i < 50; i++) await game.draw()

    expect(counts).toHaveLength(50)
    for (const c of counts) {
      expect(c).toBeGreaterThanOrEqual(3)
      expect(c).toBeLessThanOrEqual(12)
    }
  })

  it('refuses to draw without a player id', async () => {
    const notify = vi.fn()
    const game = useGame({ notify })
    await game.draw()
    expect(api.draw).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('Player ID'), 'error')
  })

  it('populates the pool from the drawn tiles', async () => {
    api.draw.mockResolvedValue({ words: ['1|the', '2|secret'] })
    const game = useGame()
    game.playerID.value = 'p1'
    await game.draw()
    expect(game.pool.value).toEqual([
      { id: '1', word: 'the' },
      { id: '2', word: 'secret' },
    ])
  })

  it('clears the loading flag and toasts the message on failure', async () => {
    api.draw.mockRejectedValue(new ApiError('boom', 500))
    const notify = vi.fn()
    const game = useGame({ notify })
    game.playerID.value = 'p1'
    await game.draw()
    expect(notify).toHaveBeenCalledWith('boom', 'error')
    expect(game.isDrawing.value).toBe(false)
  })
})

describe('note construction', () => {
  function gameWithPool() {
    const game = useGame()
    game.pool.value = [
      { id: '1', word: 'the' },
      { id: '2', word: 'secret' },
      { id: '3', word: 'banana' },
    ]
    return game
  }

  it('keeps insertion order and ignores duplicates', () => {
    const game = gameWithPool()
    game.addToNote('1')
    game.addToNote('3')
    game.addToNote('2')
    game.addToNote('1') // already placed — ignored
    expect(game.noteTiles.value.map((t) => t.id)).toEqual(['1', '3', '2'])
    expect(game.notePreview.value).toBe('the banana secret')
  })

  it('marks placed tiles as used and counts the rest', () => {
    const game = gameWithPool()
    game.addToNote('2')
    expect([...game.usedIds.value]).toEqual(['2'])
    expect(game.remainingCount.value).toBe(2)
  })

  it('removes a tile from the note', () => {
    const game = gameWithPool()
    game.addToNote('1')
    game.addToNote('2')
    game.removeFromNote('1')
    expect(game.noteTiles.value.map((t) => t.id)).toEqual(['2'])
  })

  it('nudges a tile left/right and no-ops at the ends', () => {
    const game = gameWithPool()
    game.addToNote('1')
    game.addToNote('2')
    game.addToNote('3')
    game.moveTile('3', -1)
    expect(game.noteTiles.value.map((t) => t.id)).toEqual(['1', '3', '2'])
    game.moveTile('1', -1) // already first — no-op
    expect(game.noteTiles.value.map((t) => t.id)).toEqual(['1', '3', '2'])
  })

  it('clears the whole note', () => {
    const game = gameWithPool()
    game.addToNote('1')
    game.addToNote('2')
    game.clearNote()
    expect(game.noteTiles.value).toEqual([])
  })
})

describe('submitting', () => {
  it('sends wire-format strings, clears the note, and refetches the pool', async () => {
    api.getTiles.mockResolvedValue({ words: ['2|secret'] })
    const notify = vi.fn()
    const game = useGame({ notify })
    game.playerID.value = 'p1'
    game.pool.value = [
      { id: '1', word: 'the' },
      { id: '2', word: 'secret' },
    ]
    game.addToNote('1')

    await game.submit()

    expect(api.submit).toHaveBeenCalledWith('p1', ['1|the'])
    expect(game.noteTiles.value).toEqual([])
    expect(game.pool.value).toEqual([{ id: '2', word: 'secret' }])
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('submitted'), 'success')
  })

  it('refuses to submit an empty note', async () => {
    const notify = vi.fn()
    const game = useGame({ notify })
    game.playerID.value = 'p1'
    await game.submit()
    expect(api.submit).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('Add some words'), 'error')
  })
})

describe('pool reconciliation', () => {
  it('prunes note ids whose tiles disappear after a refetch', async () => {
    api.getTiles.mockResolvedValue({ words: ['1|the'] })
    const game = useGame()
    game.playerID.value = 'p1'
    game.pool.value = [
      { id: '1', word: 'the' },
      { id: '2', word: 'secret' },
    ]
    game.addToNote('1')
    game.addToNote('2')
    await game.refreshTiles()
    expect(game.noteTiles.value.map((t) => t.id)).toEqual(['1'])
  })
})
