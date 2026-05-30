# QuantPilot

QuantPilot 是面向量化投研、金融数据分析和可视化看板生成的 AI 工作台。用户用自然语言提出研究问题，平台会调度 Agent Runtime、读取真实数据、生成可运行工作空间，并通过自动验证、视觉检查、产物契约和评测链路把结果收敛到“好看、可用、可追溯”。

生成内容仅用于研究、复盘和辅助决策，不构成投资建议、收益承诺或即时交易指令。

## 核心能力

- AI 工作台：任务入口、项目聊天、工作空间预览、任务记录和自动修复链路。
- 量化数据底座：PostgreSQL + TimescaleDB + Redis，承载应用状态、时序行情、估值因子、缓存和后续任务状态。
- 市场数据服务：Python/FastAPI 后端，提供行情、K 线、财务、公告、指标、补数和策略平台接口。
- 策略平台：股票池、ETF/指数池、策略目录、板块资金、金融知识和后续回测入口。
- Skills 能力层：管理 `.claude/skills`，沉淀量化规划、数据质量、可视化生成和自修复能力。
- 评测与运维：评测平台、数据平台、运维平台共同覆盖生成质量、数据契约、工作空间健康和运行 trace。

## 快速启动

```bash
npm install
cp .env.example .env
cp .env.example .env.local
```

把 `.env` 或 `.env.local` 中的模型 token 改成自己的值，真实密钥不要提交到 Git。

```bash
npm run db:up
npm run db:init
```

```bash
cd services/market-data
uv sync --extra baostock --extra akshare
uv run quantpilot-market-api
```

回到项目根目录：

```bash
npm run dev
```

默认访问 `http://localhost:3000`。推荐启动顺序是数据库、市场数据后端、主前端。

## 常用入口

| 入口 | 地址 | 说明 |
| --- | --- | --- |
| AI 工作台 | `http://localhost:3000` | 创建任务、进入项目聊天和预览 |
| 策略平台 | `http://localhost:3000/strategy-platform` | 股票池、ETF/指数池、板块资金、策略目录和金融知识 |
| Skills 管理 | `http://localhost:3000/skills` | 编辑、发布、回滚和导入核心 skills |
| 数据平台 | `http://localhost:3000/data-platform` | 查看能力域、数据接口、契约和验证边界 |
| 运维平台 | `http://localhost:3000/ops-platform` | 查看 workspace 健康、产物、队列和 trace |
| 评测平台 | `http://localhost:3000/eval-platform` | 运行评测、管理评测集、查看队列和报告 |

## 常用命令

| 场景 | 命令 |
| --- | --- |
| 前端开发 | `npm run dev` |
| 前端质量门 | `npm run lint && npm run type-check && npm run build` |
| 数据库启动 | `npm run db:up && npm run db:init` |
| 数据库检查 | `npm run db:doctor` |
| Redis CLI | `npm run redis:cli` |
| Skills 检查 | `npm run check:skills` |
| 验证修复链路检查 | `npm run check:validation-repair` |
| 首页视觉 smoke | `npm run check:homepage` |
| 量化后端 | `cd services/market-data && uv run quantpilot-market-api` |
| 后端质量门 | `cd services/market-data && uv run ruff check . && uv run pytest` |

## 文档导航

项目知识集中放在 `docs/`：

- [文档总览](docs/README.md)
- [教学路径](docs/learning/README.md)
- [架构总览](docs/architecture.md)
- [项目结构与分层边界](docs/project-structure.md)
- [基础设施配置](docs/infrastructure.md)
- [行情数据源采集知识库](docs/market-data-source-knowledge.md)
- [生成工作空间契约](docs/generated-workspace-contract.md)
- [Skills 治理规范](docs/skills-governance.md)
- [Agent 评测指南](docs/evals-guide.md)
- [本地产物与生成文件边界](docs/local-generated-files.md)
- [故障排查](docs/troubleshooting.md)
- [市场数据服务](services/market-data/README.md)

## 本地数据与 Git 边界

以下内容默认不进入 Git：`.env`、`.env.local`、`.next/`、`node_modules/`、`data/`、`tmp/`、`public/uploads/`、`public/generated/`、`services/market-data/.venv/`、`services/**/.ruff_cache/`。

首次使用需要的 PostgreSQL / TimescaleDB SQL 放在 `sqls/`。生成工作空间源码和大产物放在 `data/projects/`，平台数据库只保存索引、状态和摘要。
