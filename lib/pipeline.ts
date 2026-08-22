/**
 * 数据管线任务状态机（P1.1）。
 *
 * 每次 cron 调用记录一条 pipeline_run：start → running → success|failed。
 * batch_id 相同视为同一批次的失败重试（retry_count 递增），供调度层判断
 * 是否跳过空转、以及 /api/health 聚合展示 24h 各段成功率/耗时。
 */
import { getDb } from './db';

export const PIPELINE_JOBS = [
  'fetch',
  'analyze',
  'deep-analyze',
  'event-threads',
  'fetch-market',
] as const;
export type PipelineJob = (typeof PIPELINE_JOBS)[number];

function rowId(value: unknown): number {
  if (value == null) return 0;
  return typeof value === 'bigint' ? Number(value) : Number(value);
}

/**
 * 缺省批次标识：小时时间窗（QStash 每 30 分钟触发 → 每小时至多 2 个批次）。
 * 调用方可通过 ?batch= 覆盖（QStash 消息 ID）。
 */
export function defaultBatchId(now = new Date()): string {
  return now.toISOString().slice(0, 13);
}

export async function startPipelineRun(jobName: PipelineJob, batchId: string): Promise<number> {
  const db = await getDb();
  const prior = await db.execute({
    sql: 'SELECT COUNT(*) as n FROM pipeline_run WHERE job_name = ? AND batch_id = ?',
    args: [jobName, batchId],
  });
  const retryCount = Number(prior.rows[0]?.n || 0);
  const result = await db.execute({
    sql: `INSERT INTO pipeline_run (job_name, batch_id, retry_count, status, started_at)
          VALUES (?, ?, ?, 'running', ?)`,
    args: [jobName, batchId, retryCount, new Date().toISOString()],
  });
  return rowId(result.lastInsertRowid);
}

export async function finishPipelineRun(
  runId: number,
  { ok, items = null, error = null }: { ok: boolean; items?: number | null; error?: string | null }
): Promise<void> {
  if (!runId) return;
  const db = await getDb();
  await db.execute({
    sql: 'UPDATE pipeline_run SET status = ?, finished_at = ?, items_processed = ?, error = ? WHERE id = ?',
    args: [ok ? 'success' : 'failed', new Date().toISOString(), items, error, runId],
  });
}

/**
 * 距该 job 最近一次成功运行的时间间隔是否 < minIntervalMs。
 * 用于重型端点节流（回测全量重建、事件线索 LLM 检测）：
 * 调度频率（如 QStash 每 30 分钟）远高于任务需要的频率时，
 * 跳过未到间隔的调用，避免行读取/LLM 用量被高频调度推爆。
 */
export async function isJobFresh(jobName: PipelineJob, minIntervalMs: number): Promise<boolean> {
  const db = await getDb();
  const result = await db.execute({
    sql: `SELECT finished_at FROM pipeline_run
          WHERE job_name = ? AND status = 'success'
          ORDER BY finished_at DESC LIMIT 1`,
    args: [jobName],
  });
  const finishedAt = result.rows[0]?.finished_at;
  if (!finishedAt) return false;
  const t = new Date(String(finishedAt).includes('T') ? String(finishedAt) : String(finishedAt).replace(' ', 'T') + 'Z').getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < minIntervalMs;
}

/**
 * 包裹一次管线任务：开始写状态 → 执行 → 成功/失败写终态。
 * getItems 从任务返回值提取处理条数（无则记 null）。
 */
export async function withPipelineRun<T>(
  jobName: PipelineJob,
  batchId: string,
  fn: () => Promise<T>,
  getItems?: (result: T) => number | null
): Promise<T> {
  const runId = await startPipelineRun(jobName, batchId);
  try {
    const result = await fn();
    await finishPipelineRun(runId, { ok: true, items: getItems ? getItems(result) : null });
    return result;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    await finishPipelineRun(runId, { ok: false, error: msg.slice(0, 500) });
    throw error;
  }
}

interface PipelineJobHealth {
  job_name: string;
  runs: number;
  successes: number;
  failures: number;
  success_rate: number | null;
  avg_duration_s: number | null;
  last_error: string | null;
}

/**
 * 最近 N 小时各段聚合（/api/health 数据源）。
 */
export async function getPipelineHealth(hours = 24): Promise<{
  hours: number;
  jobs: PipelineJobHealth[];
  total: { runs: number; successes: number; failures: number; success_rate: number | null };
}> {
  const db = await getDb();
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
  const result = await db.execute({
    sql: `SELECT job_name,
                 COUNT(*) as runs,
                 SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successes,
                 SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failures,
                 ROUND(AVG(CASE WHEN finished_at IS NOT NULL
                          THEN (julianday(finished_at) - julianday(started_at)) * 86400 END), 1) as avg_duration_s,
                 MAX(CASE WHEN status = 'failed' THEN error END) as last_error
          FROM pipeline_run
          WHERE started_at >= ?
          GROUP BY job_name
          ORDER BY job_name`,
    args: [since],
  });
  const jobs = result.rows.map((r) => {
    const runs = Number(r.runs || 0);
    const successes = Number(r.successes || 0);
    return {
      job_name: r.job_name,
      runs,
      successes,
      failures: Number(r.failures || 0),
      success_rate: runs > 0 ? Math.round((successes / runs) * 1000) / 10 : null,
      avg_duration_s: r.avg_duration_s != null ? Number(r.avg_duration_s) : null,
      last_error: r.last_error,
    };
  });
  const runs = jobs.reduce((s, j) => s + j.runs, 0);
  const successes = jobs.reduce((s, j) => s + j.successes, 0);
  return {
    hours,
    jobs,
    total: {
      runs,
      successes,
      failures: runs - successes,
      success_rate: runs > 0 ? Math.round((successes / runs) * 1000) / 10 : null,
    },
  };
}
