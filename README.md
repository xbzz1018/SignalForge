# SignalForge

我的个人量化研究工作台。它把自然语言问题接到真实行情、策略回测和 Agent 生成流程，最终交付可检查数据来源、运行过程和验证结果的研究页面。

例如输入“用最近一年的 20/60 日均线回测 510300，并生成带风险指标的策略看板”，SignalForge 会识别标的与时间范围、准备数据、执行分析，随后生成独立工作空间供预览和复查。研究结果仅用于学习与辅助判断，不提供交易指令或收益保证。

## 从问题到结果

| 阶段 | 平台做什么 | 可检查的结果 |
| --- | --- | --- |
| 建立任务 | 在工作台创建项目，选择模型和交付方式 | 项目、请求与执行状态 |
| 理解问题 | Query Rewrite 生成 schema v4 语义合同，Resolver 确认证券身份 | 标的、时间范围、研究意图 |
| 准备数据 | 查询行情与历史 K 线，按任务需要预取基本面或回测结果 | 数据文件、质量和来源记录 |
| 生成页面 | PI Agent 调用受约束工具，写入 Next.js 工作空间 | 页面源码、任务事件和工具记录 |
| 验证交付 | 构建、产物校验、Mission 验收和预览 | 验收回执与可访问的看板 |

模型未完成规划时，任务不会用关键词猜测结果继续预取。生成失败时，可以从任务状态、数据证据和工作空间验证报告定位阶段，而不只依赖最后一条聊天消息。

## 工作台里有什么

- **研究入口与项目聊天**：提交任务、追踪 Agent 执行、查看历史消息和生成页面。
- **策略平台**：管理股票及 ETF/指数研究池，查看行情、板块指标、策略目录和回测入口。
- **投研报告**：围绕观察池沉淀日报、主题分析、证据和运行历史。
- **能力与运行管理**：维护 Skills，检查业务能力、工作空间健康、队列、日志和评测结果。

这些页面共享同一套项目与数据上下文。用户可以从任务返回项目、再进入策略或报告视图核对数据，不需要把生成结果当成黑盒。

## 技术实现

**应用与数据。** 主站采用 Next.js、React 和 TypeScript；Python/FastAPI 提供市场数据接口。PostgreSQL 管理项目、任务和执行记录，TimescaleDB 存储时序行情，Redis 承接缓存。金融能力通过版本化 Task、Dataset、Connector、Domain Pack、Agent Profile 与 Delivery Pack 组合；项目会保存所用能力版本与摘要，便于追踪一次运行依赖了什么。

**模型与 Agent。** 多轮执行使用 `@earendil-works/pi-agent-core`。当前笔记本显式选择 `deepseek-v4-flash` 官方直连；本地 Qwen 与 ModelPort 接入仍保留，配置相应服务后可切换。金融规则、工具和 Mission 属于领域层，不写进通用 Agent loop。Skills 从仓库 `.pi/` 的版本化源加载，并校验 registry/lock 与内容摘要。

**可靠性与隔离。** Generation job 与事务 outbox 保存在 PostgreSQL；Worker registry、配额、lease/fencing 和资源锁约束并发与恢复。需要人工批准的工具会停在等待状态；工作空间写入后的结果提交有明确约束。生成代码的 build/preview 在 Linux namespace 沙箱内运行，不注入平台密钥，预览仅通过受限通道访问行情接口。

**可选集成。** Memory、知识服务与 Loki/Grafana/Alloy 可以按需启用。它们的缺席应呈现为禁用或可降级状态，不应与数据库、核心行情或模型任务故障混淆；运行治理页面仍可读取本地日志。

更多实现边界见 [架构总览](docs/architecture.md)、[Data Agent 架构](docs/data-agent-architecture.md)、[PI Agent 运行机制](docs/pi-agent-migration.md)与[生成工作空间契约](docs/generated-workspace-contract.md)。

## 本地启动

推荐 Ubuntu 22.04 WSL2、Node.js 24、Python 3.14、uv 和启用 Ubuntu WSL integration 的 Docker Desktop。Linux namespace 是生成代码隔离的一部分；仅在 Windows 直接运行不能代替这项验证。

```bash
npm ci
uv sync --project services/market-data --extra baostock --extra akshare --locked
```

`npm ci` 的 postinstall 会创建缺失的 `.env` 与 `.env.local`。将本机凭据放在被 Git 忽略的 `.env.local`，不要提交真实密钥。使用 DeepSeek 官方直连时：

```dotenv
DEEPSEEK_API_KEY="your-official-api-key"
QUANTPILOT_MODELPORT_ENABLED=0
QUANTPILOT_MEMORY_ENABLED=0
QUANTPILOT_KNOWLEDGE_ENABLED=0
```

```bash
docker compose up -d timescaledb redis
npm run db:init
npm run dev
```

打开 `http://localhost:3000`；如果端口已占用，启动器会选择 3000–3099 中的可用端口。在模型菜单中**显式选择 DeepSeek V4 Flash 官方直连**。只配置 API Key 不会自动替换默认的本地 Qwen 模型。需要本地模型、Memory 或集中日志时，再按[配置指南](docs/configuration.md)启动对应服务。

第一次排查建议执行 `npm run doctor:full -- --model=deepseek-v4-flash`。可选组件的 warning 不等于主链失败；行情数据是否跟上交易日应另用 `npm run check:market-freshness` 判断。

## 验证方式

```bash
npm run lint
npm run type-check
npm test
npm run test:coverage
npm run build
npm run benchmark:quant:contract
```

浏览器交互可用 `npm run test:e2e` 检查。真实模型评估使用 `npm run benchmark:quant:e2e -- --model deepseek-v4-flash`，需要数据库、行情服务、有效 API Key，并会产生模型费用。确定性合同通过不代表每次真实模型任务都会成功；应分别保存通过率、耗时、失败阶段和预览状态。

## 找到对应代码

| 需求 | 从这里看 |
| --- | --- |
| 工作台、项目聊天与页面布局 | `src/app/`、`src/components/` |
| Agent 运行、工具与金融规划 | `src/lib/agent/`、`src/lib/domains/finance/` |
| 市场数据、回测与接口 | `services/market-data/`、`src/lib/quant/` |
| 数据结构与初始化 | `prisma/`、`sqls/` |
| 验证与量化用例 | `tests/`、`benchmarks/`、`scripts/checks/` |

[文档索引](docs/README.md)连接配置、接口、数据口径和排障手册。生成项目、评估报告、数据库文件、`.env.local`、`node_modules/` 与虚拟环境都是本机产物，不随仓库发布。
