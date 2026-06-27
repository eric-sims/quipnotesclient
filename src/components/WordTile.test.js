import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import WordTile from './WordTile.vue'

describe('WordTile', () => {
  it('renders the word it is given verbatim (no "|" parsing)', () => {
    const wrapper = mount(WordTile, { props: { word: 'banana' } })
    expect(wrapper.text()).toBe('banana')
  })

  it('emits select (no payload) when clicked and clickable', async () => {
    const wrapper = mount(WordTile, { props: { word: 'banana' } })
    await wrapper.trigger('click')
    expect(wrapper.emitted('select')).toEqual([[]])
  })

  it('does not emit when not clickable', async () => {
    const wrapper = mount(WordTile, {
      props: { word: 'banana', clickable: false },
    })
    await wrapper.trigger('click')
    expect(wrapper.emitted('select')).toBeUndefined()
    expect(wrapper.attributes('disabled')).toBeDefined()
  })

  it('does not emit and is disabled when in use', async () => {
    const wrapper = mount(WordTile, {
      props: { word: 'banana', inUse: true },
    })
    await wrapper.trigger('click')
    expect(wrapper.emitted('select')).toBeUndefined()
    expect(wrapper.classes()).toContain('tile--in-use')
  })

  it('applies the variant class', () => {
    const wrapper = mount(WordTile, {
      props: { word: 'banana', variant: 'note' },
    })
    expect(wrapper.classes()).toContain('tile--note')
  })
})
