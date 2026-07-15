import { describe, it, expect } from 'vitest'
import {
  parseTile,
  formatTile,
  normalizePos,
  groupTilesByPos,
  POS_ORDER,
  POS_INFO,
} from './tiles.js'

describe('parseTile', () => {
  it('splits "<id>|<word>" into structured parts', () => {
    expect(parseTile('5|banana')).toEqual({ id: '5', word: 'banana' })
  })

  it('keeps everything after the first separator as the word', () => {
    expect(parseTile('5|two|words')).toEqual({ id: '5', word: 'two|words' })
  })

  it('treats a bare string with no separator as id == word', () => {
    expect(parseTile('banana')).toEqual({ id: 'banana', word: 'banana' })
  })
})

describe('formatTile', () => {
  it('rebuilds the wire format from a structured tile', () => {
    expect(formatTile({ id: '5', word: 'banana' })).toBe('5|banana')
  })

  it('round-trips with parseTile', () => {
    const raw = '42|midnight'
    expect(formatTile(parseTile(raw))).toBe(raw)
  })
})

describe('normalizePos', () => {
  it('lowercases and keeps only known tags', () => {
    expect(normalizePos(['NOUN', 'verb'])).toEqual(['noun', 'verb'])
  })

  it('drops unknown tags', () => {
    expect(normalizePos(['noun', 'nuon'])).toEqual(['noun'])
  })

  it('defaults to ["other"] for empty, unknown-only, or missing input', () => {
    expect(normalizePos([])).toEqual(['other'])
    expect(normalizePos(['nuon'])).toEqual(['other'])
    expect(normalizePos(undefined)).toEqual(['other'])
    expect(normalizePos('noun')).toEqual(['other'])
  })
})

describe('groupTilesByPos', () => {
  const tiles = [
    { id: '1', word: 'banana', pos: ['noun'] },
    { id: '2', word: 'play', pos: ['noun', 'verb'] },
    { id: '3', word: 'hey', pos: ['interjection'] },
    { id: '4', word: '!', pos: [] },
  ]

  it('groups into non-empty parts of speech in POS_ORDER', () => {
    const groups = groupTilesByPos(tiles)
    expect(groups.map((g) => g.pos)).toEqual(['noun', 'verb', 'interjection', 'other'])
  })

  it('puts a multi-POS tile in every matching group', () => {
    const groups = groupTilesByPos(tiles)
    const byPos = Object.fromEntries(groups.map((g) => [g.pos, g.tiles]))
    expect(byPos.noun.map((t) => t.id)).toEqual(['1', '2'])
    expect(byPos.verb.map((t) => t.id)).toEqual(['2'])
  })

  it('sends untagged tiles to "other" and carries label + definition', () => {
    const groups = groupTilesByPos(tiles)
    const other = groups.find((g) => g.pos === 'other')
    expect(other.tiles.map((t) => t.id)).toEqual(['4'])
    expect(other.label).toBe(POS_INFO.other.label)
    expect(other.definition).toBeTruthy()
  })

  it('returns no groups for an empty hand', () => {
    expect(groupTilesByPos([])).toEqual([])
    expect(groupTilesByPos(undefined)).toEqual([])
  })

  it('every POS tag has display info', () => {
    for (const tag of POS_ORDER) {
      expect(POS_INFO[tag].label).toBeTruthy()
      expect(POS_INFO[tag].definition).toBeTruthy()
    }
  })
})
