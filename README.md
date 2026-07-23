# Financial News

新浪全球实时财经新闻 RSS 订阅 — 基于 Next.js + ISR，每 30 分钟自动更新。

## 功能特性

- **实时财经新闻** — 从新浪财经 7×24 直播接口抓取最新新闻
- **智能过滤** — 自动过滤无关内容（加密货币等关键词）
- **暗色模式** — 自适应系统深色/浅色主题，支持手动切换（点击右上角图标在 跟随系统 → 暗色 → 浅色 间循环）
- **响应式布局** — 移动端优先的卡片流设计，桌面端居中限宽 720px
- **入场动画** — 首屏前 10 条新闻卡片依次淡入（尊重系统 reduced-motion 偏好）
- **ISR 增量静态再生** — 首页每 30 分钟自动后台更新，用户始终看到已缓存的页面
- **RSS 订阅** — 提供标准 RSS 2.0 / JSON Feed 端点

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 16 (Pages Router) |
| UI | Tailwind CSS v4 + shadcn/ui |
| 主题 | next-themes（CSS 变量驱动） |
| 图标 | Lucide React |
| 动画 | CSS @keyframes（staggered fade-in） |
| 数据 | 新浪财经 API → ISR 静态生成 |
| Feed | feed 库（RSS 2.0 + JSON Feed v1） |

## 本地开发

```bash
# 要求 Node.js >= 18
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## 构建 & 运行

```bash
npm run build
npm start
```

## RSS 订阅

| 格式 | 端点 |
|------|------|
| RSS 2.0 | `/api/rss.xml` |
| JSON Feed | `/api/rss.json` |

## 主题系统

项目使用 CSS 变量 + `next-themes` 实现主题切换：

- **默认** 跟随系统 `prefers-color-scheme`
- **手动** 点击右上角图标循环切换：跟随系统 → 暗色 → 浅色
- **防闪烁** `_document.js` 设置 `suppressHydrationWarning` 避免 hydration 警告
- **颜色规范** 见 `styles/globals.css` 中的 `:root` / `.dark` CSS 变量

## 一键部署到 Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/zephyr110/financial-news)

或手动操作：

1. Fork 本仓库
2. 在 [Vercel](https://vercel.com) 导入仓库
3. 无需配置环境变量，直接部署

部署后 Vercel 自动运行 `next build`，首页首次请求即触发 ISR，之后每 30 分钟自动刷新。

## 项目结构

```
├── components/
│   ├── ui/                  # shadcn/ui 基础组件 (Button, Card, Badge, Alert)
│   ├── NewsCard.js          # 单条新闻卡片
│   ├── NewsList.js          # 新闻列表容器 + 入场动画
│   ├── ThemeToggle.js       # 主题切换按钮 (Lucide 图标)
│   ├── ErrorBanner.js       # API 错误提示横幅
│   └── EmptyState.js        # 空数据占位
├── lib/
│   ├── sina.js              # 新浪 API 配置
│   ├── fetchNews.js         # 抓取 & 过滤
│   ├── generateFeed.js      # RSS Feed 生成
│   └── utils.js             # shadcn cn() 工具函数
├── pages/
│   ├── _app.js              # ThemeProvider 根组件
│   ├── _document.js         # HTML 文档骨架 (lang, hydration)
│   ├── index.js             # 首页 (ISR)
│   └── api/
│       ├── rss.json.js      # JSON Feed 端点
│       └── rss.xml.js       # RSS 2.0 端点
├── styles/
│   └── globals.css          # Tailwind + CSS 变量 + shadcn 主题
├── components.json          # shadcn/ui 配置
├── postcss.config.mjs       # PostCSS (Tailwind v4)
├── jsconfig.json            # 路径别名 (@/*)
├── next.config.js
└── package.json
```

## License

ISC
