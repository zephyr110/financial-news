import { describe, it, expect } from 'vitest';
import { evaluateValue, VERDICT_LABELS, type ValueMetrics } from '../lib/value';

function makeMetrics(overrides: Partial<ValueMetrics> = {}): ValueMetrics {
  return {
    uniqueSessions: 0,
    events: [],
    weeklyReturn: { recentSessions: 0, returning: 0 },
    ...overrides,
  };
}

describe('P2.5 价值验证判定', () => {
  it('样本不足（<100 独立访问）→ insufficient-data，不硬下结论（R5）', () => {
    const report = evaluateValue(
      makeMetrics({
        uniqueSessions: 99,
        events: [{ event_type: 'watchlist_add', count: 10, sessions: 10 }],
        weeklyReturn: { recentSessions: 50, returning: 10 },
      })
    );
    expect(report.verdict).toBe('insufficient-data');
    expect(report.checks.every((c) => c.pass === null || c.pass === true)).toBe(true);
    expect(report.checks[0].note).toContain('样本不足');
  });

  it('恰好 100 独立访问即可判定（下边界含 100）', () => {
    const report = evaluateValue(
      makeMetrics({
        uniqueSessions: 100,
        events: [
          { event_type: 'watchlist_add', count: 20, sessions: 20 },
          { event_type: 'thread_expand', count: 30, sessions: 30 },
        ],
        weeklyReturn: { recentSessions: 60, returning: 20 },
      })
    );
    expect(report.verdict).not.toBe('insufficient-data');
  });

  it('全部达标 → go', () => {
    const report = evaluateValue(
      makeMetrics({
        uniqueSessions: 200,
        events: [
          // 10/200 = 5% 恰好达标
          { event_type: 'watchlist_add', count: 10, sessions: 10 },
          // 40/200 = 20% 恰好达标
          { event_type: 'thread_expand', count: 40, sessions: 40 },
        ],
        weeklyReturn: { recentSessions: 100, returning: 15 },
      })
    );
    expect(report.verdict).toBe('go');
    expect(report.checks[0].pass).toBe(true);
    expect(report.checks[1].pass).toBe(true);
    expect(report.checks[2].pass).toBe(true);
    expect(report.checks[3].pass).toBe(true); // 回测无负反馈：恒通过
  });

  it('任一指标未达 → no-go', () => {
    const report = evaluateValue(
      makeMetrics({
        uniqueSessions: 200,
        events: [
          // 8/200 = 4% < 5%：watchlist 添加率不达标
          { event_type: 'watchlist_add', count: 8, sessions: 8 },
          { event_type: 'thread_expand', count: 40, sessions: 40 },
        ],
        weeklyReturn: { recentSessions: 100, returning: 15 },
      })
    );
    expect(report.verdict).toBe('no-go');
    expect(report.checks[0].pass).toBe(false);
    expect(report.checks[2].pass).toBe(true);
  });

  it('周回访率边界：15/100 = 15% 恰好达标，14/100 未达', () => {
    const at = evaluateValue(
      makeMetrics({
        uniqueSessions: 200,
        events: [
          { event_type: 'watchlist_add', count: 10, sessions: 10 },
          { event_type: 'thread_expand', count: 40, sessions: 40 },
        ],
        weeklyReturn: { recentSessions: 100, returning: 15 },
      })
    );
    expect(at.checks[1].pass).toBe(true);

    const under = evaluateValue(
      makeMetrics({
        uniqueSessions: 200,
        events: [
          { event_type: 'watchlist_add', count: 10, sessions: 10 },
          { event_type: 'thread_expand', count: 40, sessions: 40 },
        ],
        weeklyReturn: { recentSessions: 100, returning: 14 },
      })
    );
    expect(under.checks[1].pass).toBe(false);
    expect(under.verdict).toBe('no-go');
  });

  it('周回访率分母为 0（本周无访问）→ 判定未达而非崩溃', () => {
    const report = evaluateValue(
      makeMetrics({
        uniqueSessions: 200,
        events: [],
        weeklyReturn: { recentSessions: 0, returning: 0 },
      })
    );
    expect(report.weeklyReturnRate).toBeNull();
    expect(report.checks[1].pass).toBe(false);
  });

  it('5 项参考指标率全部计算，缺失事件类型按 0', () => {
    const report = evaluateValue(
      makeMetrics({
        uniqueSessions: 100,
        events: [{ event_type: 'signal_click', count: 30, sessions: 30 }],
        weeklyReturn: { recentSessions: 50, returning: 10 },
      })
    );
    expect(report.rates.signal_click).toBeCloseTo(0.3);
    expect(report.rates.watchlist_add).toBe(0);
    expect(report.rates.search_query).toBe(0);
    expect(report.rates.thread_expand).toBe(0);
    expect(report.rates.industry_drill).toBe(0);
  });

  it('判定文案存在且可读', () => {
    expect(VERDICT_LABELS.go).toContain('Go');
    expect(VERDICT_LABELS['no-go']).toContain('No-Go');
    expect(VERDICT_LABELS['insufficient-data']).toContain('延长观察期');
  });
});
