import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import NoteTray from './NoteTray.vue'
import WordTile from './WordTile.vue'

const tiles = [
  { id: '1', word: 'the' },
  { id: '2', word: 'secret' },
  { id: '3', word: 'banana' },
]

describe('NoteTray', () => {
  it('shows a hint and no tiles when the note is empty', () => {
    const wrapper = mount(NoteTray, { props: { tiles: [], preview: '' } })
    expect(wrapper.findAllComponents(WordTile)).toHaveLength(0)
    expect(wrapper.find('.note-tray__hint').exists()).toBe(true)
  })

  it('renders ordered tiles and the live preview', () => {
    const wrapper = mount(NoteTray, {
      props: { tiles, preview: 'the secret banana' },
    })
    expect(wrapper.findAllComponents(WordTile)).toHaveLength(3)
    expect(wrapper.find('.note-tray__preview-text').text()).toBe(
      'the secret banana'
    )
  })

  it('emits remove with the tile id when a tile is clicked', async () => {
    const wrapper = mount(NoteTray, { props: { tiles, preview: '' } })
    await wrapper.findAllComponents(WordTile)[1].trigger('click')
    expect(wrapper.emitted('remove')).toEqual([['2']])
  })

  it('disables the left nudge on the first tile and right on the last', () => {
    const wrapper = mount(NoteTray, { props: { tiles, preview: '' } })
    const items = wrapper.findAll('.note-tray__item')
    const firstNudges = items[0].findAll('.nudge')
    const lastNudges = items[2].findAll('.nudge')
    expect(firstNudges[0].attributes('disabled')).toBeDefined() // left, first
    expect(lastNudges[1].attributes('disabled')).toBeDefined() // right, last
  })

  it('emits move with a direction when a nudge is clicked', async () => {
    const wrapper = mount(NoteTray, { props: { tiles, preview: '' } })
    const middle = wrapper.findAll('.note-tray__item')[1]
    await middle.findAll('.nudge')[0].trigger('click') // nudge left
    expect(wrapper.emitted('move')).toEqual([[{ id: '2', dir: -1 }]])
  })

  it('clears a short note immediately', async () => {
    const wrapper = mount(NoteTray, {
      props: { tiles: tiles.slice(0, 2), preview: '' },
    })
    await wrapper.find('.link-btn--danger').trigger('click')
    expect(wrapper.emitted('clear')).toEqual([[]])
  })

  it('asks for confirmation before clearing a long note', async () => {
    const longTiles = Array.from({ length: 5 }, (_, i) => ({
      id: String(i),
      word: `w${i}`,
    }))
    const wrapper = mount(NoteTray, { props: { tiles: longTiles, preview: '' } })
    const clearBtn = wrapper.find('.link-btn--danger')

    await clearBtn.trigger('click')
    expect(wrapper.emitted('clear')).toBeUndefined()
    expect(clearBtn.text()).toContain('Confirm')

    await clearBtn.trigger('click')
    expect(wrapper.emitted('clear')).toEqual([[]])
  })
})
