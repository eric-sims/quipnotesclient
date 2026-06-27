import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SelectedWords from './SelectedWords.vue'
import WordTile from './WordTile.vue'

describe('SelectedWords', () => {
  const selectedWords = ['1|secret', '2|banana']

  it('renders one WordTile per selected word', () => {
    const wrapper = mount(SelectedWords, { props: { selectedWords } })
    expect(wrapper.findAllComponents(WordTile)).toHaveLength(2)
  })

  it('re-emits remove-from-selected-words when a tile is clicked', async () => {
    const wrapper = mount(SelectedWords, { props: { selectedWords } })
    await wrapper.findAllComponents(WordTile)[0].trigger('click')
    expect(wrapper.emitted('remove-from-selected-words')).toEqual([['1|secret']])
  })
})
