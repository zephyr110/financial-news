import path from 'path'
import os from 'os'
import { describe, it, expect, beforeEach } from 'vitest'
import { getEffectiveLlmConfig, getChatCompletionsUrl } from '../lib/llm/config'
import { setSettings, SETTING_KEYS } from '../lib/settings'

// 隔离 DB：settings 写入不能落在共享的项目 DB（并行 worker 会互相污染/锁冲突）
process.env.NEWS_DB_PATH = path.join(os.tmpdir(), `test-llmcfg-${process.pid}.db`)

/**
 * 设置弹窗（app_settings 表）覆盖环境变量：model/baseUrl/apiKey 优先级测试。
 */
describe('getEffectiveLlmConfig', () => {
  beforeEach(async () => {
    await setSettings({
      [SETTING_KEYS.LLM_MODEL]: null,
      [SETTING_KEYS.LLM_BASE_URL]: null,
      [SETTING_KEYS.LLM_API_KEY]: null,
    })
  })

  it('falls back to env defaults when no settings set', async () => {
    const cfg = await getEffectiveLlmConfig()
    expect(cfg.model).toBe(process.env.LLM_MODEL || 'deepseek-v4-flash')
    expect(cfg.apiKey).toBe(process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY || undefined)
    expect(cfg.baseUrl).toBe((process.env.LLM_BASE_URL || 'https://api.deepseek.com/v1').replace(/\/+$/, ''))
  })

  it('prefers settings over env', async () => {
    await setSettings({
      [SETTING_KEYS.LLM_MODEL]: 'db-model',
      [SETTING_KEYS.LLM_BASE_URL]: 'https://db.example.com/v1/',
      [SETTING_KEYS.LLM_API_KEY]: 'db-key',
    })
    const cfg = await getEffectiveLlmConfig()
    expect(cfg.model).toBe('db-model')
    expect(cfg.baseUrl).toBe('https://db.example.com/v1')
    expect(cfg.apiKey).toBe('db-key')
  })

  it('cleared setting falls back to env', async () => {
    await setSettings({ [SETTING_KEYS.LLM_MODEL]: 'db-model' })
    await setSettings({ [SETTING_KEYS.LLM_MODEL]: null }) // 清除
    const cfg = await getEffectiveLlmConfig()
    expect(cfg.model).toBe(process.env.LLM_MODEL || 'deepseek-v4-flash')
  })

  it('chat completions URL resolution keeps trailing path variants', () => {
    expect(getChatCompletionsUrl()).toMatch(/\/chat\/completions$/)
  })
})
