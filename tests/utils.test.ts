import { describe, it, expect } from 'vitest'
import { cn, safeParse } from '../lib/utils'

describe('cn', () => {
  it('merges tailwind classes', () => {
    expect(cn('px-4', 'py-2')).toBe('px-4 py-2')
  })

  it('removes conflicting tailwind classes', () => {
    expect(cn('px-4', 'px-2')).toBe('px-2')
  })

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible')
  })

  it('handles empty input', () => {
    expect(cn()).toBe('')
  })
})

describe('safeParse', () => {
  it('parses valid JSON', () => {
    expect(safeParse('["a","b"]')).toEqual(['a', 'b'])
  })

  it('returns empty array on invalid JSON', () => {
    expect(safeParse('not json')).toEqual([])
  })

  it('returns empty array on null/undefined', () => {
    expect(safeParse(null)).toEqual([])
    expect(safeParse(undefined)).toEqual([])
  })

  it('parses object JSON', () => {
    expect(safeParse('{"key":"val"}')).toEqual({ key: 'val' })
  })
})
