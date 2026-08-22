/** @type {import('next').NextConfig} */
const nextConfig = {
  // ISR 配合 Vercel 自动处理，无需额外配置
  // workspace root：显式指向项目根，避免误检 /Users/zephyr/pnpm-workspace.yaml（多个 workspace 文件时 Next 推断错误）
  turbopack: {
    root: __dirname,
  },
};

module.exports = nextConfig;
