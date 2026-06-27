import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PlayerIdInput from './PlayerIdInput.vue'

describe('PlayerIdInput', () => {
  it('emits update-player-id with the trimmed value on click', async () => {
    const wrapper = mount(PlayerIdInput, { props: { isDisabled: false } })
    await wrapper.find('input').setValue('  player-1  ')
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('update-player-id')).toEqual([['player-1']])
  })

  it('emits on Enter keydown', async () => {
    const wrapper = mount(PlayerIdInput, { props: { isDisabled: false } })
    await wrapper.find('input').setValue('player-2')
    await wrapper.find('input').trigger('keydown.enter')
    expect(wrapper.emitted('update-player-id')).toEqual([['player-2']])
  })

  it('shows an inline error and does not emit when the input is empty', async () => {
    const wrapper = mount(PlayerIdInput, { props: { isDisabled: false } })
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('update-player-id')).toBeUndefined()
    expect(wrapper.find('.player-id-input__error').text()).toContain(
      'cannot be empty'
    )
  })

  it('clears the error once the user types again', async () => {
    const wrapper = mount(PlayerIdInput, { props: { isDisabled: false } })
    await wrapper.find('button').trigger('click')
    expect(wrapper.find('.player-id-input__error').exists()).toBe(true)
    await wrapper.find('input').setValue('x')
    expect(wrapper.find('.player-id-input__error').exists()).toBe(false)
  })

  it('does nothing when disabled', async () => {
    const wrapper = mount(PlayerIdInput, { props: { isDisabled: true } })
    await wrapper.find('input').setValue('player-3')
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('update-player-id')).toBeUndefined()
    expect(wrapper.find('.player-id-input__error').exists()).toBe(false)
  })
})
