import { describe, it, expect } from 'vitest'
import {
  parseItemTime, formatTime, formatDate,
  dateKeyFromItem, todayKey, formatDayLabel,
} from '../lib/format'

describe('parseItemTime', () => {
  it('parses published_at ISO string', () => {
    const d = parseItemTime({ published_at: '2026-07-26T10:30:00.000Z' })
    expect(d).toBeInstanceOf(Date)
    expect(d.getTime()).not.toBeNaN()
  })

  it('parses create_time with space format', () => {
    const d = parseItemTime({ create_time: '2026-07-26 10:30:00' })
    expect(d).toBeInstanceOf(Date)
    expect(d.getTime()).not.toBeNaN()
  })

  it('returns null for missing time fields', () => {
    expect(parseItemTime({})).toBeNull()
  })

  it('returns null for invalid date', () => {
    expect(parseItemTime({ published_at: 'not-a-date' })).toBeNull()
  })

  it('prefers published_at over create_time', () => {
    const early = '2026-01-01T00:00:00.000Z'
    const late = '2026-07-26T00:00:00.000Z'
    const d = parseItemTime({ published_at: early, create_time: late })
    expect(d.toISOString()).toBe(new Date(early).toISOString())
  })
})

describe('formatTime', () => {
  it('formats valid date to HH:MM', () => {
    const d = new Date('2026-07-26T10:30:00+08:00')
    expect(formatTime(d)).toBe('10:30')
  })

  it('returns --:-- for null', () => {
    expect(formatTime(null)).toBe('--:--')
  })

  it('returns --:-- for invalid date', () => {
    expect(formatTime(new Date('invalid'))).toBe('--:--')
  })
})

describe('formatDate', () => {
  it('formats date as MM/DD', () => {
    const d = new Date('2026-07-26T10:30:00+08:00')
    expect(formatDate(d)).toBe('07/26')
  })

  it('returns empty for null', () => {
    expect(formatDate(null)).toBe('')
  })
})

describe('dateKeyFromItem', () => {
  it('extracts date key from published_at', () => {
    const d = new Date('2026-07-26T10:30:00+08:00')
    const key = dateKeyFromItem({ published_at: d.toISOString() })
    expect(key).toBe('2026-07-26')
  })

  it('returns "unknown" for missing date', () => {
    expect(dateKeyFromItem({})).toBe('unknown')
  })

  it('extracts date from create_time', () => {
    const key = dateKeyFromItem({ create_time: '2026-07-26 10:30:00' })
    expect(key).toBe('2026-07-26')
  })
})

describe('todayKey', () => {
  it('returns a yyyy-mm-dd format string', () => {
    expect(todayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('formatDayLabel', () => {
  it('formats a date key', () => {
    expect(formatDayLabel('2026-07-25')).toContain('07/25')
  })

  it('returns "今天" for today', () => {
    const today = todayKey()
    expect(formatDayLabel(today)).toBe('今天')
  })

  it('returns "未知日期" for unknown', () => {
    expect(formatDayLabel('unknown')).toBe('未知日期')
  })
})
