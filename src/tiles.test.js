import { describe, it, expect } from 'vitest'
import { parseTile, formatTile } from './tiles.js'

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
