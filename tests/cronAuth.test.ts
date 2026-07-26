import { describe, it, expect, beforeEach, vi } from 'vitest'
import { assertCronAuth } from '../lib/cronAuth'

function mockReq(query = {}, headers = {}) {
  return { query, headers }
}

function mockRes() {
  const res: any = {
    _status: 200,
    _body: null,
    status(code: number) { this._status = code; return this },
    json(body: any) { this._body = body; return this },
  }
  return res
}

describe('assertCronAuth', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  it('allows local dev without CRON_SECRET', () => {
    const res = mockRes()
    expect(assertCronAuth(mockReq(), res)).toBe(true)
  })

  it('rejects on Vercel without CRON_SECRET', () => {
    vi.stubEnv('VERCEL', '1')
    const res = mockRes()
    expect(assertCronAuth(mockReq(), res)).toBe(false)
    expect(res._status).toBe(503)
  })

  it('rejects in production without CRON_SECRET', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const res = mockRes()
    expect(assertCronAuth(mockReq(), res)).toBe(false)
    expect(res._status).toBe(503)
  })

  it('accepts token in query', () => {
    vi.stubEnv('CRON_SECRET', 'secret123')
    const res = mockRes()
    expect(assertCronAuth(mockReq({ token: 'secret123' }), res)).toBe(true)
  })

  it('rejects wrong token', () => {
    vi.stubEnv('CRON_SECRET', 'secret123')
    const res = mockRes()
    expect(assertCronAuth(mockReq({ token: 'wrong' }), res)).toBe(false)
    expect(res._status).toBe(401)
  })

  it('accepts Bearer token', () => {
    vi.stubEnv('CRON_SECRET', 'secret123')
    const res = mockRes()
    expect(assertCronAuth(mockReq({}, { authorization: 'Bearer secret123' }), res)).toBe(true)
  })
})
