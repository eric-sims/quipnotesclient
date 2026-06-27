import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TileContainer from './TileContainer.vue'
import WordTile from './WordTile.vue'

describe('TileContainer', () => {
  const tiles = [
    { id: '1', word: 'secret' },
    { id: '2', word: 'banana' },
    { id: '3', word: 'robot' },
  ]

  it('renders one WordTile per tile', () => {
    const wrapper = mount(TileContainer, { props: { tiles } })
    expect(wrapper.findAllComponents(WordTile)).toHaveLength(3)
  })

  it('marks tiles whose id is in usedIds as in use', () => {
    const wrapper = mount(TileContainer, {
      props: { tiles, usedIds: new Set(['2']) },
    })
    const flags = wrapper.findAllComponents(WordTile).map((t) => t.props('inUse'))
    expect(flags).toEqual([false, true, false])
  })

  it('accepts usedIds as a plain array too', () => {
    const wrapper = mount(TileContainer, {
      props: { tiles, usedIds: ['3'] },
    })
    const flags = wrapper.findAllComponents(WordTile).map((t) => t.props('inUse'))
    expect(flags).toEqual([false, false, true])
  })

  it('emits add with the tile id when a tile is selected', async () => {
    const wrapper = mount(TileContainer, { props: { tiles } })
    await wrapper.findAllComponents(WordTile)[1].trigger('click')
    expect(wrapper.emitted('add')).toEqual([['2']])
  })

  it('shows an empty state when there are no tiles', () => {
    const wrapper = mount(TileContainer, { props: { tiles: [] } })
    expect(wrapper.findAllComponents(WordTile)).toHaveLength(0)
    expect(wrapper.find('.tile-pool__empty').exists()).toBe(true)
  })
})
