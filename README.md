# Financial News

新浪全球实时财经新闻 RSS 订阅 — 基于 Next.js + ISR，每 1 小时自动更新。

## 工作原理

- 从新浪财经 7×24 直播接口抓取最新新闻
- 过滤无关内容（加密货币、疫情等关键词）
- 首页通过 **ISR (Incremental Static Regeneration)** 每 1 小时自动重新生成
- 提供标准 RSS 2.0 / JSON Feed 订阅端点
- 用户永远看到已缓存的页面，不会因 API 失败而白屏

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

## 一键部署到 Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/zephyr110/financial-news)

或手动操作：

1. Fork 本仓库
2. 在 [Vercel](https://vercel.com) 导入仓库
3. 无需配置环境变量，直接部署

部署后 Vercel 自动运行 `next build`，首页首次请求即触发 ISR，之后每 1 小时自动刷新。

## 项目结构

```
├── lib/
│   ├── sina.js          # 新浪 API 配置
│   ├── fetchNews.js     # 抓取 & 过滤
│   └── generateFeed.js  # RSS Feed 生成
├── pages/
│   ├── index.js         # 首页 (ISR)
│   └── api/
│       ├── rss.json.js  # JSON Feed 端点
│       └── rss.xml.js   # RSS 2.0 端点
├── next.config.js
└── package.json
```

## License

ISC
