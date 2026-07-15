import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PosTabs from './PosTabs.vue'
import TileContainer from './TileContainer.vue'
import WordTile from './WordTile.vue'
import { POS_INFO } from '../tiles.js'

describe('PosTabs', () => {
  const tiles = [
    { id: '1', word: 'banana', pos: ['noun'] },
    { id: '2', word: 'play', pos: ['noun', 'verb'] },
    { id: '3', word: 'quietly', pos: ['adverb'] },
  ]

  function tabButtons(wrapper) {
    return wrapper.findAll('.pos-tabs__tab')
  }

  it('renders only non-empty tabs, in standard order, with counts', () => {
    const wrapper = mount(PosTabs, { props: { tiles } })
    const tabs = tabButtons(wrapper)
    expect(tabs.map((t) => t.text().replace(/\s+/g, ' '))).toEqual([
      'Noun 2',
      'Verb 1',
      'Adverb 1',
    ])
  })

  it('shows the active tab definition and its tiles', () => {
    const wrapper = mount(PosTabs, { props: { tiles } })
    // First group (noun) is active by default.
    expect(wrapper.find('.pos-tabs__definition').text()).toBe(POS_INFO.noun.definition)
    const words = wrapper.findAllComponents(WordTile).map((t) => t.props('word'))
    expect(words).toEqual(['banana', 'play'])
  })

  it('switches tiles when another tab is clicked', async () => {
    const wrapper = mount(PosTabs, { props: { tiles } })
    await tabButtons(wrapper)[1].trigger('click') // Verb
    expect(wrapper.find('.pos-tabs__definition').text()).toBe(POS_INFO.verb.definition)
    const words = wrapper.findAllComponents(WordTile).map((t) => t.props('word'))
    expect(words).toEqual(['play'])
    expect(tabButtons(wrapper)[1].attributes('aria-selected')).toBe('true')
  })

  it('re-emits add with the tile id and passes usedIds through', async () => {
    const wrapper = mount(PosTabs, {
      props: { tiles, usedIds: new Set(['1']) },
    })
    expect(wrapper.findComponent(TileContainer).props('usedIds')).toEqual(new Set(['1']))
    await wrapper.findAllComponents(WordTile)[1].trigger('click')
    expect(wrapper.emitted('add')).toEqual([['2']])
  })

  it('falls back to the first remaining tab when the active one empties', async () => {
    const wrapper = mount(PosTabs, { props: { tiles } })
    await tabButtons(wrapper)[2].trigger('click') // Adverb
    await wrapper.setProps({ tiles: tiles.slice(0, 2) }) // adverb tile gone
    expect(wrapper.find('.pos-tabs__definition').text()).toBe(POS_INFO.noun.definition)
  })

  it('shows an empty state when there are no tiles', () => {
    const wrapper = mount(PosTabs, { props: { tiles: [] } })
    expect(wrapper.find('.pos-tabs__empty').exists()).toBe(true)
    expect(wrapper.findAll('.pos-tabs__tab')).toHaveLength(0)
  })
})
