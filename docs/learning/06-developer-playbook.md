# 06. 开发者协作手册

目标：知道 QuantPilot 的代码该往哪里放、怎么验证、哪些文件不该提交。

![数据平台](assets/data-platform.png)

## 代码边界

| 路径 | 责任 |
| --- | --- |
| `src/app/` | Next.js App Router 页面和 API 路由 |
| `src/components/` | 可复用前端组件 |
| `src/lib/services/` | 主应用业务服务 |
| `src/lib/quant/` | 量化平台领域逻辑、评测、验证、策略、skills |
| `src/lib/db/` | Prisma Client 和数据库入口 |
| `services/market-data/` | Python/FastAPI 市场数据服务 |
| `prisma/` | PostgreSQL 主业务 schema |
| `sqls/` | PostgreSQL / TimescaleDB 初始化 SQL |
| `scripts/` | 开发、构建、检查、数据库、评测和 skills 脚本 |
| `.claude/skills/` | QuantPilot 核心 skills |
| `docs/` | 项目知识、教学和排障 |
| `data/projects/` | 本地生成工作空间，默认不提交 |

详细边界见 [项目结构与分层边界](../project-structure.md)。

## 开发原则

- 前端页面只做组织和交互，复杂业务逻辑下沉到组件或 `src/lib/*`。
- API route 只做参数解析、校验和服务调用。
- 市场数据写入和读取优先通过 `services/market-data`，生成页面不要直接抓外部网页接口。
- PostgreSQL/TimescaleDB 是事实库，Redis 是短期缓存，不把 Redis 当长期数据源。
- 生成工作空间的问题优先修 skill 和生成链路，不直接手改单个工作空间作为长期方案。
- 文档、SQL 和代码需要同步更新，避免“代码会跑但新同学不知道怎么用”。

## 提交前检查

```bash
npm run lint
npm run type-check
npm run check:skills
npm run check:validation-repair
```

涉及数据库：

```bash
npm run db:init
npm run db:doctor
```

涉及后端：

```bash
cd services/market-data
uv run ruff check .
uv run pytest
```

涉及截图或页面：

```bash
npm run check:homepage
```

必要时用 Playwright 截图人工复核，确认没有错误覆盖层、空白页、验证失败页或横向溢出。

## 不应提交的内容

- `.env`、`.env.local`
- `.next/`
- `node_modules/`
- `data/`
- `tmp/`
- `public/uploads/`
- `public/generated/`
- `services/market-data/.venv/`
- `services/**/.ruff_cache/`
- 真实 token、个人路径、未脱敏日志

## 推荐补充文档的位置

| 新知识 | 推荐位置 |
| --- | --- |
| 新组件、新端口、新环境变量 | `docs/infrastructure.md` |
| 新表、新字段、新 SQL | `sqls/README.md` 和相关专题文档 |
| 新行情源、新字段口径 | `docs/market-data-source-knowledge.md` |
| 生成工作空间文件变化 | `docs/generated-workspace-contract.md` |
| 新 skill 或版本治理规则 | `docs/skills-governance.md` |
| 新评测规则 | `docs/evals-guide.md` |
| 新人教程 | `docs/learning/` |

## 调试口诀

1. 先看页面是否能打开。
2. 再看 API 是否返回。
3. 再看数据库是否有数据。
4. 再看 skill 是否把数据正确用进页面。
5. 最后看验证报告和截图，确认问题是数据、代码、布局还是契约。
