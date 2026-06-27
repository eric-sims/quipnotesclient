import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TileContainer from './TileContainer.vue'
import WordTile from './WordTile.vue'

describe('TileContainer', () => {
  const words = ['1|secret', '2|banana', '3|robot']

  it('renders one WordTile per word', () => {
    const wrapper = mount(TileContainer, {
      props: { words, selectedWords: [] },
    })
    expect(wrapper.findAllComponents(WordTile)).toHaveLength(3)
  })

  it('marks tiles in selectedWords as clicked', () => {
    const wrapper = mount(TileContainer, {
      props: { words, selectedWords: ['2|banana'] },
    })
    const tiles = wrapper.findAllComponents(WordTile)
    expect(tiles.map((t) => t.props('isClicked'))).toEqual([false, true, false])
  })

  it('re-emits tile-selected from a child tile', async () => {
    const wrapper = mount(TileContainer, {
      props: { words, selectedWords: [] },
    })
    await wrapper.findAllComponents(WordTile)[1].trigger('click')
    expect(wrapper.emitted('tile-selected')).toEqual([['2|banana']])
  })
})
