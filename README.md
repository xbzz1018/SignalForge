# SignalForge

SignalForge 是一个面向 A 股、指数与 ETF 的个人 AI 量化研究工作台。它把“提出问题、获取数据、执行分析、生成看板、核验结果”放进同一条工作流：用户用自然语言描述研究目标，系统生成可运行的研究工作空间，同时留下数据来源、计算过程和交付检查结果。

它不是自动交易软件，也不提供买卖建议。更适合需要反复比较标的、复盘策略、检查数据质量的个人研究场景。当前以浏览器访问，本地由 Next.js、Python 市场数据服务、PostgreSQL/TimescaleDB 和 Redis 组成。

## 可以完成哪些研究

| 场景 | 输入示例 | 主要输出 | 状态 |
| --- | --- | --- | --- |
| 个股诊断 | “贵州茅台最近的盈利质量和风险如何？” | 行情、K 线、财务、公告及数据质量看板 | 可用 |
| 技术与基本面 | “分析沪深 300 近一年趋势、波动与回撤” | 均线、量价、风险或财务指标分析 | 可用 |
| 多标的比较 | “比较两只 ETF 的收益和波动” | 统一口径的横向比较与证据 | 可用 |
| 策略回测 | “用 20/60 日均线回测 510300” | 净值、回撤、交易明细、风险指标和实验记录 | 可用 |
| 持仓风险 | “检查组合集中度与相关性” | 风险暴露、波动、回撤等研究结果 | 可用 |
| 行业/板块分析、策略研究 | 拆解板块或新策略假设 | 能力定义已登记，完整执行仍待完善 | 规划中 |

主页提供任务模板，也可以直接写问题；项目聊天保留任务进度、工具事件和生成结果。分析任务可以选择只回答，或生成独立的 Next.js 研究看板。不同场景的数据依赖和产物要求由能力配置管理，不是给所有问题套同一张图表。

### 功能入口

| 入口 | 实际用途 |
| --- | --- |
| [研究工作台](src/app/page.tsx) | 选择分析能力、模型与回答/看板模式；使用示例任务，查看近期项目和运行状态 |
| [项目聊天与预览](src/app/[project_id]/chat/) | 继续追问、跟踪 Agent/工具事件，查看生成文件、验证状态和看板预览 |
| [策略沙盒](src/app/strategy-platform/) | A 股与 ETF/指数分池研究；K 线、数据覆盖、补数、因子及策略目录、回测接口 |
| [报告档案](src/app/research-reports/) | 观察池、结构化日报、历史报告、主题洞察、来源与自动化记录 |
| [工具市场](src/app/skills/) | 查看和管理版本化 Skills，执行编辑、发布、回滚等治理操作 |
| [研究规范](src/app/business-knowledge/) | 查业务能力、典型任务、数据接口、依赖与交付约束 |
| [质量评测](src/app/eval-platform/) | 管理用例/评测集、运行队列、评测器、报告和失败定位 |
| [运行中心](src/app/ops-platform/) | 看服务依赖、Worker 槽位与队列、工作空间健康、生成链路和日志 |

报告可以记录 webhook 推送及 dry-run，默认不发送真实通知；真实发送需要单独配置。Memory、知识服务与集中日志是可选集成，不要求为了完成基本研究任务而全部启动。

### 任务最终留下什么

一个生成项目不仅有页面源码。工作空间中还包括任务与金融 run plan、原始行情或回测实验文件、供页面消费的最终数据、来源/质量证据，以及 build、产物和视觉验证报告。平台持久化项目、请求、AgentRun、Mission 与验收状态；这样即使预览出错，也能判断问题在规划、数据、工具、构建还是交付验收阶段。

## 项目设计亮点

**1. 模型负责理解问题，数据身份由确定性服务确认。** Query Rewrite 使用当前所选模型生成 schema v4 语义合同，提取研究意图、时间窗口与交付类型；证券 Resolver 再把名称或代码核对为标准标的。模型不可用或关键字段缺乏原文证据时停止后续取数，避免把猜测当成行情事实。

**2. 回测结果能追到输入，而不只展示一条收益曲线。** 市场数据服务记录复权方式、区间、参数、费率、原始 K 线与计算结果摘要。工作空间保存原始实验文件和最终看板引用；离线 replay 可检查输入和结果哈希是否一致。这里的“可复算”不等于已经具备历史 point-in-time 数据或实盘执行条件。

**3. Agent 写完代码不等于任务完成。** PI Agent 根据数据和 Skills 写入工作空间后，平台继续检查构建、数据证据、产物合同和预览 HTTP 状态。只有 Mission 接受证据回执，任务才进入完成态；失败会留下阶段和验证报告。工作空间写入后要求明确提交结果，减少无边界的继续读写。

**4. 长任务与生成代码有治理边界。** PostgreSQL generation job、事务 outbox、Worker registry、配额、lease/fencing 和项目单写约束负责派发与恢复；受信副作用工具支持审批。生成项目的 build/preview 在 Linux namespace 沙箱内执行，默认不注入平台密钥，预览只获得受限的行情通道。

**5. 质量不是单一通过率。** 评测将事实/证据、任务完成、产物、视觉、运行可靠性与安全边界分开记录；合同用例与真实模型 E2E 分开运行。重复评估需要固定数据与配置，并保留首轮通过、修复尝试、失败阶段和耗时，不能用一次成功代替稳定性统计。

这些是本项目的设计与运行机制；当前版本并不声称所有可选集成都已在这台机器上完成生产联调。

## 当前版本的改进重点

- 重整 SignalForge 的品牌图标、首页任务入口、近期项目状态、模型选择提示及多个管理页面的名称与布局，让常用研究路径更直接。
- 对齐按**实际选择模型**执行的检查：DeepSeek 官方直连只需要对应凭据；ModelPort 禁用时显示禁用状态，不把本机 Qwen 未启动误判为整个模型链路不可用。
- 区分数据库等必需依赖与 Memory、Loki 等可选集成的 `ok / warning / failed / disabled` 状态；数据库异常时部分页面可给出可读提示。
- 收紧 Agent 成功写入后的终止状态，给受限 CSS 语义编辑和降级行为补定向回归测试；保留 Linux 沙箱和工作空间路径约束。

## 技术结构

| 层次 | 技术与职责 |
| --- | --- |
| Web 与 API | Next.js App Router、React、TypeScript；任务、项目、预览、策略、报告和治理页面 |
| Agent 执行 | `@earendil-works/pi-agent-core`、金融 Domain Pack、版本化 Skills、工具与 Mission 状态机 |
| 行情与计算 | Python/FastAPI；证券解析、实时行情、历史 K 线、财务、技术指标、补数和回测 |
| 数据与缓存 | Prisma/PostgreSQL 保存业务状态，TimescaleDB 保存时序数据，Redis 缓存热点读取 |
| 质量与观测 | Vitest、pytest、Playwright、量化合同/E2E、doctor；Loki/Grafana/Alloy 可选 |

一次生成的大致顺序为：**项目请求 → LLM 语义规划 → 证券校验 → 行情/回测预取 → Agent 工具执行 → 工作空间构建 → Mission 验收 → 看板预览**。数据与证据落在生成工作空间，数据库保存索引、状态与摘要；清理构建缓存不应抹掉原始实验记录。

## 本地运行

已验证的开发拓扑是 Ubuntu 22.04 WSL2、Node.js 24、Python 3.14、uv，以及开启 Ubuntu WSL integration 的 Docker Desktop。生成项目的 Linux namespace 隔离需要 Linux；不要用 Windows 无沙箱运行代替该验收。

```bash
npm ci
uv sync --project services/market-data --extra baostock --extra akshare --locked
```

`npm ci` 的 postinstall 会生成缺失的 `.env` 和 `.env.local`。本机使用 DeepSeek 官方直连时，只在被 Git 忽略的 `.env.local` 放入自己的凭据与开关：

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

浏览器打开 `http://localhost:3000`（占用时启动器选择其他端口），在模型菜单中显式选择 `deepseek-v4-flash` 官方直连。默认本地 Qwen/ModelPort profile 仍在配置中；仅填写 DeepSeek Key 不会把全局默认模型改掉。Memory、知识服务和集中日志不参与最小启动；需要时按[配置指南](docs/configuration.md)接入。

启动后可执行 `npm run doctor:full -- --model=deepseek-v4-flash`，另用 `npm run check:market-freshness` 检查数据是否跟上交易日。报告或策略页面缺数时先区分“服务未启动”“本地数据过期”和“供应商不可达”，不要用反复调用模型掩盖数据问题。

## 验证与限制

```bash
npm run lint
npm run type-check
npm test
npm run test:coverage
npm run build
npm run test:e2e
npm run benchmark:quant:contract
```

真实 E2E 使用 `npm run benchmark:quant:e2e -- --model deepseek-v4-flash`，会消耗 API 额度；应按固定用例保存模型、数据快照、输入、失败阶段和预览状态。本地上一轮针对发布版本的检查为 **1348 个单测通过（27 跳过）、146 个后端测试通过（4 跳过），类型检查与构建通过**；这是一次环境下的结果，不是持续稳定性或生产可用性承诺。

行情受数据源与交易日影响；策略回测目前是研究模型，未覆盖全部实盘成交限制。行业/板块和新策略设计中的规划项不应当作已验收功能；Memory、ModelPort 本地模型及 Loki 需各自服务与凭据，关闭时不影响 DeepSeek 直连的核心任务。

## 继续阅读

- [文档总览](docs/README.md)：按启动、开发和排障目标进入专题。
- [架构与模块边界](docs/architecture.md)、[项目结构](docs/project-structure.md)：定位 Web、Agent、金融领域层及 Worker。
- [策略与回测](docs/strategy-platform-guide.md)、[投研日报](docs/research-automation-guide.md)、[评测体系](docs/evals-guide.md)：了解功能口径与限制。
- [API 总览](docs/api-reference.md)、[运行手册](docs/operations-runbook.md)、[故障排查](docs/troubleshooting.md)：接入和诊断时查阅。

本机 `.env.local`、数据库卷、`data/projects/`、`tmp/`、`.next/` 和虚拟环境不进入 Git；生成看板也不应夹带平台密钥。
