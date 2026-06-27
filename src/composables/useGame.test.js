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
      getGame: vi.fn(),
      joinGame: vi.fn(),
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
  api.getGame.mockReset().mockResolvedValue({ code: '1234', players: [] })
  api.joinGame.mockReset().mockResolvedValue({ id: 'p1' })
  api.draw.mockReset().mockResolvedValue({ words: [] })
  api.submit.mockReset().mockResolvedValue({ ok: true })
  api.getTiles.mockReset().mockResolvedValue({ words: [] })
})

// Put a game into "joined and playing" state for the action tests.
function joinedGame(notify) {
  const game = useGame(notify ? { notify } : undefined)
  game.playerID.value = 'p1'
  game.gameCode.value = '1234'
  return game
}

describe('player identity', () => {
  it('sets, trims, and persists the id locally without a server call', async () => {
    const game = useGame()

    game.setPlayerID('  p9  ')

    expect(api.joinGame).not.toHaveBeenCalled()
    expect(game.playerID.value).toBe('p9')
    expect(window.localStorage.getItem('quipnotes.playerId')).toBe('p9')
  })

  it('rejects an empty id', () => {
    const notify = vi.fn()
    const game = useGame({ notify })
    game.setPlayerID('   ')
    expect(game.playerID.value).toBe('')
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('Player ID'), 'error')
  })

  it('loads a persisted id and game code on construction', () => {
    window.localStorage.setItem('quipnotes.playerId', 'returning')
    window.localStorage.setItem('quipnotes.gameCode', '4821')
    const game = useGame()
    expect(game.playerID.value).toBe('returning')
    expect(game.gameCode.value).toBe('4821')
  })

  it('resetPlayer clears id, game code, pool, note, and localStorage', async () => {
    const game = joinedGame()
    game.pool.value = [{ id: '1', word: 'foo' }]
    game.addToNote('1')

    game.resetPlayer()

    expect(game.playerID.value).toBe('')
    expect(game.gameCode.value).toBe('')
    expect(game.pool.value).toEqual([])
    expect(game.noteTiles.value).toEqual([])
    expect(window.localStorage.getItem('quipnotes.playerId')).toBeNull()
    expect(window.localStorage.getItem('quipnotes.gameCode')).toBeNull()
  })
})

describe('joining a game', () => {
  it('requires a player id first', async () => {
    const notify = vi.fn()
    const game = useGame({ notify })
    await game.joinGame('1234')
    expect(api.joinGame).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('Player ID'), 'error')
  })

  it('rejects a non-4-digit code', async () => {
    const notify = vi.fn()
    const game = useGame({ notify })
    game.playerID.value = 'p1'
    await game.joinGame('12')
    expect(api.joinGame).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('4-digit'), 'error')
  })

  it('verifies, joins, persists the code, and refreshes tiles', async () => {
    api.getTiles.mockResolvedValue({ words: ['7|robot'] })
    const game = useGame()
    game.playerID.value = 'p1'

    await game.joinGame('1234')

    expect(api.getGame).toHaveBeenCalledWith('1234')
    expect(api.joinGame).toHaveBeenCalledWith('1234', 'p1')
    expect(game.gameCode.value).toBe('1234')
    expect(window.localStorage.getItem('quipnotes.gameCode')).toBe('1234')
    expect(game.pool.value).toEqual([{ id: '7', word: 'robot' }])
  })

  it('reports a clear error for an unknown code', async () => {
    api.getGame.mockRejectedValue(new ApiError('game 9999 not found', 404))
    const notify = vi.fn()
    const game = useGame({ notify })
    game.playerID.value = 'p1'

    await game.joinGame('9999')

    expect(game.gameCode.value).toBe('')
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('not found'), 'error')
  })
})

describe('drawing', () => {
  it('always draws between 3 and 12 tiles', async () => {
    const counts = []
    api.draw.mockImplementation((code, id, count) => {
      counts.push(count)
      return Promise.resolve({ words: [] })
    })
    const game = joinedGame()

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

  it('refuses to draw without a game', async () => {
    const notify = vi.fn()
    const game = useGame({ notify })
    game.playerID.value = 'p1'
    await game.draw()
    expect(api.draw).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('Join a game'), 'error')
  })

  it('populates the pool from the drawn tiles', async () => {
    api.draw.mockResolvedValue({ words: ['1|the', '2|secret'] })
    const game = joinedGame()
    await game.draw()
    expect(game.pool.value).toEqual([
      { id: '1', word: 'the' },
      { id: '2', word: 'secret' },
    ])
  })

  it('clears the loading flag and toasts the message on failure', async () => {
    api.draw.mockRejectedValue(new ApiError('boom', 500))
    const notify = vi.fn()
    const game = joinedGame(notify)
    await game.draw()
    expect(notify).toHaveBeenCalledWith('boom', 'error')
    expect(game.isDrawing.value).toBe(false)
  })

  it('bounces to the join screen when the game has ended (404)', async () => {
    api.draw.mockRejectedValue(new ApiError('game 1234 not found', 404))
    const notify = vi.fn()
    const game = joinedGame(notify)
    await game.draw()
    expect(game.gameCode.value).toBe('')
    expect(notify).toHaveBeenCalledWith('This game has ended.', 'error')
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
    const game = joinedGame(notify)
    game.pool.value = [
      { id: '1', word: 'the' },
      { id: '2', word: 'secret' },
    ]
    game.addToNote('1')

    await game.submit()

    expect(api.submit).toHaveBeenCalledWith('1234', 'p1', ['1|the'])
    expect(game.noteTiles.value).toEqual([])
    expect(game.pool.value).toEqual([{ id: '2', word: 'secret' }])
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('submitted'), 'success')
  })

  it('refuses to submit an empty note', async () => {
    const notify = vi.fn()
    const game = joinedGame(notify)
    await game.submit()
    expect(api.submit).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('Add some words'), 'error')
  })
})

describe('pool reconciliation', () => {
  it('prunes note ids whose tiles disappear after a refetch', async () => {
    api.getTiles.mockResolvedValue({ words: ['1|the'] })
    const game = joinedGame()
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
