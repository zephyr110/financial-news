import path from 'path'
import os from 'os'
import { describe, it, expect, beforeAll } from 'vitest'
import {
  createAgentSession,
  agentSessionExists,
  deleteAgentSession,
  appendAgentMessage,
  getDb,
} from '../lib/db'

// 隔离 DB：本测试会建表/插入/删除，不能落在共享的项目 DB
process.env.NEWS_DB_PATH = path.join(os.tmpdir(), `test-agentsession-${process.pid}.db`)

/**
 * 悬空 sessionId 防御（生产事故回归保护）：
 * 浏览器 localStorage 可能缓存已删除的会话 → 向不存在的会话插入消息会触发
 * SQLITE_CONSTRAINT 外键错误 → agent 500「研究助手暂时不可用」。
 * 这里验证 exists 探测 + 删除后引用失效，确保回退逻辑可依赖。
 */
describe('agent session existence guard', () => {
  beforeAll(async () => {
    await getDb() // 触发建表
  })

  it('reports false for nonexistent session', async () => {
    expect(await agentSessionExists(999999)).toBe(false)
  })

  it('reports true after creation, false after deletion', async () => {
    const sid = await createAgentSession('guard-test')
    expect(await agentSessionExists(sid)).toBe(true)
    await deleteAgentSession(sid)
    expect(await agentSessionExists(sid)).toBe(false)
  })

  it('foreign key constraint rejects message insertion into deleted session', async () => {
    const sid = await createAgentSession('fk-test')
    await deleteAgentSession(sid)
    await expect(appendAgentMessage(sid, 'user', 'hello')).rejects.toThrow(/FOREIGN KEY|SQLITE_CONSTRAINT/i)
  })
})
