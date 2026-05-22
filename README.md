# QuantPilot

QuantPilot 是基于 Claudable 2.0.0 改造的量化专精 AI 工作台。当前阶段保留原有的应用生成、项目预览、Agent 调用、GitHub/Vercel/Supabase 集成能力，并将默认模型运行方式调整为 Claude Code 运行时直连 MiniMax 的 Anthropic-compatible 接口。

后续开发重点会逐步转向量化投研、因子研究、策略编排、回测分析、风险评估和交易执行辅助。

## 当前定位

- **项目底座**：Next.js 16 + React 19 + TypeScript。
- **默认 Agent**：Claude Code。
- **默认模型**：MiniMax M2.7。
- **模型接入方式**：通过 `ANTHROPIC_BASE_URL` 指向 MiniMax Anthropic-compatible API。
- **本地数据**：Prisma + SQLite，默认写入 `data/`，不提交到 Git。
- **本地预览**：主应用默认 `3000`，生成项目预览默认从 `3100` 开始分配。

## 基本组件

启动项目本体需要：

- Node.js >= 20.0.0
- npm >= 10.0.0
- Git
- Claude Code CLI
- MiniMax API Token

可选集成：

- Codex CLI
- Cursor CLI
- Qwen Code
- GLM CLI
- GitHub Token
- Vercel Token
- Supabase 凭据

## 环境变量

仓库提供 `.env.example` 作为模板。真实密钥只放在本地 `.env` 或 `.env.local`，这两个文件已加入 `.gitignore`。

Claude Code 直连 MiniMax 的关键配置：

```env
ANTHROPIC_BASE_URL="https://api.minimaxi.com/anthropic"
ANTHROPIC_AUTH_TOKEN="replace-with-your-minimax-token"
API_TIMEOUT_MS=3000000
CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1
ANTHROPIC_MODEL="MiniMax-M2.7"
ANTHROPIC_SMALL_FAST_MODEL="MiniMax-M2.7"
ANTHROPIC_DEFAULT_SONNET_MODEL="MiniMax-M2.7"
ANTHROPIC_DEFAULT_OPUS_MODEL="MiniMax-M2.7"
ANTHROPIC_DEFAULT_HAIKU_MODEL="MiniMax-M2.7"
```

本地数据库与预览端口配置：

```env
DATABASE_URL="file:../data/cc.db"
PROJECTS_DIR="./data/projects"
ENCRYPTION_KEY="replace-with-a-64-character-hex-secret"
PORT=3000
WEB_PORT=3000
NEXT_PUBLIC_APP_URL="http://localhost:3000"
PREVIEW_PORT_START=3100
PREVIEW_PORT_END=3999
```

## 项目如何拉起

在项目根目录执行：

```bash
npm install
cp .env.example .env
cp .env.example .env.local
```

然后把 `.env` 和 `.env.local` 中的 `ANTHROPIC_AUTH_TOKEN` 改成自己的 MiniMax Token。

启动 Web 应用：

```bash
npm run dev
```

默认访问：

```text
http://localhost:3000
```

如果 `3000` 端口被占用，启动脚本会自动选择 `3001` 等可用端口，并同步更新 `.env` 与 `.env.local`。

## Claude Code 接 MiniMax

安装 Claude Code CLI：

```bash
npm install -g @anthropic-ai/claude-code
```

写入 Claude Code 的本机配置：

```bash
bash claude_code_minimax_env.sh
```

脚本会把 MiniMax 的接口地址、Token、超时时间和默认模型写入 `~/.claude/settings.json`，并标记 Claude Code 已完成初始化。这里使用 Claude Code 作为本地运行时，不依赖原生 Anthropic Claude 登录。

也可以手动在 VS Code 的 Claude Code 扩展设置中配置同样的环境变量。

## 常用命令

```bash
# Web 开发模式
npm run dev
npm run dev:web

# 桌面端开发模式
npm run dev:desktop

# 构建 Web 应用
npm run build

# 启动生产构建
npm run start

# 类型检查
npm run type-check

# Prisma
npm run prisma:generate
npm run prisma:push
npm run prisma:migrate
npm run prisma:studio
npm run prisma:reset

# 检查 Claude Code 与 MiniMax 配置
npm run check-cli
```

## 初始化过程

`npm install` 会触发 `postinstall`，自动执行：

```bash
npm run ensure:env
```

该脚本会创建或更新：

- `.env`
- `.env.local`
- `data/cc.db`
- `data/projects/`
- `prisma/data/`

`npm run dev` 启动时会检查 SQLite 数据库状态，并在需要时执行：

```bash
npx prisma db push
```

## 模型管理

前端模型选项来自 `lib/constants/cliModels.ts` 及各 CLI 的模型定义文件。Claude Code 当前默认映射到 `MiniMax-M2.7`，并保留 Anthropic-compatible 的外部模型接入能力。

后续新增外部模型时，建议同步处理：

- 模型定义与展示名。
- CLI 默认模型。
- 环境变量说明。
- 设置页中的模型选择项。
- 运行时传入 Claude Code 的真实模型 ID。

## GitHub 整理原则

以下内容不会提交：

- `.env`
- `.env.local`
- `data/`
- `prisma/data/`
- `public/uploads/`
- `node_modules/`
- `.next/`
- 构建产物与本地缓存

这些目录都是本地运行数据或生成物，克隆仓库后会在安装和启动过程中重新生成。

## 故障排查

### 端口被占用

启动脚本会自动查找可用端口。实际使用的端口会写入 `.env` 和 `.env.local`。

### 数据库结构冲突

如果本地 SQLite 数据库结构与 Prisma schema 不一致，可以执行：

```bash
npm run prisma:push
```

如果需要完全重置数据库：

```bash
npm run prisma:reset
```

注意：重置会删除本地数据库数据。

### Claude Code 找不到 MiniMax 配置

确认 `.env`、`.env.local` 或 `~/.claude/settings.json` 中已经配置：

- `ANTHROPIC_BASE_URL`
- `ANTHROPIC_AUTH_TOKEN`
- `ANTHROPIC_MODEL`

然后重启开发服务。

## 许可证

MIT License
