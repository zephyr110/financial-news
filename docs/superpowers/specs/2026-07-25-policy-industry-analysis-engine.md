# 政策-行业影响分析引擎 设计文档

> 日期: 2026-07-25  
> 状态: 设计完成，待审阅  
> 父项目: financial-news (Next.js + 新浪财经新闻聚合器)

---

## 1. 项目定位

**不是 AI 投资顾问，是政策-行业影响分析引擎。**

在当前 financial-news 项目基础上，新增智能分析层：从每日几百条财经快讯中自动筛选高价值信号，映射到 A 股行业和公司，串联跨时间的事件线索，为个人投资者提供高效的"信息准备层"。

### 核心用户价值

- **降噪**: 每日几百条快讯 → 真正值得关注的 10-30 条信号
- **结构化**: 原始文本 → 行业标签 + 公司映射 + 情感判断
- **趋势感知**: 孤立新闻 → 事件发展脉络 + 信号强度变化

### 明确不做

- 不做股价预测或买卖建议
- 不做实时盘中交易分析（Phase 1）
- 不做盈利预测或估值分析
- 不输出"买入/卖出/持有"结论

---

## 2. 技术栈与约束

| 项 | 选择 | 原因 |
|----|------|------|
| 运行时 | Node.js (Next.js) | 复用现有项目，不引入第二运行时 |
| 数据库 | SQLite (better-sqlite3) | 零配置、单文件、足够支撑百万级条目 |
| LLM | DeepSeek V4 API | 成本低（<¥1/天），中文金融理解力足够 |
| 数据源 | 新浪 7×24(已有) + 东方财富快讯(新增) | 免费公开 API，JS 生态可用 |
| 新闻数据获取 | emst npm 包 + 直连东财 API | 封装完善，TS 原生 |
| 调度 | node-cron / Next.js API route | 轻量，省运维 |

---

## 3. 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                      数据采集层                           │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ 新浪7×24 │  │ 东财快讯  │  │ 财联社   │  ← Phase 1   │
│  │ (已有)   │  │ (新接入) │  │ (Phase 3)│               │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘              │
│       │             │             │                     │
│       └──────┬──────┴─────────────┘                     │
│              ▼                                          │
│  ┌─────────────────────┐                               │
│  │   新闻归档服务        │  ← 定时任务（每60s拉取）       │
│  │   SQLite            │     去重: (source, source_id)              │
│  └─────────┬───────────┘                               │
└────────────┼────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│                     LLM 分析管道                          │
│                                                         │
│  新新闻入库 → 触发分析 → DeepSeek V4 API                 │
│                                                         │
│  Step 1: 信号筛选  ──→ Step 2: 实体映射 ──→ Step 3: 事件串联   │
│  每条必过            仅 signal≥3            每6h触发         │
│                                                         │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│                    前端展示层                             │
│                                                         │
│  /               → 现有新闻流（不变）                     │
│  /analysis       → 新增分析面板                          │
│  /api/analysis   → 分析结果 JSON API                     │
│  /api/cron/fetch → 新闻归档触发端点                      │
└─────────────────────────────────────────────────────────┘
```

### 关键设计决策

- **SQLite 而非 Postgres**: 个人项目无需额外数据库进程，单文件存储，`better-sqlite3` 同步 API 足够快
- **定时拉取**: 利用 Next.js API route 做 cron 端点，通过外部 cron 服务触发，减少常驻进程。当前实现：**QStash V2 schedules 主触发**（30 分钟一轮，`7,37 * * * *`，fetch-market 错后 15 分钟保序，认证经 `Upstash-Forward-Authorization` 转发 CRON_SECRET）+ **GitHub Actions 每日 21:17 UTC 兜底**（Actions schedule 不保证准点，仅防 QStash 故障漏跑）
- **LLM 异步执行**: 新闻归档和分析解耦，分析结果稍后出不影响新闻流实时性
- **两套 API 共存**: `/api/news`（实时快讯）和 `/api/analysis`（加工后分析）互不干扰

---

## 4. 数据模型

### news_archive

```sql
CREATE TABLE news_archive (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  source        TEXT    NOT NULL,              -- 'sina' | 'eastmoney' | 'cls'
  source_id     TEXT    NOT NULL,              -- 源平台的消息唯一ID
  title         TEXT,                          -- 标题（可能为空）
  content       TEXT    NOT NULL,              -- 正文/快讯内容
  published_at  TEXT    NOT NULL,              -- 原始发布时间 ISO8601
  fetched_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(source, source_id)
);

CREATE INDEX idx_news_published ON news_archive(published_at);
CREATE INDEX idx_news_source    ON news_archive(source);
```

### analysis_result

```sql
CREATE TABLE analysis_result (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  news_id       INTEGER NOT NULL UNIQUE REFERENCES news_archive(id),
  signal_score  INTEGER NOT NULL CHECK(signal_score BETWEEN 1 AND 5),
  category      TEXT    NOT NULL,              -- policy|geopolitics|industry|company|macro|market_rumor
  impact_level  TEXT    NOT NULL,              -- critical|significant|moderate|minor|noise
  industries    TEXT,                          -- JSON: ["半导体","存储芯片"]
  companies     TEXT,                          -- JSON: ["长江存储","兆易创新"]
  sentiment     TEXT    NOT NULL,              -- positive|negative|neutral|mixed
  summary       TEXT    NOT NULL,              -- 一句话摘要（≤50字，LLM生成）
  deep_analysis TEXT,                          -- 深度解读（signal≥3时生成，≤200字）
  tags          TEXT,                          -- JSON: ["涨价","AI","供应链"]
  related_ids   TEXT,                          -- JSON: [12, 45] 关联新闻ID（Step 3 填充）
  event_thread_id TEXT,                        -- 所属事件线索ID
  analyzed_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_analysis_score    ON analysis_result(signal_score);
CREATE INDEX idx_analysis_category ON analysis_result(category);
```

### 设计理由

| 决策 | 原因 |
|------|------|
| 新闻和分析一对一 | 每条新闻只需分析一次，无需多版本 |
| 行业/公司用 JSON 数组 | 每条新闻涉及 ≤5 个实体，JSON 查询够用，省去多表 JOIN |
| `deep_analysis` 仅 signal ≥ 3 | 节省 90% 的 token 消耗 |
| `source + source_id` 联合唯一 | 不同源的同事件报道不判重，在分析层做交叉验证 |
| 不建 event_thread 独立表 | Phase 1 事件线索频率低，JSON 嵌在分析结果中即可 |

---

## 5. LLM 分析管道

### 成本估算

| 步骤 | 触发条件 | 日均次数 | token/次 | 日耗 token |
|------|---------|---------|----------|-----------|
| Step 1: 信号筛选 | 每条新新闻 | ~500 | ~300 | ~150,000 |
| Step 2: 实体映射 | signal ≥ 3 | ~50 | ~400 | ~20,000 |
| Step 3: 事件串联 | 每 6h | 4 | ~2,500 | ~10,000 |
| **合计** | | | | **~180,000** |

DeepSeek V4 定价约 ¥1/百万 input + ¥2/百万 output → **日均 < ¥1**。

### Step 1: 信号筛选（每条新闻必过）

**Prompt 设计:**

```
SYSTEM: 你是一个A股政策-行业信号识别器。

对输入的财经快讯，输出严格JSON：

{
  "signal_score": <1-5>,        // 1=纯噪声 2=一般资讯 3=值得关注 4=重要信号 5=重大事件
  "category": "<string>",       // policy|geopolitics|industry|company|macro|market_rumor
  "sentiment": "<string>",      // positive|negative|neutral|mixed
  "summary": "<string>",        // 一句话概括，不超过50字
  "reason": "<string>"          // 为什么打这个分，不超过30字
}

评分标准：
- 5分: 国务院/中央级别政策、重大地缘事件、行业颠覆性变化
- 4分: 部委级政策、重要产业规划、龙头公司重大公告、国际关系变化
- 3分: 行业数据发布、公司业绩预告、券商集中调研、产品价格变动
- 2分: 一般公司新闻、市场评论、常规数据更新
- 1分: 纯行情播报、重复资讯、广告推广、无实质内容
```

**impcat_level 映射:**

| signal_score | impact_level |
|-------------|-------------|
| 5 | critical |
| 4 | significant |
| 3 | moderate |
| 2 | minor |
| 1 | noise |

### Step 2: 实体映射（仅 signal ≥ 3）

**Prompt 设计:**

```
SYSTEM: 你是一个A股行业分析师。对输入的重要财经新闻做行业和公司映射。

{
  "industries": ["<申万二级行业名>", ...],    // 最多5个
  "companies": ["<A股上市公司简称>", ...],     // 实际受益或受损的公司，最多5个
  "tags": ["<关键词>", ...],                   // 事件特征标签
  "deep_analysis": "<string>"                  // 200字以内，分析对相关行业的具体影响路径
}

分析要求：
- industries: 必须用申万二级行业名（如"半导体"、"光伏设备"、"白酒"），不要用一级分类
- companies: 只列A股实际受益/受损的上市公司，不要泛泛写"相关概念股"
- deep_analysis: 聚焦"影响路径"，而非重复新闻内容
```

### Step 3: 事件串联（每 6h 定时）

**输入:** 过去 24h 所有 signal ≥ 3 的新闻（含 Step 2 的实体标签）

**Prompt 设计:**

```
SYSTEM: 给定过去24小时内所有重要财经新闻（已标注行业和标签），
识别出"事件线索"——多条新闻指向的同一个趋势。

{
  "event_threads": [
    {
      "title": "<事件名称>",
      "news_ids": [<关联新闻ID列表>],
      "narrative": "<一句话描述事件发展过程>",
      "stage": "早期|发酵中|全面扩散|成熟定价",
      "confidence": "high|medium",
      "related_industries": ["<行业>", ...],
      "key_watch_points": ["<后续关注点>", ...]
    }
  ]
}
```

### 调度策略

- Step 1: 每条新闻入库后异步触发，批量处理（攒够 10 条或等待 60s 触发一次 LLM 调用）
- Step 2: 紧随 Step 1，对 signal ≥ 3 的新闻立即处理
- Step 3: 通过 cron 触发（当前 QStash 每 30 分钟一轮，仅处理新增新闻，token 成本与频率无关）
- 失败重试: API 调用失败后最多重试 3 次，指数退避

---

## 6. 前端分析面板

### 路由

- `/` — 现有实时新闻流（不变）
- `/analysis` — 新增分析面板

Header 新增 Tab 切换: `[📰 实时快讯] [📊 分析面板]`

### 页面布局

```
┌──────────────────────────────────────────────────────┐
│  📊 过去24h  信号新闻 47条  事件线索 3条  ⚠️ 最高4分  │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌─ 事件线索 ────────────────────────────────────┐  │
│  │  ▸ 存储芯片涨价周期启动  [发酵中] [高]          │  │
│  │  ▸ 新能源汽车补贴调整  [早期]   [中]            │  │
│  └───────────────────────────────────────────────┘  │
│                                                      │
│  ┌─ 行业影响热力图 ──────────────────────────────┐  │
│  │  半导体    ████████████ +3.2  (12条)            │  │
│  │  光伏      ██████       +1.1  (5条)             │  │
│  │  消费电子  ████████     -1.8  (8条)             │  │
│  └───────────────────────────────────────────────┘  │
│                                                      │
│  ┌─ 信号时间线 ──────────────────────────────────┐  │
│  │  07/24 14:30  ⚠️ 国务院发布...  [政策] [5分]  │  │
│  │  07/24 11:20  📢 存储厂商...   [行业] [4分]   │  │
│  │  ...                [加载更多]                  │  │
│  └───────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

### 组件树

```
pages/analysis.js              ← ISR, revalidate: 600
├── AnalysisOverview           ← 概览数字
├── EventThreadList            ← 事件线索列表
│   └── EventThreadCard        ← 可展开看详情
├── IndustryHeatmap            ← 行业热力图
│   └── IndustryBar            ← 单行业条形
└── SignalTimeline             ← 信号时间线
    └── AnalysisNewsCard       ← 扩展 NewsCard，加分析标签
```

### 数据流

- `getStaticProps`: 调用 `/api/analysis?range=24h`，revalidate 600s
- 客户端: 手动刷新 + pull-to-refresh（复用现有模式）
- 概览数字、热力图、时间线来自同一 API 响应，一次请求

### 交叉信源标记（Phase 2+）

当同一底层事件被多个信源报道时（分析层判断），`AnalysisNewsCard` 显示:
- `[3信源]` — 多信源确认，置信度高
- `[1信源]` — 单一来源，需关注后续确认

---

## 7. 实施路线图

### Phase 1 — MVP（核心管道跑通）

| # | 任务 | 产出 |
|---|------|------|
| 1 | SQLite 初始化脚本 + `db.js` 封装 | `lib/db.js` |
| 2 | 新闻归档服务: 东财 API 接入 + 定时拉取 | `lib/archive.js`, `/api/cron/fetch` |
| 3 | LLM 管道 Step 1: 信号筛选 | `lib/analyze.js`, `/api/analysis` |
| 4 | `/analysis` 页面: 信号时间线 + 概览 | `pages/analysis.js` |
| 5 | LLM 成本日志 + 用量监控 | 日志输出到控制台/文件 |

### Phase 2 — 深度分析

| # | 任务 | 产出 |
|---|------|------|
| 6 | LLM 管道 Step 2: 实体映射 | 扩展 `lib/analyze.js` |
| 7 | LLM 管道 Step 3: 事件串联 | 新增 cron 端点 |
| 8 | 事件线索展示 | `EventThreadList`, `EventThreadCard` |
| 9 | 行业热力图 | `IndustryHeatmap`, `IndustryBar` |
| 10 | 交叉信源标记 | 分析层逻辑 + 前端标记 |

### Phase 3 — 历史数据与告警

| # | 任务 | 产出 |
|---|------|------|
| 11 | 历史数据回填（东财历史接口，目标 6-12 月） | `scripts/backfill.js` |
| 12 | 信号趋势图: 周/月维度行业信号强度变化 | 前端图表组件 |
| 13 | 浏览器推送通知（signal ≥ 4） | Service Worker |
| 14 | 财联社快讯接入 | 扩展 `lib/archive.js` |

### Phase 4 — 量化增强（远期，不做细化）

- 行情数据接入（东财行情 API）
- 信号有效性回测（信号出现后 N 日板块涨跌幅）
- 个性化行业关注配置

---

## 8. 风险与注意事项

| 风险 | 缓解措施 |
|------|---------|
| 东方财富 API 改版/限流 | 请求间隔 ≥ 1s，emst 内置节流；新浪作为备份 |
| LLM 幻觉导致错误映射 | signal_score ≥ 4 的新闻标注"AI 分析，请核实"；行业映射用申万标准分类约束 |
| SQLite 并发写入 | better-sqlite3 同步 API 天然串行；单实例部署无并发问题 |
| 成本超预期 | 用量日志 + 可配置每日 token 上限 |
| 历史数据冷启动 | 初期可能只有 1-2 周历史，事件串联效果受限；Phase 3 回填缓解 |
| DeepSeek V4 API 不稳定 | 重试 3 次 + 指数退避 + 降级策略（失败时至少保留原始新闻） |

---

## 9. 成功标准

- [ ] 新闻归档正常运行，2 个信源每日覆盖 ≥ 400 条快讯
- [ ] 信号筛选准确率：人工抽查 50 条，signal ≥ 3 的召回率 ≥ 80%
- [ ] 分析面板首屏加载 ≤ 3s（ISR + CDN）
- [ ] LLM 日 token 消耗 ≤ 25 万
- [ ] 从信号出现到分析结果可用的延迟 ≤ 5 分钟

---

## 10. 未来 Agent 升级路径

> 调研日期: 2026-08-18  
> 参考对象: [Mini-Agent (MiniMax)](https://github.com/MiniMax-AI/Mini-Agent)、[DeepSeek Harness (dsh)](https://github.com/deepseek-ai/deepseek-harness)

### 10.1 参考架构对比

| 维度 | Mini-Agent 式 | dsh 式 |
|------|--------------|--------|
| 定位 | 最小专业 agent 样板（领域应用骨架） | 通用 agent 运行时平台 |
| 实现 | Python 单包（uv），平铺业务代码 | TS monorepo（70+ 包），一切皆插件（Cordis） |
| 核心机制 | 执行循环 + Session Note 持久记忆 + 上下文自动压缩 + MCP/Skills | 能力接缝（Service Definition + Provider + Consumer）、三大事件域、profile/bundle 配置化组合、turn/step 循环 |
| 可读性/审计 | 整个库几小时可读完 | 需先学 Cordis 编程范式 + 分层组合模型 |
| 与本项目契合 | 思想可小时级翻译为 TS/Next.js | 运行时与 Next.js 单体冲突（需 Cordis 树引导） |
| 稳定性 | 样板项目，可自行演进 | developer preview，官方明示 breaking changes |

### 10.2 架构结论

**骨架用 Mini-Agent 式，原则吸收 dsh 式。** 本项目是单人使用的垂直信息处理应用，需要的能力是"一个研究问答循环 + 5-6 个领域工具 + 会话持久化"，规模与 Mini-Agent 匹配；dsh 的 sandbox/subagent 编排/插件生态等平台能力 90% 用不上。

从 dsh 吸收的三条原则（在阶段 A/B 落实）：

1. **能力接缝三角色**：每个可替换能力 = Service Definition + Provider + Consumer。本项目对应：NewsSource（sina/eastmoney/cls）、Analyzer（deepseek-v4/其他模型）、Store（SQLite）。
2. **模型可见即记录**：一切进入模型请求的信息必须可从持久化日志重建。本项目落实为 append-only 事件链（ingested → scored → mapped → threaded），信号评分可完整回溯。
3. **配置化组合**：数据源开关、批大小、调度间隔、模型参数从配置声明，而非硬编码。

从 Mini-Agent 吸收的能力：Session Note 式研究会话持久化、上下文自动压缩（长研究报告会话）、执行循环全程日志。

### 10.3 升级路径（三阶段）

> 实施状态：阶段 A/B 已实施（2026-08-18，PR #5，merge commit `aded876`），阶段 C 未启动

**阶段 A：接缝化重构（低风险，先行）**

- `lib/` 规范为三接缝接口 + 注册表：`NewsSourceProvider` / `AnalyzerProvider` / `StoreProvider`
- 现有实现（sina、eastmoney、deepseek、sqlite）降级为默认 Provider
- 数据源/模型切换变为配置级操作（东财挂了换财联社 = 改配置）
- 代价小（现有代码已相对独立），为阶段 B/C 铺路

**阶段 B：研究 Agent（轻量自研，主目标）**

- 把现有 3-step 批处理管道包装为领域工具集：
  - `search_news(关键词/行业/时间窗)` — 检索归档新闻
  - `get_event_threads()` — 查询事件线索及阶段
  - `get_industry_heatmap(行业/时间窗)` — 行业信号强度
  - `get_backtest(信号/行业)` — 信号后 N 日表现
  - `watch_event(事件ID)` — 订阅后续发展
- 轻量执行循环（Mini-Agent 式 ReactLoop 翻译为 TS），turn/step 模型
- 研究会话持久化（Session Note 式）+ 上下文自动压缩
- 模型角色从"批量评分器"升级为"交互式研究员"：用户提问"存储涨价链条现在到哪个阶段？"→ agent 调工具 → 结构化回答

**阶段 C：多 Agent 编排（远期，防御性门槛）**

- 宏观 agent + 行业 agent + 交叉验证 agent 协作时再评估引入 dsh 运行时
- 业务逻辑以插件形式移植到 dsh

### 10.4 阶段 C 触发条件（不满足不启动）

- [ ] 需要多 agent 并行协作且收益明确（对比单一研究 agent 的实验证据）
- [ ] dsh 发布正式版（非 rc/preview）
- [ ] 本项目的 agent 形态扩展为独立 CLI/桌面客户端
- [ ] 评估：dsh 引入的维护成本 < 自研实现成本的 50%

### 10.5 约束

- LLM 一律通过 API key 调用（DeepSeek V4 为默认 provider，Agent 层延续）
- 前端交互沿用 lucide icon 约束，禁止 emoji 作 icon
- Agent 输出仅做信息准备，不做买卖建议（沿用第 1 节定位）