import { describe, it, expect, vi, afterEach } from 'vitest'
import { useToasts } from './useToasts.js'

afterEach(() => {
  vi.useRealTimers()
})

describe('useToasts', () => {
  it('adds a toast with message and type', () => {
    const { toasts, notify } = useToasts(0)
    notify('hello', 'success')
    expect(toasts.value).toHaveLength(1)
    expect(toasts.value[0]).toMatchObject({ message: 'hello', type: 'success' })
  })

  it('defaults the type to info', () => {
    const { toasts, notify } = useToasts(0)
    notify('hi')
    expect(toasts.value[0].type).toBe('info')
  })

  it('dismisses a toast by id', () => {
    const { toasts, notify, dismiss } = useToasts(0)
    const id = notify('bye')
    dismiss(id)
    expect(toasts.value).toHaveLength(0)
  })

  it('auto-dismisses after the timeout', () => {
    vi.useFakeTimers()
    const { toasts, notify } = useToasts(1000)
    notify('temp')
    expect(toasts.value).toHaveLength(1)
    vi.advanceTimersByTime(1000)
    expect(toasts.value).toHaveLength(0)
  })

  it('assigns unique ids to successive toasts', () => {
    const { toasts, notify } = useToasts(0)
    notify('a')
    notify('b')
    const [a, b] = toasts.value
    expect(a.id).not.toBe(b.id)
  })
})
