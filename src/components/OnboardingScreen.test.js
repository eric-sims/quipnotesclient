import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Onboarding from './OnboardingScreen.vue'

function fill(wrapper, playerId, code) {
  return Promise.all([
    wrapper.find('#onboarding-player').setValue(playerId),
    wrapper.find('#onboarding-code').setValue(code),
  ])
}

describe('Onboarding', () => {
  it('emits join with the trimmed player id and code', async () => {
    const wrapper = mount(Onboarding)
    await fill(wrapper, '  player-1  ', '1234')
    await wrapper.find('.onboarding__submit').trigger('click')
    expect(wrapper.emitted('join')).toEqual([
      [{ playerId: 'player-1', code: '1234' }],
    ])
  })

  it('prefills from initial props', () => {
    const wrapper = mount(Onboarding, {
      props: { initialPlayerId: 'pat', initialCode: '4321' },
    })
    expect(wrapper.find('#onboarding-player').element.value).toBe('pat')
    expect(wrapper.find('#onboarding-code').element.value).toBe('4321')
  })

  it('strips non-digits and caps the code at four characters', async () => {
    const wrapper = mount(Onboarding)
    await wrapper.find('#onboarding-code').setValue('12ab3456')
    expect(wrapper.find('#onboarding-code').element.value).toBe('1234')
  })

  it('errors and does not emit when the player id is empty', async () => {
    const wrapper = mount(Onboarding)
    await fill(wrapper, '   ', '1234')
    await wrapper.find('.onboarding__submit').trigger('click')
    expect(wrapper.emitted('join')).toBeUndefined()
    expect(wrapper.find('.onboarding__error').text()).toContain('Player ID')
  })

  it('errors and does not emit when the code is not four digits', async () => {
    const wrapper = mount(Onboarding)
    await fill(wrapper, 'player-1', '12')
    await wrapper.find('.onboarding__submit').trigger('click')
    expect(wrapper.emitted('join')).toBeUndefined()
    expect(wrapper.find('.onboarding__error').text()).toContain('4-digit')
  })

  it('joins on Enter from either field', async () => {
    const wrapper = mount(Onboarding)
    await fill(wrapper, 'player-1', '1234')
    await wrapper.find('#onboarding-player').trigger('keydown.enter')
    expect(wrapper.emitted('join')).toEqual([
      [{ playerId: 'player-1', code: '1234' }],
    ])
  })

  it('does nothing while joining', async () => {
    const wrapper = mount(Onboarding, { props: { isJoining: true } })
    await fill(wrapper, 'player-1', '1234')
    await wrapper.find('.onboarding__submit').trigger('click')
    expect(wrapper.emitted('join')).toBeUndefined()
  })
})
