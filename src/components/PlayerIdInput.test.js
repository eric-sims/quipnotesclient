import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import PlayerIdInput from './PlayerIdInput.vue'

afterEach(() => {
  vi.unstubAllGlobals()
})

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

  it('alerts and does not emit when the input is empty', async () => {
    const alertMock = vi.fn()
    vi.stubGlobal('alert', alertMock)
    const wrapper = mount(PlayerIdInput, { props: { isDisabled: false } })
    await wrapper.find('button').trigger('click')
    expect(alertMock).toHaveBeenCalledOnce()
    expect(wrapper.emitted('update-player-id')).toBeUndefined()
  })

  it('does nothing when disabled', async () => {
    const alertMock = vi.fn()
    vi.stubGlobal('alert', alertMock)
    const wrapper = mount(PlayerIdInput, { props: { isDisabled: true } })
    await wrapper.find('input').setValue('player-3')
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('update-player-id')).toBeUndefined()
    expect(alertMock).not.toHaveBeenCalled()
  })
})
