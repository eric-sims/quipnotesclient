import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import WordTile from './WordTile.vue'

describe('WordTile', () => {
  it('renders only the word part of "<id>|<word>"', () => {
    const wrapper = mount(WordTile, {
      props: { word: '5|banana', clickable: true, isClicked: false },
    })
    expect(wrapper.text()).toBe('banana')
  })

  it('emits tile-selected with the full word when clicked and clickable', async () => {
    const wrapper = mount(WordTile, {
      props: { word: '5|banana', clickable: true, isClicked: false },
    })
    await wrapper.trigger('click')
    expect(wrapper.emitted('tile-selected')).toEqual([['5|banana']])
  })

  it('does not emit when not clickable', async () => {
    const wrapper = mount(WordTile, {
      props: { word: '5|banana', clickable: false, isClicked: false },
    })
    await wrapper.trigger('click')
    expect(wrapper.emitted('tile-selected')).toBeUndefined()
  })

  it('applies the clicked class when isClicked is true', () => {
    const wrapper = mount(WordTile, {
      props: { word: '5|banana', clickable: true, isClicked: true },
    })
    expect(wrapper.classes()).toContain('clicked')
  })
})
