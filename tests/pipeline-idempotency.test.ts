import { describe, it, expect, vi, beforeAll } from 'vitest';

// 用真实内存库（file::memory:）验证 SQL 约束语义——mock execute 无法验证 UNIQUE/ON CONFLICT
vi.hoisted(() => {
  process.env.NEWS_DB_PATH = ':memory:';
});

import {
  getDb,
  insertNewsBatch,
  insertAnalysis,
  saveEventThreads,
} from '../lib/db';
import { runBacktest } from '../lib/market';
import { startPipelineRun, finishPipelineRun, withPipelineRun, getPipelineHealth } from '../lib/pipeline';

const iso = (offsetH = 0) => new Date(Date.now() - offsetH * 3600 * 1000).toISOString();

beforeAll(async () => {
  await getDb(); // 触发 schema 初始化
});

describe('fetch 幂等（UNIQUE(source, source_id) + INSERT OR IGNORE）', () => {
  it('重复抓取同批数据行数不增长', async () => {
    const db = await getDb();
    const items = [
      { source: 'sina', source_id: 'idem-1', title: 't1', content: 'c1', published_at: iso(), docurl: null },
      { source: 'sina', source_id: 'idem-2', title: 't2', content: 'c2', published_at: iso(), docurl: null },
    ];
    const first = await insertNewsBatch(items);
    const second = await insertNewsBatch(items);
    expect(first).toBe(2);
    expect(second).toBe(0);
    const count = await db.execute({ sql: 'SELECT COUNT(*) as n FROM news_archive WHERE source = ? AND source_id LIKE ?', args: ['sina', 'idem-%'] });
    expect(Number(count.rows[0].n)).toBe(2);
  });
});

describe('analyze 幂等（news_id UNIQUE + ON CONFLICT DO UPDATE）', () => {
  it('重复分析同一条新闻不新增行，内容更新', async () => {
    const db = await getDb();
    await insertNewsBatch([{ source: 'sina', source_id: 'idem-a', title: 'ta', content: 'ca', published_at: iso(), docurl: null }]);
    const row = await db.execute({ sql: 'SELECT id FROM news_archive WHERE source_id = ?', args: ['idem-a'] });
    const newsId = Number(row.rows[0].id);

    const base = {
      news_id: newsId,
      signal_score: 3,
      category: 'industry',
      impact_level: 'significant',
      industries: '["半导体"]',
      companies: null,
      sentiment: 'positive',
      summary: 'v1',
      deep_analysis: null,
      tags: null,
    };
    await insertAnalysis(base);
    await insertAnalysis({ ...base, summary: 'v2', signal_score: 4 });

    const count = await db.execute({ sql: 'SELECT COUNT(*) as n FROM analysis_result WHERE news_id = ?', args: [newsId] });
    expect(Number(count.rows[0].n)).toBe(1);
    const updated = await db.execute({ sql: 'SELECT summary, signal_score FROM analysis_result WHERE news_id = ?', args: [newsId] });
    expect(updated.rows[0].summary).toBe('v2');
    expect(Number(updated.rows[0].signal_score)).toBe(4);
  });
});

describe('event_threads 幂等（dedup_key UNIQUE + ON CONFLICT DO UPDATE）', () => {
  it('同标题线程重复保存不新增行，stage 演进更新', async () => {
    const db = await getDb();
    const thread = (stage: string, confidence: string) => [{
      title: '存储涨价 传导至模组厂',
      news_ids: [1, 2, 3],
      narrative: `narrative ${stage}`,
      stage,
      confidence,
      related_industries: ['存储'],
      key_watch_points: ['涨价落地'],
    }];
    await saveEventThreads(thread('early', 'high'));
    await saveEventThreads(thread('brewing', 'medium'));

    const rows = await db.execute("SELECT * FROM event_threads WHERE title LIKE '%存储涨价%'");
    expect(rows.rows.length).toBe(1);
    expect(rows.rows[0].stage).toBe('brewing');
    expect(rows.rows[0].confidence).toBe('medium');
  });

  it('规范化标题不同（空白差异）视为同一线程', async () => {
    const db = await getDb();
    await saveEventThreads([{ title: '半导体  设备  国产化', news_ids: [9], narrative: 'n', stage: 'early', confidence: 'high', related_industries: [], key_watch_points: [] }]);
    await saveEventThreads([{ title: ' 半导体 设备 国产化 ', news_ids: [9], narrative: 'n2', stage: 'spreading', confidence: 'high', related_industries: [], key_watch_points: [] }]);
    const rows = await db.execute("SELECT * FROM event_threads WHERE dedup_key = '半导体 设备 国产化'");
    expect(rows.rows.length).toBe(1);
    expect(rows.rows[0].stage).toBe('spreading');
  });
});

describe('backtest 幂等（UNIQUE(signal_date, industry) + INSERT OR REPLACE）', () => {
  it('重复运行行数不变，行业别名兜底生效', async () => {
    const db = await getDb();
    const newsId = 9001;
    const today = new Date().toISOString().slice(0, 10);
    await db.execute({
      sql: 'INSERT OR IGNORE INTO news_archive (id, source, source_id, title, content, published_at) VALUES (?, ?, ?, ?, ?, ?)',
      args: [newsId, 'test', 'idem-bt', 'bt news', 'c', new Date().toISOString()],
    });
    await db.execute({
      sql: `INSERT OR IGNORE INTO analysis_result (news_id, signal_score, category, impact_level, industries, companies, sentiment, summary)
            VALUES (?, 4, 'industry', 'significant', ?, NULL, 'positive', 'bt')`,
      args: [newsId, JSON.stringify(['半导体'])],
    });
    // 后续 7 个交易日的板块行情（signal_date 之后）
    const values = Array.from({ length: 7 }, (_, i) => `(?, ?, ?, ?, ?)`).join(', ');
    const args = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.now() + (i + 1) * 86400000).toISOString().slice(0, 10);
      return ['BK1325', '半导体材料', 'index', d, 1.0 + i * 0.1];
    }).flat();
    await db.execute({
      sql: `INSERT OR REPLACE INTO market_data (code, name, type, trade_date, change_pct)
            VALUES ${values}`,
      args,
    });
    void today;

    await runBacktest(90);
    const first = await db.execute('SELECT COUNT(*) as n FROM backtest_result');
    const before = Number(first.rows[0].n);
    await runBacktest(90);
    const second = await db.execute('SELECT COUNT(*) as n FROM backtest_result');
    expect(Number(second.rows[0].n)).toBe(before);

    // 别名映射生效：'半导体' → '半导体材料'，day_1_return 非空
    const row = await db.execute("SELECT industry, day_1_return FROM backtest_result WHERE industry = '半导体'");
    expect(row.rows.length).toBe(1);
    expect(row.rows[0].day_1_return).not.toBeNull();
  });
});

describe('pipeline_run 状态机', () => {
  it('同批次重复启动 retry_count 递增', async () => {
    const db = await getDb();
    const r1 = await startPipelineRun('fetch', 'batch-retry');
    const r2 = await startPipelineRun('fetch', 'batch-retry');
    expect(r2).toBeGreaterThan(r1);
    const rows = await db.execute({ sql: 'SELECT retry_count FROM pipeline_run WHERE id = ?', args: [r2] });
    expect(Number(rows.rows[0].retry_count)).toBe(1);
  });

  it('withPipelineRun 成功记录 status/items，失败记录 error', async () => {
    const ok = await withPipelineRun('analyze', 'batch-ok', async () => ({ analyzed: 3 }), (r) => r.analyzed);
    expect(ok).toEqual({ analyzed: 3 });
    await expect(
      withPipelineRun('fetch-market', 'batch-fail', async () => { throw new Error('boom'); })
    ).rejects.toThrow('boom');

    const db = await getDb();
    const okRow = await db.execute("SELECT status, items_processed FROM pipeline_run WHERE batch_id = 'batch-ok'");
    expect(okRow.rows[0].status).toBe('success');
    expect(Number(okRow.rows[0].items_processed)).toBe(3);
    const failRow = await db.execute("SELECT status, error FROM pipeline_run WHERE batch_id = 'batch-fail'");
    expect(failRow.rows[0].status).toBe('failed');
    expect(failRow.rows[0].error).toContain('boom');
  });

  it('getPipelineHealth 聚合成功率/耗时/错误', async () => {
    // 构造可控三态：1 success + 1 failed + 1 running（用独立 job 名隔离其他测试的记录）
    const r1 = await startPipelineRun('event-threads', 'health-a');
    await finishPipelineRun(r1, { ok: true, items: 5 });
    const r2 = await startPipelineRun('event-threads', 'health-b');
    await finishPipelineRun(r2, { ok: false, error: 'market timeout' });
    await startPipelineRun('event-threads', 'health-c'); // 故意不 finish → running

    const health = await getPipelineHealth(24);
    const fm = health.jobs.find((j) => j.job_name === 'event-threads');
    expect(fm.runs).toBe(3);
    expect(fm.successes).toBe(1);
    expect(fm.failures).toBe(1);
    expect(fm.success_rate).toBe(33.3);
    expect(fm.last_error).toContain('market timeout');
    expect(fm.avg_duration_s).toBeTypeOf('number');
    expect(health.total.runs).toBeGreaterThanOrEqual(3);
  });
});
