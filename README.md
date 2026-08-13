# Oh My Canvas

基于 `project-template` 搭建的 Electron 桌面应用基础架构。当前阶段只包含通用应用能力，不包含具体业务。

## 技术栈

- Electron 主进程与安全的 preload bridge
- React + Vite 渲染进程
- Hono 本地 API
- SQLite + Drizzle 数据层
- Bun monorepo
- electron-builder 跨平台打包

## 开始开发

```bash
bun install
cp .env.example .env
bun run db:push
bun run dev
```

`bun run dev` 会启动 Vite、Electron 和 Electron 内置的本地 API。默认登录账号为 `admin / admin123`。

## 常用命令

```bash
bun run dev             # Electron 桌面开发模式
bun run dev:api         # 单独启动 Bun API
bun run dev:web         # 单独启动 Web 渲染器
bun run test            # 运行测试
bun run typecheck       # TypeScript 类型检查
bun run build           # 构建 Web 与 Electron
bun run package         # 生成未封装桌面应用
bun run dist            # 生成安装包
```

## 目录

```text
apps/api          Hono API 与认证边界
apps/electron     Electron 主进程和 preload
apps/web          React 渲染进程
packages/contracts 跨进程类型与 IPC 通道
packages/db       SQLite/Drizzle 数据访问
packages/logger   结构化日志
scripts           开发编排与构建脚本
```

详细边界和运行方式见 [架构文档](docs/architecture.md)。
