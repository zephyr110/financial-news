# Financial News UI Redesign

**日期：** 2026-07-23
**状态：** 已确认
**目标：** 将现有 Bulma CSS 新闻展示页升级为 shadcn/ui 风格的响应式页面，支持系统深色/浅色主题自适应。

---

## 技术决策

- **方案：** 完整集成 shadcn/ui（Tailwind CSS + shadcn 组件库）
- **替换：** 移除 Bulma CDN，引入 Tailwind CSS v4 + shadcn/ui
- **保留：** `lib/` 数据层（fetchNews, generateFeed, sina）和 `pages/api/` RSS 端点不变
- **架构：** Next.js Pages Router + React 19

---

## 依赖变更

```bash
# 新增依赖
npm install -D tailwindcss @tailwindcss/postcss postcss
npm install next-themes
npm install lucide-react
npx shadcn@latest init    # 初始化 shadcn/ui
npx shadcn@latest add card button badge alert
```

---

## 字体系统

| 层级 | 字号 | 字重 | 行高 | 用途 |
|------|------|------|------|------|
| H1 | 24px | 600 | 1.3 | 页面大标题 |
| Body | 14px | 400 | 1.65 | 新闻正文 |
| Caption | 12px | 400 | 1.5 | 时间戳 |
| Overline | 10px | 500 | 1.4 | 标签/来源 |

---

## 色彩系统

### Light 模式

| Token | 色值 | 用途 |
|-------|------|------|
| `background` | `#fafafa` | 页面底色 |
| `foreground` | `#1a1a1a` | 主文字 |
| `card` | `#ffffff` | 卡片底色 |
| `card-border` | `#e5e5e5` | 卡片边框 |
| `muted` | `#6b7280` | 次要文字 |
| `accent` | `#2563eb` | 链接/交互色 |
| `destructive` | `#dc2626` | 下跌红 |
| `positive` | `#16a34a` | 上涨绿 |
| `border` | `#e5e5e5` | 分割线 |

### Dark 模式

| Token | 色值 | 用途 |
|-------|------|------|
| `background` | `#0a0a0a` | 页面底色 |
| `foreground` | `#e5e5e5` | 主文字 |
| `card` | `#141414` | 卡片底色 |
| `card-border` | `#1f1f1f` | 卡片边框 |
| `muted` | `#6b7280` | 次要文字 |
| `accent` | `#3b82f6` | 链接色 |
| `destructive` | `#ef4444` | 下跌红 |
| `positive` | `#22c55e` | 上涨绿 |
| `border` | `#262626` | 分割线 |

---

## 间距体系（8px 基准）

| 尺度 | Tailwind | 值 | 用途 |
|------|----------|-----|------|
| xs | `gap-0.5` | 4px | 标签间 |
| sm | `gap-1` | 8px | 时间戳内部 |
| md | `gap-1.5` | 12px | 卡片内上下间距 |
| lg | `p-4` | 16px | 卡片内边距 |
| xl | `gap-3` | 12px | 卡片间间距 |
| 2xl | `px-4` | 16px | 移动端页边距 |
| 3xl | `gap-6` | 24px | 头部与内容 |

---

## 响应式断点

| 断点 | 宽度 | 行为 |
|------|------|------|
| 默认 | < 640px | 单列，页边距 16px，卡片撑满 |
| `sm` | ≥ 640px | 单列，最大宽度 640px 居中 |
| `md` | ≥ 768px | 最大宽度 720px 居中 |
| `lg` | ≥ 1024px | 预留双列扩展空间 |

---

## 组件树

```
pages/index.js
├── Head (meta + viewport)
├── ThemeProvider (next-themes)
├── PageHeader
│   ├── 标题 "全球实时财经新闻"
│   └── ThemeToggle (Lucide Sun/Moon icon, ghost button)
├── ErrorBanner (Alert, 仅 error 时显示)
├── NewsList
│   └── NewsCard[] (Card 组件)
│       ├── 正文 rich_text
│       ├── 时间戳 (tabular-nums, muted)
│       └── 来源链接 (accent)
└── EmptyState (无数据时)
```

---

## 主题切换

- **默认：** 跟随系统 `prefers-color-scheme`
- **手动切换：** 右上角 Lucide 纯图标按钮（Sun/Moon），ghost variant
- **持久化：** 手动选择存入 localStorage
- **防闪烁：** next-themes 在 `<html>` 注入 script，渲染前读取偏好
- **过渡动画：** 图标旋转 `transition-transform duration-300`

---

## 动画

- 首屏前 10 条卡片 staggered fade-in（opacity + translateY 8px → 0）
- 后续卡片直接显示，避免长列表延迟感
- 单条动画时长 0.3s，延迟间隔 50ms

---

## 不变更范围

- `lib/sina.js` — 新浪 API 配置
- `lib/fetchNews.js` — 数据抓取与过滤
- `lib/generateFeed.js` — RSS Feed 生成
- `pages/api/rss.xml.js` — RSS 2.0 端点
- `pages/api/rss.json.js` — JSON Feed 端点
- `next.config.js` — 保持 ISR 配置

---

## 文件变更清单

| 操作 | 文件 |
|------|------|
| 重写 | `pages/index.js` |
| 新增 | `components/NewsCard.js` |
| 新增 | `components/NewsList.js` |
| 新增 | `components/ThemeToggle.js` |
| 新增 | `components/ErrorBanner.js` |
| 新增 | `components/EmptyState.js` |
| 新增 | `styles/globals.css` (Tailwind + CSS 变量) |
| 修改 | `package.json` (新增依赖) |
| 新增 | `postcss.config.mjs` |
| 删除 | 移除 Bulma CDN 引用 |
