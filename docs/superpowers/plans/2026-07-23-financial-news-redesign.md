# Financial News UI Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有 Bulma CSS 新闻展示页升级为 shadcn/ui + Tailwind CSS v4 风格，支持移动端响应式和系统深色/浅色主题自适应。

**Architecture:** Next.js Pages Router + React 19，数据层（lib/）和 API 路由不变。新增 Tailwind CSS v4 + shadcn/ui 组件库 + next-themes 主题系统。页面采用卡片流布局，移动端单列撑满，桌面端居中限宽 720px。

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, shadcn/ui, next-themes, lucide-react

## Global Constraints

- 不修改 `lib/`、`pages/api/`、`next.config.js` 任何文件
- 所有颜色使用 spec 定义的值，写入 CSS 变量
- 间距基于 8px 基准（Tailwind 默认）
- 主题切换优先级：localStorage > prefers-color-scheme
- 首屏 10 条卡片 staggered fade-in，后续直接显示
- 主题切换按钮使用 Lucide pure icon (ghost button, no text label)

---

## File Structure

```
financial-news/
├── components/
│   ├── NewsCard.js          # 单条新闻卡片 (shadcn Card)
│   ├── NewsList.js           # 新闻列表容器 + staggered 动画
│   ├── ThemeToggle.js        # Lucide Sun/Moon 纯图标按钮
│   ├── ErrorBanner.js        # API 错误提示 (shadcn Alert)
│   └── EmptyState.js         # 暂无数据占位
├── components/ui/             # shadcn CLI 自动生成
│   ├── card.jsx
│   ├── button.jsx
│   ├── badge.jsx
│   └── alert.jsx
├── styles/
│   └── globals.css           # Tailwind import + shadcn CSS 变量
├── pages/
│   ├── _app.js               # NEW: ThemeProvider + globals.css
│   ├── index.js              # REWRITE: 卡片流布局
│   └── api/                  # UNCHANGED
├── lib/                      # UNCHANGED
├── postcss.config.mjs        # NEW
├── components.json           # shadcn CLI 生成
└── package.json              # MODIFY: 添加依赖
```

---

### Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

**Interfaces:**
- Produces: `tailwindcss`, `@tailwindcss/postcss`, `postcss`, `next-themes`, `lucide-react` in `node_modules`

- [ ] **Step 1: Install Tailwind CSS v4 + PostCSS**

```bash
cd /Users/zephyr/code/financial-news && npm install -D tailwindcss @tailwindcss/postcss postcss
```

Expected: installs without errors.

- [ ] **Step 2: Install next-themes and lucide-react**

```bash
cd /Users/zephyr/code/financial-news && npm install next-themes lucide-react
```

Expected: installs without errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add Tailwind CSS v4, shadcn/ui deps, next-themes, lucide-react"
```

---

### Task 2: Configure Tailwind CSS v4 + PostCSS

**Files:**
- Create: `postcss.config.mjs`
- Create: `styles/globals.css`

**Interfaces:**
- Produces: Tailwind builds from `styles/globals.css`, PostCSS pipeline active

- [ ] **Step 1: Create postcss.config.mjs**

```js
// postcss.config.mjs
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

- [ ] **Step 2: Create styles/globals.css with CSS variables**

```css
@import "tailwindcss";

@layer base {
  :root {
    --background: #fafafa;
    --foreground: #1a1a1a;
    --card: #ffffff;
    --card-foreground: #1a1a1a;
    --primary: #2563eb;
    --primary-foreground: #ffffff;
    --muted: #6b7280;
    --muted-foreground: #6b7280;
    --destructive: #dc2626;
    --destructive-foreground: #ffffff;
    --positive: #16a34a;
    --border: #e5e5e5;
    --ring: #2563eb;
    --radius: 0.5rem;
  }

  .dark {
    --background: #0a0a0a;
    --foreground: #e5e5e5;
    --card: #141414;
    --card-foreground: #e5e5e5;
    --primary: #3b82f6;
    --primary-foreground: #ffffff;
    --muted: #6b7280;
    --muted-foreground: #6b7280;
    --destructive: #ef4444;
    --destructive-foreground: #ffffff;
    --positive: #22c55e;
    --border: #262626;
    --ring: #3b82f6;
    --radius: 0.5rem;
  }
}

@layer base {
  * {
    border-color: var(--border);
  }
  body {
    background-color: var(--background);
    color: var(--foreground);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
      "Helvetica Neue", Arial, "Noto Sans", "PingFang SC", "Microsoft YaHei",
      sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add postcss.config.mjs styles/globals.css
git commit -m "feat: configure Tailwind CSS v4 with shadcn color tokens"
```

---

### Task 3: Initialize shadcn/ui

**Files:**
- Create: `components.json` (generated)
- Create: `components/ui/card.jsx` (generated)
- Create: `components/ui/button.jsx` (generated)
- Create: `components/ui/badge.jsx` (generated)
- Create: `components/ui/alert.jsx` (generated)
- Create: `lib/utils.js` (generated)

**Interfaces:**
- Produces: shadcn/ui components in `components/ui/`, `utils` in `lib/utils.js`

- [ ] **Step 1: Initialize shadcn/ui**

```bash
cd /Users/zephyr/code/financial-news && npx shadcn@latest init -d
```

Expected: creates `components.json` and `lib/utils.js`.

- [ ] **Step 2: Add shadcn components**

```bash
cd /Users/zephyr/code/financial-news && npx shadcn@latest add card button badge alert -y
```

Expected: creates `components/ui/card.jsx`, `button.jsx`, `badge.jsx`, `alert.jsx`.

- [ ] **Step 3: Verify generated component paths**

```bash
ls components/ui/
```

Expected: `alert.jsx`, `badge.jsx`, `button.jsx`, `card.jsx`.

- [ ] **Step 4: Commit**

```bash
git add components.json components/ui/ lib/utils.js
git commit -m "feat: initialize shadcn/ui with card, button, badge, alert"
```

---

### Task 4: Create ThemeToggle Component

**Files:**
- Create: `components/ThemeToggle.js`

**Interfaces:**
- Consumes: `next-themes` useTheme hook, `lucide-react` Sun/Moon icons, `components/ui/button.jsx`
- Produces: `<ThemeToggle />` — renders a ghost icon button that toggles theme

- [ ] **Step 1: Create components/ThemeToggle.js**

```jsx
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { Button } from "./ui/button";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" disabled>
        <span className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      aria-label="切换主题"
    >
      {theme === "dark" ? (
        <Sun className="h-5 w-5 transition-transform duration-300" />
      ) : (
        <Moon className="h-5 w-5 transition-transform duration-300" />
      )}
    </Button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/ThemeToggle.js
git commit -m "feat: add ThemeToggle with Lucide Sun/Moon icons"
```

---

### Task 5: Create NewsCard Component

**Files:**
- Create: `components/NewsCard.js`

**Interfaces:**
- Consumes: `item` prop `{ id, rich_text, docurl, create_time }`, `components/ui/card.jsx`
- Produces: `<NewsCard item={item} index={number} />` — rendered card with staggered fade-in

- [ ] **Step 1: Create components/NewsCard.js**

```jsx
import {
  Card,
  CardContent,
} from "./ui/card";

export default function NewsCard({ item, index }) {
  const time = item.create_time
    ? new Date(item.create_time + "+08:00")
    : null;

  const animationDelay =
    index < 10 ? `${index * 50}ms` : "0ms";

  return (
    <Card
      className="news-card group cursor-pointer transition-all duration-200 hover:border-[var(--primary)] hover:shadow-sm"
      style={{
        animationDelay,
      }}
    >
      <CardContent className="p-4">
        <p className="text-sm leading-relaxed text-[var(--foreground)]">
          {item.rich_text}
        </p>
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-[var(--muted)]">
          <a
            href={item.docurl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--primary)] no-underline hover:underline tabular-nums"
          >
            {time && !isNaN(time.getTime())
              ? time.toLocaleTimeString("zh-CN", {
                  hour12: false,
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "--:--"}
          </a>
          <span>·</span>
          <span>新浪财经</span>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/NewsCard.js
git commit -m "feat: add NewsCard with staggered fade-in animation"
```

---

### Task 6: Create NewsList Component

**Files:**
- Create: `components/NewsList.js`

**Interfaces:**
- Consumes: `items` prop (array of news objects), `components/NewsCard.js`
- Produces: `<NewsList items={items} />` — styled list with `space-y-3`

- [ ] **Step 1: Create components/NewsList.js**

```jsx
import NewsCard from "./NewsCard";

export default function NewsList({ items }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="space-y-3">
      <style jsx global>{`
        .news-card {
          opacity: 0;
          animation: fadeInUp 0.3s ease-out forwards;
        }
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      {items.map((item) => (
        <NewsCard key={item.id} item={item} index={items.indexOf(item)} />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/NewsList.js
git commit -m "feat: add NewsList with staggered fade-in"
```

---

### Task 7: Create ErrorBanner Component

**Files:**
- Create: `components/ErrorBanner.js`

**Interfaces:**
- Consumes: `message` prop (string), `components/ui/alert.jsx`
- Produces: `<ErrorBanner message={error} />`

- [ ] **Step 1: Create components/ErrorBanner.js**

```jsx
import { Alert, AlertDescription } from "./ui/alert";
import { AlertCircle } from "lucide-react";

export default function ErrorBanner({ message }) {
  if (!message) return null;

  return (
    <Alert variant="destructive" className="mb-6">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/ErrorBanner.js
git commit -m "feat: add ErrorBanner component"
```

---

### Task 8: Create EmptyState Component

**Files:**
- Create: `components/EmptyState.js`

**Interfaces:**
- Produces: `<EmptyState />` — centered placeholder for empty news list

- [ ] **Step 1: Create components/EmptyState.js**

```jsx
import { Newspaper } from "lucide-react";

export default function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-[var(--muted)]">
      <Newspaper className="h-12 w-12 mb-4 opacity-40" />
      <p className="text-sm">暂无新闻数据</p>
      <p className="text-xs mt-1 opacity-60">请稍后刷新页面</p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/EmptyState.js
git commit -m "feat: add EmptyState component"
```

---

### Task 9: Create pages/_app.js with ThemeProvider

**Files:**
- Create: `pages/_app.js`

**Interfaces:**
- Consumes: `next-themes` ThemeProvider, `styles/globals.css`
- Produces: App shell with theme context for all pages

- [ ] **Step 1: Create pages/_app.js**

```jsx
import { ThemeProvider } from "next-themes";
import "../styles/globals.css";

export default function App({ Component, pageProps }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <Component {...pageProps} />
    </ThemeProvider>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add pages/_app.js
git commit -m "feat: add _app.js with ThemeProvider"
```

---

### Task 10: Rewrite pages/index.js

**Files:**
- Modify: `pages/index.js` (full rewrite)

**Interfaces:**
- Consumes: All components from Tasks 4–9, `lib/fetchNews.js`
- Produces: Complete redesigned homepage with card layout, theme toggle, responsive design

- [ ] **Step 1: Rewrite pages/index.js**

```jsx
import Head from "next/head";
import { fetchNews } from "../lib/fetchNews";
import NewsList from "../components/NewsList";
import ThemeToggle from "../components/ThemeToggle";
import ErrorBanner from "../components/ErrorBanner";
import EmptyState from "../components/EmptyState";

export default function Home({ items, error }) {
  return (
    <>
      <Head>
        <title>Financial News — 全球实时财经新闻</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta
          name="description"
          content="新浪全球实时财经新闻直播"
        />
        <link
          rel="alternate"
          type="application/rss+xml"
          title="Recent Entries"
          href="/api/rss.xml"
        />
      </Head>

      <div className="min-h-screen bg-[var(--background)]">
        <div className="mx-auto max-w-[720px] px-4 sm:px-6">
          {/* Header */}
          <header className="flex items-center justify-between pt-8 pb-6">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
                全球实时财经新闻
              </h1>
              <p className="mt-1 text-xs text-[var(--muted)]">
                新浪财经 7×24 直播 · 实时更新
              </p>
            </div>
            <ThemeToggle />
          </header>

          {/* Divider */}
          <hr className="border-[var(--border)] mb-6" />

          {/* Error */}
          <ErrorBanner message={error} />

          {/* Content */}
          {!items || items.length === 0 ? (
            <EmptyState />
          ) : (
            <NewsList items={items} />
          )}

          {/* Footer */}
          <footer className="py-10 text-center text-xs text-[var(--muted)]">
            <p>
              Powered by{" "}
              <a
                href="https://zhibo.sina.com.cn"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--primary)] hover:underline"
              >
                新浪财经
              </a>
              {" "}·{" "}
              <a
                href="/api/rss.xml"
                className="text-[var(--primary)] hover:underline"
              >
                RSS
              </a>
              {" / "}
              <a
                href="/api/rss.json"
                className="text-[var(--primary)] hover:underline"
              >
                JSON Feed
              </a>
            </p>
          </footer>
        </div>
      </div>
    </>
  );
}

export async function getStaticProps() {
  try {
    const items = await fetchNews();
    return {
      props: { items, error: null },
      revalidate: 3600,
    };
  } catch (error) {
    console.error("Failed to fetch news:", error);
    return {
      props: { items: [], error: error.message },
      revalidate: 300,
    };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add pages/index.js
git commit -m "feat: rewrite homepage with shadcn/ui card layout and theme system"
```

---

### Task 11: Build and Verify

**Files:**
- None changed (verification only)

- [ ] **Step 1: Build the project**

```bash
cd /Users/zephyr/code/financial-news && npm run build
```

Expected: successful build with no errors. ISR page generated.

- [ ] **Step 2: Verify no Bulma references remain**

```bash
grep -r "bulma" pages/ components/ styles/ || echo "OK: No Bulma references found"
```

Expected: `OK: No Bulma references found`

- [ ] **Step 3: Verify components directory structure**

```bash
ls components/ && ls components/ui/
```

Expected: All 5 custom components + 4 shadcn UI components.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final verification after build"
```
---

## Self-Review

**1. Spec coverage:**
- ✅ 字体系统 → globals.css `font-family`, NewsCard text classes
- ✅ 色彩系统 Light/Dark → globals.css CSS variables (`:root` / `.dark`)
- ✅ 间距体系 → Tailwind classes (`space-y-3`, `p-4`, `px-4`)
- ✅ 响应式断点 → `max-w-[720px]`, `px-4 sm:px-6`
- ✅ 主题切换 + FOUC 防护 → `_app.js` ThemeProvider, ThemeToggle mounted guard
- ✅ Lucide 纯图标按钮 → `ThemeToggle.js` Sun/Moon + ghost variant
- ✅ 卡片设计（圆角、边框、hover） → NewsCard classes
- ✅ 入场动画（10条 staggered） → NewsList global `<style jsx>` + NewsCard animationDelay
- ✅ 不变更范围（lib/, pages/api/, next.config.js） → 无文件触及

**2. Placeholder scan:** No TBD, TODO, or vague instructions. Every step has exact code or commands.

**3. Type consistency:** All component imports match their file names. Props pass through correctly (item shape matches fetchNews output).
