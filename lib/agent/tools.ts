/**
 * 研究 Agent — 领域工具集（spec §10.3 阶段 B）
 *
 * 把现有 3-step 管道（信号筛选/实体映射/事件串联）与 v2 数据层
 * 包装为模型可调用的工具。新增工具 = 在 TOOLS 数组追加一项。
 */
import type { ToolDefinition } from './types';
import { searchSignals, getEventThreads, getEventThreadById, getIndustryHeatmap, getIndustryTrend, getBacktestByIndustry } from '../db';

/** 简洁化工具输出：限制文本长度，避免撑爆上下文 */
function summarizeList(rows, fields, limit = 10) {
  return rows.slice(0, limit).map((r) => fields.map((f) => r[f]).join(' | ')).join('\n');
}

export const RESEARCH_TOOLS: ToolDefinition[] = [
  {
    name: 'search_news',
    description:
      '按关键词检索已分析的信号（新闻），支持按时间范围与最低信号分过滤。' +
      '用于查找某行业/公司/主题的近期财经信号。',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词，如"存储""稀土""半导体"（至少2字）' },
        hoursBack: { type: 'number', description: '回溯小时数，默认720（30天），最大2160' },
        minScore: { type: 'number', description: '最低信号分1-5，默认1' },
        limit: { type: 'number', description: '返回条数，默认10，最大50' },
      },
      required: ['query'],
    },
    async execute(args) {
      const result = await searchSignals({
        query: String(args.query || ''),
        hoursBack: Number(args.hoursBack) || 720,
        minScore: Number(args.minScore) || 1,
        limit: Number(args.limit) || 10,
      });
      if (result.items.length === 0) return '未找到匹配信号。';
      return [
        `共 ${result.total} 条匹配，显示前 ${result.items.length} 条：`,
        summarizeList(
          result.items,
          ['id', 'signal_score', 'category', 'industries', 'summary', 'published_at'],
          10
        ),
        '（引用时请标注 signal id）',
      ].join('\n');
    },
  },
  {
    name: 'get_event_threads',
    description:
      '查询当前事件线索列表（多条新闻指向的同一趋势），含发展阶段与置信度。' +
      '用于回答"现在市场在关注什么主线"类问题。',
    parameters: {
      type: 'object',
      properties: {
        hoursBack: { type: 'number', description: '回溯小时数，默认24' },
      },
    },
    async execute(args) {
      const threads = await getEventThreads(Number(args.hoursBack) || 24);
      if (threads.length === 0) return '当前时间窗内没有事件线索。';
      return threads.map((t) =>
        `[${t.stage}] ${t.title}（置信度:${t.confidence}，涉及行业:${(t.industries || []).join('/')}，` +
        `关联信号:${(t.news_ids || []).length}条）\n${t.narrative}` +
        (t.watch_points?.length ? `\n关注点: ${t.watch_points.join('；')}` : '')
      ).join('\n\n');
    },
  },
  {
    name: 'get_industry_heatmap',
    description:
      '查询行业信号热力图（各行业近期信号数量与平均分、情绪）及时间趋势。' +
      '用于回答"哪个行业近期信号最强"类问题。',
    parameters: {
      type: 'object',
      properties: {
        hoursBack: { type: 'number', description: '回溯小时数，默认24' },
      },
    },
    async execute(args) {
      const hoursBack = Number(args.hoursBack) || 24;
      const heatmap = await getIndustryHeatmap(hoursBack);
      if (heatmap.length === 0) return '该时间窗内没有行业信号数据。';
      const top = heatmap.slice(0, 12);
      const lines = top.map((h) =>
        `${h.industry}: ${h.signalCount}条信号 平均分${h.avgScore} 情绪${h.sentiment}`
      );
      return `行业信号热力图（近${hoursBack}h，前${top.length}名）：\n${lines.join('\n')}`;
    },
  },
  {
    name: 'get_backtest',
    description:
      '查询行业信号回测统计（信号出现后1/3/7日平均涨跌与胜率）。' +
      '用于回答"某行业的信号历史上表现如何"类问题。',
    parameters: {
      type: 'object',
      properties: {
        industry: { type: 'string', description: '行业名（可选，如"半导体"），不填则返回全部' },
        daysBack: { type: 'number', description: '回溯天数，默认90' },
      },
    },
    async execute(args) {
      const rows = await getBacktestByIndustry(Number(args.daysBack) || 90);
      if (rows.length === 0) return '暂无回测数据（需要积累足够历史信号）。';
      const filtered = args.industry
        ? rows.filter((r) => (r.industry as string).includes(String(args.industry)))
        : rows;
      if (filtered.length === 0) return `没有找到行业"${args.industry}"的回测数据。`;
      const lines = filtered.slice(0, 10).map((r) =>
        `${r.industry}: ${r.samples}次样本 1日${r.avg_d1}% 3日${r.avg_d3}% 7日${r.avg_d7}% 胜率${r.win_rate}%`
      );
      return `行业信号回测统计（近${Number(args.daysBack) || 90}天）：\n${lines.join('\n')}`;
    },
  },
  {
    name: 'watch_event',
    description:
      '查询单个事件线索的完整详情：事件发展叙事、关联信号列表（含时间线与内容）、后续关注点。' +
      '用于回答"某事件现在到哪个阶段了"类问题。',
    parameters: {
      type: 'object',
      properties: {
        eventId: { type: 'number', description: '事件线索ID（来自 get_event_threads）' },
      },
      required: ['eventId'],
    },
    async execute(args) {
      const id = Number(args.eventId);
      if (!Number.isFinite(id)) return 'eventId 必须是数字。';
      const thread = await getEventThreadById(id);
      if (!thread) return `事件线索 ${id} 不存在（可能已过期，可用 get_event_threads 查看最新线索）。`;
      const signalLines = thread.signals.map((s) =>
        `${s.published_at} [${s.signal_score}分/${s.category}] ${s.summary}`
      ).join('\n');
      return [
        `事件线索 #${thread.id}: ${thread.title}`,
        `阶段: ${thread.stage} | 置信度: ${thread.confidence}`,
        `叙事: ${thread.narrative}`,
        `涉及行业: ${(thread.industries || []).join('/') || '无'}`,
        `关注点: ${(thread.watch_points || []).join('；') || '无'}`,
        `\n关联信号（${thread.signals.length}条）:\n${signalLines || '无'}`,
      ].join('\n');
    },
  },
];

const toolMap = new Map(RESEARCH_TOOLS.map((t) => [t.name, t]));

export function getTool(name: string): ToolDefinition | undefined {
  return toolMap.get(name);
}

/** 生成工具清单文本，注入 system prompt */
export function buildToolPrompt(): string {
  return RESEARCH_TOOLS.map((t) =>
    `- ${t.name}: ${t.description}\n  参数: ${JSON.stringify(t.parameters.properties || {})}`
  ).join('\n');
}
