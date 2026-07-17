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
      leaveGame: vi.fn(),
      draw: vi.fn(),
      submit: vi.fn(),
      getTiles: vi.fn(),
      getRound: vi.fn(),
      nextRound: vi.fn(),
      getNotes: vi.fn(),
      openJudging: vi.fn(),
      flipNote: vi.fn(),
      pickFavorite: vi.fn(),
    },
  }
})

import { useGame } from './useGame.js'
import { api, ApiError } from '../api.js'

beforeEach(() => {
  window.localStorage.clear()
  api.getGame.mockReset().mockResolvedValue({ code: '1234', players: [] })
  api.joinGame.mockReset().mockResolvedValue({ id: 'p1' })
  api.leaveGame.mockReset().mockResolvedValue(null)
  api.draw.mockReset().mockResolvedValue({ words: [] })
  api.submit.mockReset().mockResolvedValue({ ok: true })
  api.getTiles.mockReset().mockResolvedValue({ words: [] })
  api.getRound.mockReset().mockResolvedValue({ round: 0, prompt: '' })
  api.nextRound.mockReset().mockResolvedValue({ round: 2, prompt: 'Next prompt', judgeId: '' })
  api.getNotes.mockReset().mockResolvedValue({ notes: [] })
  api.openJudging.mockReset().mockResolvedValue(null)
  api.flipNote.mockReset().mockResolvedValue(null)
  api.pickFavorite.mockReset().mockResolvedValue({ winnerId: '' })
})

// Put a game into "joined and playing" state for the action tests. By default
// an active round is set so submit() isn't gated; pass { round: 0 } to test the
// pre-prompt state.
function joinedGame(notify, { round = 1, prompt = 'A terrible name for a boat' } = {}) {
  const game = useGame(notify ? { notify } : undefined)
  game.playerID.value = 'p1'
  game.gameCode.value = '1234'
  game.round.value = round
  game.prompt.value = prompt
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
    expect(game.pool.value).toEqual([{ id: '7', word: 'robot', pos: ['other'] }])
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
    api.draw.mockResolvedValue({
      words: ['1|the', '2|secret'],
      pos: { '2|secret': ['noun', 'adjective'] },
    })
    const game = joinedGame()
    await game.draw()
    expect(game.pool.value).toEqual([
      // "1|the" is missing from the pos map (e.g. an older server), so it
      // defaults to "other".
      { id: '1', word: 'the', pos: ['other'] },
      { id: '2', word: 'secret', pos: ['noun', 'adjective'] },
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

  it('inserts a movable line break that shows up in the preview', () => {
    const game = gameWithPool()
    game.addToNote('1')
    game.addBreak()
    game.addToNote('2')
    const entries = game.noteTiles.value
    expect(entries.map((t) => (t.isBreak ? 'BR' : t.id))).toEqual(['1', 'BR', '2'])
    expect(game.notePreview.value).toBe('the / secret')

    // A break is nudged and removed by id just like a tile.
    const breakId = entries[1].id
    game.moveTile(breakId, -1)
    expect(game.noteTiles.value.map((t) => (t.isBreak ? 'BR' : t.id))).toEqual([
      'BR',
      '1',
      '2',
    ])
    game.removeFromNote(breakId)
    expect(game.noteTiles.value.every((t) => !t.isBreak)).toBe(true)
  })

  it('keeps break entries when the pool is refreshed', async () => {
    // A refresh that still holds both tiles must not drop the break between them.
    api.getTiles.mockResolvedValue({ words: ['1|the', '2|secret'] })
    const game = joinedGame(vi.fn())
    game.pool.value = [
      { id: '1', word: 'the' },
      { id: '2', word: 'secret' },
    ]
    game.addToNote('1')
    game.addBreak()
    game.addToNote('2')

    await game.refreshTiles({ silent: true })

    expect(game.noteTiles.value.map((t) => (t.isBreak ? 'BR' : t.id))).toEqual([
      '1',
      'BR',
      '2',
    ])
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
    expect(game.pool.value).toEqual([{ id: '2', word: 'secret', pos: ['other'] }])
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('submitted'), 'success')
  })

  it('serializes line breaks as the reserved break token', async () => {
    api.getTiles.mockResolvedValue({ words: [] })
    const game = joinedGame(vi.fn())
    game.pool.value = [
      { id: '1', word: 'the' },
      { id: '2', word: 'secret' },
    ]
    game.addToNote('1')
    game.addBreak()
    game.addToNote('2')

    await game.submit()

    expect(api.submit).toHaveBeenCalledWith('1234', 'p1', ['1|the', '\n', '2|secret'])
  })

  it('refuses to submit an empty note', async () => {
    const notify = vi.fn()
    const game = joinedGame(notify)
    await game.submit()
    expect(api.submit).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('Add some words'), 'error')
  })

  it('refuses to submit a note that is only line breaks', async () => {
    const notify = vi.fn()
    const game = joinedGame(notify)
    game.addBreak()
    game.addBreak()
    await game.submit()
    expect(api.submit).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('Add some words'), 'error')
  })
})

describe('rounds', () => {
  it('fetches the current round when joining', async () => {
    api.getRound.mockResolvedValue({ round: 2, prompt: 'A rejected slogan' })
    const game = useGame()
    game.playerID.value = 'p1'

    await game.joinGame('1234')

    expect(api.getRound).toHaveBeenCalledWith('1234')
    expect(game.round.value).toBe(2)
    expect(game.prompt.value).toBe('A rejected slogan')
  })

  it('a round_started event sets the prompt and re-enables submitting', () => {
    const game = joinedGame()
    game.hasSubmittedThisRound.value = true

    game.handleRoundEvent({ type: 'round_started', round: 3, prompt: 'Next one' })

    expect(game.round.value).toBe(3)
    expect(game.prompt.value).toBe('Next one')
    expect(game.hasSubmittedThisRound.value).toBe(false)
  })

  it('a game_ended event returns to the join screen', () => {
    const notify = vi.fn()
    const game = joinedGame(notify)
    game.handleRoundEvent({ type: 'game_ended' })
    expect(game.gameCode.value).toBe('')
    expect(notify).toHaveBeenCalledWith('This game has ended.', 'error')
  })

  it('refuses to submit before a prompt is drawn', async () => {
    const notify = vi.fn()
    const game = joinedGame(notify, { round: 0, prompt: '' })
    game.pool.value = [{ id: '1', word: 'the' }]
    game.addToNote('1')

    await game.submit()

    expect(api.submit).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('first round'), 'error')
  })

  it('refuses a second submission in the same round', async () => {
    const notify = vi.fn()
    const game = joinedGame(notify)
    game.hasSubmittedThisRound.value = true
    game.pool.value = [{ id: '1', word: 'the' }]
    game.addToNote('1')

    await game.submit()

    expect(api.submit).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('already answered'), 'error')
  })

  it('marks the round as submitted after a successful submit', async () => {
    const game = joinedGame()
    game.pool.value = [{ id: '1', word: 'the' }]
    game.addToNote('1')

    await game.submit()

    expect(api.submit).toHaveBeenCalled()
    expect(game.hasSubmittedThisRound.value).toBe(true)
  })

  it('locks the button (but stays in the game) on a 409 conflict', async () => {
    api.submit.mockRejectedValue(new ApiError('you already submitted a note this round', 409))
    const notify = vi.fn()
    const game = joinedGame(notify)
    game.pool.value = [{ id: '1', word: 'the' }]
    game.addToNote('1')

    await game.submit()

    expect(game.hasSubmittedThisRound.value).toBe(true)
    expect(game.gameCode.value).toBe('1234') // not bounced to join
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('already submitted'), 'error')
  })
})

describe('judging', () => {
  // p1 is this round's judge unless a test says otherwise. A judge reacts to
  // round_started by pulling the full round state, so keep the mocked GET
  // /round consistent with the event (the default {round: 0} would clobber it).
  function judgingGame(notify, { judge = 'p1' } = {}) {
    api.getRound.mockResolvedValue({
      round: 1,
      prompt: 'A terrible name for a boat',
      judgeId: judge,
      judgingOpen: false,
      count: 0,
      total: 1,
      favoriteNoteId: 0,
      winnerId: '',
    })
    const game = joinedGame(notify)
    game.handleRoundEvent({
      type: 'round_started',
      round: 1,
      prompt: 'A terrible name for a boat',
      judgeId: judge,
    })
    return game
  }

  it('recognizes itself as the judge from round_started', () => {
    const game = judgingGame(vi.fn())
    expect(game.judgeId.value).toBe('p1')
    expect(game.isJudge.value).toBe(true)
  })

  it('is not the judge when someone else is named (or nobody is)', () => {
    const game = judgingGame(vi.fn(), { judge: 'p2' })
    expect(game.isJudge.value).toBe(false)
    game.handleRoundEvent({ type: 'round_started', round: 2, prompt: 'Next' })
    expect(game.judgeId.value).toBe('')
    expect(game.isJudge.value).toBe(false)
  })

  it('blocks the judge from submitting, without calling the server', async () => {
    const notify = vi.fn()
    const game = judgingGame(notify)
    game.pool.value = [{ id: '1', word: 'the' }]
    game.addToNote('1')

    await game.submit()

    expect(api.submit).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('judge'), 'error')
  })

  it('tracks live submission progress for the waiting judge', () => {
    const game = judgingGame(vi.fn())
    game.handleRoundEvent({ type: 'submission', round: 1, count: 2, total: 3 })
    expect(game.submissionCount.value).toBe(2)
    expect(game.submissionTotal.value).toBe(3)
  })

  it('judging_ready opens judging and fetches the board for the judge', async () => {
    api.getNotes.mockResolvedValue({
      notes: [{ id: 1, tokens: ['1|the'], flipped: false }],
    })
    const game = judgingGame(vi.fn())

    game.handleRoundEvent({ type: 'judging_ready', round: 1 })
    await Promise.resolve() // let the fetch settle

    expect(game.judgingOpen.value).toBe(true)
    expect(api.getNotes).toHaveBeenCalledWith('1234')
    expect(game.judgeNotes.value).toEqual([
      { id: 1, tokens: ['1|the'], flipped: false },
    ])
  })

  it('judging_ready does not fetch notes for a non-judge', () => {
    const game = judgingGame(vi.fn(), { judge: 'p2' })
    game.handleRoundEvent({ type: 'judging_ready', round: 1 })
    expect(game.judgingOpen.value).toBe(true)
    expect(api.getNotes).not.toHaveBeenCalled()
  })

  it('blocks submission once judging opens', async () => {
    const notify = vi.fn()
    const game = judgingGame(notify, { judge: 'p2' })
    game.handleRoundEvent({ type: 'judging_ready', round: 1 })
    game.pool.value = [{ id: '1', word: 'the' }]
    game.addToNote('1')

    await game.submit()

    expect(api.submit).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('Judging'), 'error')
  })

  it('forceJudging opens judging early and loads the board', async () => {
    api.getNotes.mockResolvedValue({ notes: [] })
    const game = judgingGame(vi.fn())

    await game.forceJudging()

    expect(api.openJudging).toHaveBeenCalledWith('1234')
    expect(game.judgingOpen.value).toBe(true)
    expect(api.getNotes).toHaveBeenCalled()
  })

  it('flipNote calls the server and flips the local card immediately', async () => {
    api.getNotes.mockResolvedValue({
      notes: [{ id: 1, tokens: ['1|the'], flipped: false }],
    })
    const game = judgingGame(vi.fn())
    game.handleRoundEvent({ type: 'judging_ready', round: 1 })
    await Promise.resolve() // let the board fetch settle

    await game.flipNote(1)

    expect(api.flipNote).toHaveBeenCalledWith('1234', 1)
    expect(game.judgeNotes.value[0].flipped).toBe(true)
  })

  it('a note_flipped broadcast flips the matching card', () => {
    const game = judgingGame(vi.fn())
    game.judgeNotes.value = [
      { id: 1, tokens: ['1|the'], flipped: false },
      { id: 2, tokens: ['2|secret'], flipped: false },
    ]
    game.handleRoundEvent({ type: 'note_flipped', round: 1, noteId: 2 })
    expect(game.judgeNotes.value.map((n) => n.flipped)).toEqual([false, true])
  })

  it('pickFavorite records the winner and refuses a second pick', async () => {
    api.pickFavorite.mockResolvedValue({ winnerId: 'p2' })
    const game = judgingGame(vi.fn())
    game.handleRoundEvent({ type: 'judging_ready', round: 1 })
    game.judgeNotes.value = [{ id: 1, tokens: ['1|the'], flipped: true }]

    await game.pickFavorite(1)

    expect(api.pickFavorite).toHaveBeenCalledWith('1234', 1)
    expect(game.favoriteNoteId.value).toBe(1)
    expect(game.winnerId.value).toBe('p2')

    await game.pickFavorite(1)
    expect(api.pickFavorite).toHaveBeenCalledTimes(1)
  })

  it('celebrates on this screen when my note is picked', () => {
    const notify = vi.fn()
    const game = judgingGame(notify, { judge: 'p2' }) // I'm p1, writing
    game.handleRoundEvent({
      type: 'favorite_picked',
      round: 1,
      noteId: 3,
      winnerId: 'p1',
    })
    expect(game.winnerId.value).toBe('p1')
    expect(game.celebrate.value).toBe(true)
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('won'), 'success')
  })

  it("announces someone else's win without celebrating here", () => {
    const notify = vi.fn()
    const game = judgingGame(notify, { judge: 'p2' })
    game.handleRoundEvent({
      type: 'favorite_picked',
      round: 1,
      noteId: 3,
      winnerId: 'p3',
    })
    expect(game.celebrate.value).toBe(false)
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('p3'), 'success')
  })

  it('does not double-announce when the reveal broadcast echoes a local pick', async () => {
    api.pickFavorite.mockResolvedValue({ winnerId: 'p2' })
    const notify = vi.fn()
    const game = judgingGame(notify)
    game.handleRoundEvent({ type: 'judging_ready', round: 1 })
    game.judgeNotes.value = [{ id: 1, tokens: ['1|the'], flipped: true }]

    await game.pickFavorite(1)
    game.handleRoundEvent({
      type: 'favorite_picked',
      round: 1,
      noteId: 1,
      winnerId: 'p2',
    })

    const wins = notify.mock.calls.filter(([msg]) => msg.includes('won'))
    expect(wins).toHaveLength(1)
  })

  it('a new round resets the whole judging phase', () => {
    const game = judgingGame(vi.fn())
    game.handleRoundEvent({ type: 'judging_ready', round: 1 })
    game.judgeNotes.value = [{ id: 1, tokens: ['1|the'], flipped: true }]
    game.handleRoundEvent({
      type: 'favorite_picked',
      round: 1,
      noteId: 1,
      winnerId: 'p2',
    })

    game.handleRoundEvent({
      type: 'round_started',
      round: 2,
      prompt: 'Next',
      judgeId: 'p2',
    })

    expect(game.judgeId.value).toBe('p2')
    expect(game.judgingOpen.value).toBe(false)
    expect(game.judgeNotes.value).toEqual([])
    expect(game.favoriteNoteId.value).toBe(0)
    expect(game.winnerId.value).toBe('')
    expect(game.celebrate.value).toBe(false)
  })

  it('a re-announced round (judge replacement) keeps judging progress', () => {
    const game = judgingGame(vi.fn(), { judge: 'p2' })
    game.handleRoundEvent({ type: 'submission', round: 1, count: 1, total: 2 })
    game.handleRoundEvent({ type: 'judging_ready', round: 1 })

    // p2 left; the server re-broadcasts round 1 with a new judge.
    game.handleRoundEvent({
      type: 'round_started',
      round: 1,
      prompt: 'A terrible name for a boat',
      judgeId: 'p3',
    })

    expect(game.judgeId.value).toBe('p3')
    expect(game.judgingOpen.value).toBe(true)
    expect(game.submissionCount.value).toBe(1)
  })

  it('fetchRound restores a mid-judging state (refresh recovery)', async () => {
    api.getRound.mockResolvedValue({
      round: 2,
      prompt: 'A rejected slogan',
      judgeId: 'p1',
      judgingOpen: true,
      count: 2,
      total: 2,
      favoriteNoteId: 0,
      winnerId: '',
    })
    api.getNotes.mockResolvedValue({
      notes: [{ id: 1, tokens: ['1|the'], flipped: true }],
    })
    const game = joinedGame(vi.fn())

    await game.fetchRound()

    expect(game.isJudge.value).toBe(true)
    expect(game.judgingOpen.value).toBe(true)
    // The judge's board is re-fetched, flips included.
    expect(game.judgeNotes.value[0].flipped).toBe(true)
  })

  it('a stale round poll cannot regress judging state set by events', async () => {
    const game = judgingGame(vi.fn(), { judge: 'p2' })
    game.handleRoundEvent({ type: 'judging_ready', round: 1 })
    game.handleRoundEvent({
      type: 'favorite_picked',
      round: 1,
      noteId: 2,
      winnerId: 'p3',
    })

    // A poll response captured before those events landed (same round, phase
    // still "collecting notes") arrives late — it must not roll anything back.
    api.getRound.mockResolvedValue({
      round: 1,
      prompt: 'A terrible name for a boat',
      judgeId: 'p2',
      judgingOpen: false,
      count: 1,
      total: 2,
      favoriteNoteId: 0,
      winnerId: '',
    })
    await game.fetchRound()

    expect(game.judgingOpen.value).toBe(true)
    expect(game.favoriteNoteId.value).toBe(2)
    expect(game.winnerId.value).toBe('p3')
  })

  it('leaving the game clears judging state', () => {
    const game = judgingGame(vi.fn())
    game.handleRoundEvent({ type: 'judging_ready', round: 1 })
    game.leaveGame()
    expect(game.judgeId.value).toBe('')
    expect(game.judgingOpen.value).toBe(false)
    expect(game.judgeNotes.value).toEqual([])
  })
})

describe('leaving a game', () => {
  it('tells the server to remove the player so the host roster drops them', () => {
    const game = joinedGame(vi.fn())
    game.leaveGame()
    expect(api.leaveGame).toHaveBeenCalledWith('1234', 'p1')
  })

  it('returns to the join screen even if the leave call fails', async () => {
    api.leaveGame.mockRejectedValueOnce(new ApiError('Cannot reach the server', 0))
    const game = joinedGame(vi.fn())
    game.leaveGame()
    // Local state is cleared synchronously, regardless of the server call.
    expect(game.gameCode.value).toBe('')
    // Let the rejected best-effort call settle without an unhandled rejection.
    await Promise.resolve()
  })

  it('does not call the server when not in a game', () => {
    const game = useGame(vi.fn())
    game.playerID.value = 'p1'
    game.leaveGame()
    expect(api.leaveGame).not.toHaveBeenCalled()
  })
})

describe('advancing rounds from the phone', () => {
  // Mirror the server's AdvanceRound gating: the button belongs to exactly one
  // screen at a time (see canStartNextRound in useGame.js).
  it('anyone may start the first round (round 0)', () => {
    const game = joinedGame(vi.fn(), { round: 0, prompt: '' })
    expect(game.canStartNextRound.value).toBe(true)
  })

  it('a judged round belongs to the judge, and only after their pick', () => {
    const game = joinedGame(vi.fn())
    game.judgeId.value = 'p1' // this player judges
    expect(game.canStartNextRound.value).toBe(false) // no favorite yet
    game.winnerId.value = 'p2'
    expect(game.canStartNextRound.value).toBe(true)
  })

  it('non-judges never get the button in a judged round', () => {
    const game = joinedGame(vi.fn())
    game.judgeId.value = 'p2'
    game.winnerId.value = 'p3'
    game.hasSubmittedThisRound.value = true
    expect(game.canStartNextRound.value).toBe(false)
  })

  it('a judge-less round unlocks once this player has answered', () => {
    const game = joinedGame(vi.fn())
    expect(game.canStartNextRound.value).toBe(false)
    game.hasSubmittedThisRound.value = true
    expect(game.canStartNextRound.value).toBe(true)
  })

  it('startNextRound sends the current round and applies the new state', async () => {
    const game = joinedGame(vi.fn())
    game.hasSubmittedThisRound.value = true
    api.nextRound.mockResolvedValue({ round: 2, prompt: 'Fresh prompt', judgeId: 'p2' })

    await game.startNextRound()

    expect(api.nextRound).toHaveBeenCalledWith('1234', 'p1', 1)
    expect(game.round.value).toBe(2)
    expect(game.prompt.value).toBe('Fresh prompt')
    expect(game.judgeId.value).toBe('p2')
    // A new round re-opens submissions.
    expect(game.hasSubmittedThisRound.value).toBe(false)
  })

  it('a 409 (lost the race) surfaces a toast and re-syncs the round', async () => {
    const notify = vi.fn()
    const game = joinedGame(notify)
    api.nextRound.mockRejectedValue(
      new ApiError('the next round has already started', 409)
    )
    api.getRound.mockResolvedValue({
      round: 2,
      prompt: 'Someone else drew this',
      judgeId: '',
    })

    await game.startNextRound()

    expect(notify).toHaveBeenCalledWith(
      'the next round has already started',
      'error'
    )
    // Caught up to the round the other tap started.
    expect(game.round.value).toBe(2)
    expect(game.prompt.value).toBe('Someone else drew this')
  })

  it('a 404 means the game ended — back to the join screen', async () => {
    const notify = vi.fn()
    const game = joinedGame(notify)
    api.nextRound.mockRejectedValue(new ApiError('game not found', 404))

    await game.startNextRound()

    expect(game.gameCode.value).toBe('')
    expect(notify).toHaveBeenCalledWith('This game has ended.', 'error')
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
