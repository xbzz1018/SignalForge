# SignalForge

SignalForge 是个人量化研究工作台，基于开源 [QuantPilot](https://github.com/tiammomo/QuantPilot) 的代码与金融工作流持续完善。使用自然语言提出研究问题后，系统将证券解析、真实数据、Skills、Agent 工具、Mission 和可视化规则连接起来，生成可运行的工作空间，并通过验证与评测检查结果。当前工作的重点是 DeepSeek 官方直连、后端链路复现与稳定性、可选组件诊断，以及界面品牌和入口体验。

底层 Data Agent 架构、PI Agent 治理和量化基础设施沿用上游设计；本仓库保留原始 Git 历史及 MIT 版权声明，方便区分原始实现和后续改动。为了兼容既有数据和脚本，内部仍保留部分 `quantpilot` 标识。后续工作沿“可信数据 → 可复现实验 → 持续研究 → 结果复盘”推进，具体方向见 [路线图](docs/ROADMAP.md)。

生成内容仅用于研究、复盘和辅助决策，不构成投资建议、收益承诺或即时交易指令。

从浏览器发起研究任务即可进入主链：选择模型、解析问题、取数/回测、生成工作空间，再由验证与 Mission 验收确认结果。数据库和缓存是核心依赖；Memory、知识平台以及集中日志按需接入。完整 Web 开发栈由本地 Docker Compose 与服务启动脚本配合运行。

## 功能与链路

### 从任务到研究结果

- 工作台负责新建任务，项目页保留聊天、运行状态、生成记录与看板预览。失败任务可以依据验证结果检查工作空间，而不是只看一条模型回复。
- Query Rewrite 使用项目选定的模型输出 schema v4 语义合同；时间范围、宽域分析和仅回答意图需要原始提问的证据。证券代码再由独立 Resolver 确认；模型不可用时不把关键词猜测伪装成规划成功。
- 金融领域能力以版本化 Task、Dataset、Connector、Domain Pack、Agent Profile、Delivery Pack 和 Execution Plan 组合。项目保存 Profile/Domain/Delivery/capability 的版本和 SHA-256 锁；金融 profile 为 `finance.quant`，Next.js 交付为 `workspace.next-dashboard`。具体扩展边界见 [Data Agent 架构](docs/data-agent-architecture.md)。
- 输出包括可构建的工作空间、数据文件、来源与质量证据，以及 Mission 验收回执；生成产物和平台状态分开保存，便于复查与复现。

### 数据、策略与报告

- PostgreSQL 管项目和任务状态，TimescaleDB 存历史行情、因子及策略时序数据，Redis 承接缓存。Python/FastAPI 市场数据服务负责行情、K 线、财务、公告、指标和补数接口。
- 策略平台提供股票池、ETF/指数池、板块资金、策略目录、基础组件与回测入口；投研情报中心面向观察池组织证据型日报、主题洞察和运行历史。
- 业务知识、评测和运行治理页面分别展示能力契约、生成质量、工作空间健康、Worker/队列与日志。数据或可选服务停机时应分清降级提示与核心依赖故障。

### Agent 执行与安全边界

- 多轮模型调用采用开源 `@earendil-works/pi-agent-core`。本地 Qwen 走 ModelPort；DeepSeek 既可经 ModelPort 转发，也可按项目选择官方 OpenAI-compatible 直连。金融规则留在 Domain Pack，执行内核不直接绑定证券工具和看板模板。
- 平台治理层使用 PostgreSQL generation job 与事务 outbox 派发，Worker registry、全局槽位、用户配额、分层 lease/fencing 和资源锁控制并发与恢复。AgentRun 等待人工审批时保留 checkpoint，拒绝复用失效 attempt 的批准；工具写入工作空间后要求显式 `submit_result`。
- `.pi/**` 是 Skills 的权威源，registry/lock 与 SHA-256 约束版本，运行时只读编译上下文。Memory Usage Receipt 与 AKEP ContextPack 通过独立 HTTP 契约接入；前者和后者的使用、反馈及项目隔离不要求共享数据库。
- 生成代码的 build/preview 默认放进 Linux user、mount、network、PID namespace，工作空间只读、平台密钥不注入；预览通过 Unix Socket 暴露，并只允许受限的无凭据行情桥接。详见 [PI Agent 治理边界](docs/pi-agent-migration.md) 与[工作空间契约](docs/generated-workspace-contract.md)。
 ## 快速启动
## 快速启动

本地复现使用 Ubuntu 22.04 WSL2、Node.js 24、Python 3.14、uv 和 Docker Desktop WSL integration。先按锁文件安装依赖；`npm ci` 的 postinstall 会创建缺失的 `.env` 和 `.env.local`。后者只保存本机凭据和少量覆盖，不要把整份 `.env.example` 复制进去。

```bash
npm ci
uv sync --project services/market-data --extra baostock --extra akshare --locked
```

当前笔记本使用 DeepSeek 官方直连：在不进入 Git 的 `.env.local` 中填写自己的 Key，并在页面中显式选择 `deepseek-v4-flash`：

```dotenv
DEEPSEEK_API_KEY="replace-with-your-official-deepseek-api-key"
QUANTPILOT_MODELPORT_ENABLED=0
QUANTPILOT_MEMORY_ENABLED=0
QUANTPILOT_KNOWLEDGE_ENABLED=0
```

本地 Qwen 和 ModelPort profile 仍保留，具备相应服务和受限客户端凭据时可使用 `MODELPORT_API_KEY`。仅配置 DeepSeek Key 不会改变默认的 Qwen 选择；Memory 是独立可选组件，关闭后不必启动服务。

可选上下文服务按 Consumer 与 Workspace 双层隔离。ModelPort 的客户端 Key 只授权当前应用；Memory 使用独立 tenant，AKEP 限定 shared Space 和当前项目 Space；作用域摘要写入数据库及 workspace evidence。细节见 [联合上下文与项目隔离](docs/context-composition.md)。

| 运行方式 | `.env.local` 最小配置 | 额外动作 |
| --- | --- | --- |
| 本地 Qwen + ModelPort DeepSeek | `MODELPORT_API_KEY=...` | 启动 ModelPort 并配置相应 provider |
| 只使用 Qwen | `MODELPORT_API_KEY=...` | 客户端 Key 只授权 `local_qwen` 即可 |
| 当前使用：DeepSeek 官方直连 | `DEEPSEEK_API_KEY=...` | 项目/全局设置选择 `deepseek-v4-flash` |
| 不启用 Memory | `QUANTPILOT_MEMORY_ENABLED=0` | 无需启动或配置 Memory 服务 |

完整的文件优先级、可复制组合、生产 secret 边界和验证命令见 [配置、模型接入与可选组件指南](docs/configuration.md)。

```bash
npm run db:up
npm run db:init
```

如需集中日志和 Grafana 排查界面，可再启动本地可观测性组件：

```bash
npm run obs:up
```

在项目根目录启动完整开发栈。`npm run dev` 先启动或复用 market-data，再检查数据库 schema、选择前端端口并启动 Next.js；需要分开排障时可分别使用 `dev:market` 和 `dev:web`：

```bash
npm run dev
```

默认访问 `http://localhost:3000`。如果 `3000` 被占用，启动器会在 `3000-3099` 内选择可用端口并同步 `.env` / `.env.local` 中的 `PORT`、`WEB_PORT` 和 `NEXT_PUBLIC_APP_URL`。生成项目预览端口池从 `4100` 开始；本地 Loki 默认映射到宿主机 `33100`，不要把主前端长期放到这些端口上。

不启动 Loki/Grafana 时，运行治理中心会自动降级到本地文件日志；不启动市场数据后端时，策略平台和业务知识中心只能展示有限兜底信息。

## 常用入口

| 入口 | 地址 | 说明 |
| --- | --- | --- |
| AI 工作台 | `http://localhost:3000` | 创建任务、进入项目聊天和预览 |
| 策略平台 | `http://localhost:3000/strategy-platform` | 股票池、ETF/指数池、板块资金、策略目录、基础组件和金融知识 |
| 投研情报中心 | `http://localhost:3000/research-reports` | 管理观察池、研究证据、报告库、主题洞察和自动化交付 |
| Skills 管理 | `http://localhost:3000/skills` | 编辑、发布、回滚和导入核心 skills |
| 量化业务知识中心 | `http://localhost:3000/business-knowledge` | 查看业务能力、典型场景、交付规范和执行依赖 |
| 运行治理中心 | `http://localhost:3000/ops-platform` | 统一查看 Worker/队列、服务依赖、工作空间交付、生成链路和运行日志 |
| 评测平台 | `http://localhost:3000/eval-platform` | 运行评测、管理评测集、查看队列和报告 |

## 常用命令

| 场景 | 命令 |
| --- | --- |
| 完整开发环境（前端 + market-data） | `npm run dev` |
| 仅启动主前端 | `npm run dev:web` |
| 仅启动量化后端 | `npm run dev:market` |
| 指定主前端端口 | `npm run dev -- --port 3000` |
| 单元与后端测试 | `npm test` |
| 前端覆盖率门槛 | `npm run test:coverage` |
| 依赖来源检查 | `npm run check:dependency-sources` |
| PostgreSQL 持久化与并发测试 | 设置隔离的 `PI_AGENT_TEST_DATABASE_URL` 后运行 `npm run test:pi-agent:postgres` |
| 产品指标桌面/移动端浏览器合同 | 构建后运行 `npm run test:e2e`，准备与证据说明见 [运行治理中心指南](docs/ops-platform-guide.md) |
| 确定性发布质量门 | `npm run release:check` |
| 含依赖审计与运行态诊断 | `npm run release:check:full` |
| 数据库启动 | `npm run db:up && npm run db:init` |
| 完整本地 Docker 基础设施 | `docker compose up -d` |
| 数据库检查 | `npm run db:doctor` |
| 本地单次消费 generation job | `PI_AGENT_DISPATCH_MODE=worker npm run worker:generation:once` |
| 刷新交易日历、日线并校验覆盖 | `npm run market:maintain` |
| 只检查行情维护参数 | `npm run market:maintain:dry-run` |
| 初始化/维护登录管理员 | `npm run auth:bootstrap` |
| 验证完整用户生命周期 | `npm run auth:verify` |
| 清理过期认证数据与配额预留 | `npm run auth:cleanup` |
| Redis CLI | `npm run redis:cli` |
| 可观测性启动 | `npm run obs:up` |
| 可观测性日志 | `npm run obs:logs` |
| Skills 检查 | `npm run check:skills` |
| 验证修复链路检查 | `npm run check:validation-repair` |
| 首页视觉 smoke | `npm run check:homepage` |
| 全平台响应式视觉 smoke | 启动 Web 后运行 `npm run check:platform-visuals` |
| 量化后端 | `cd services/market-data && uv run quantpilot-market-api` |
| 后端质量门 | `cd services/market-data && uv run ruff check . && uv run pytest` |
| 文档本地链接检查 | `npm run check:docs` |
| 四类生成模板真实构建 | `npm run check:scaffold-templates` |
| 模型配置边界检查 | `npm run check:ai-provider-boundary` |
| 模型目录与凭据连通性检查 | `npm run check:models` |
| Qwen、ModelPort DeepSeek、Memory 基础契约联调 | `npm run check:integrations` |
| ModelPort、Memory、AKEP 30 题真实体验验收 | `npm run check:triad-experience` |
| 四组自然语言变体、共 120 题真实压力验收 | `npm run check:triad-experience:large` |
| 50 题 Qwen + Memory + AKEP 持久闭环验收 | 先在 AKEP 运行 `pnpm seed:quantpilot-acceptance-50 -- --output=<manifest>`，再运行 `npm run check:memory-knowledge-50 -- --manifest=<manifest>`；数据默认保留 |
| 创建真实任务、生成 Workspace 并验收预览 | `npm run check:task-e2e -- --campaign=<批次>`（完整通过后自动清理测试项目） |

## 文档导航

配置、架构和运行文档统一从 [docs/README.md](docs/README.md) 进入；数据库与 E2E 清理先读
[数据生命周期与安全清理](docs/data-lifecycle.md)，不要凭表名或创建时间直接删除数据。

项目知识集中放在 `docs/`。根 README 只放少量入口，完整索引看 [文档总览](docs/README.md)。

| 你要做什么 | 入口 |
| --- | --- |
| 不知道从哪篇开始 | [文档总览与角色路径](docs/README.md) |
| 想选择模型、关闭 Memory 或理解 `.env` | [配置、模型接入与可选组件指南](docs/configuration.md) |
| 想系统学习项目 | [教学路径](docs/learning/README.md) |
| 想参与开发或判断代码放哪 | [项目结构与分层边界](docs/project-structure.md) / [模块边界](docs/module-boundaries.md) |
| 想理解或扩展 Agent 框架 | [PI Agent 采用与治理边界](docs/pi-agent-migration.md) / [PI Agent 架构](docs/pi-agent.md) |
| 想查接口、字段或数据源口径 | [API 总览](docs/api-reference.md) / [数据字典](docs/data-dictionary.md) / [行情数据源知识库](docs/market-data-source-knowledge.md) |
| 想做每日投研报告和推送 | [投研情报中心与日报自动化指南](docs/research-automation-guide.md) |
| 想排障或做发布前检查 | [运行手册](docs/operations-runbook.md) / [故障排查](docs/troubleshooting.md) |
| 想启用登录或配置权限/用量配额 | [用户、权限、配额与会话管理](docs/authentication.md) |
| 想接入、使用或排查用户记忆 | [用户记忆服务接入、使用与效果验证](docs/user-memory-integration.md) |
| 想理解 Memory、Knowledge 与 QuantPilot 的联合归因 | [联合上下文与结果归因](docs/context-composition.md) |
| 想看后续优先级 | [持续完善路线图](docs/ROADMAP.md) |

## 推荐学习路径

如果是第一次接触项目，建议按这个顺序读：

| 阶段 | 文档 | 目标 |
| --- | --- | --- |
| 先找阅读路径 | [文档总览与角色路径](docs/README.md) | 按启动、开发、排障、策略、评测、skills 等目标选择阅读顺序 |
| 选择运行拓扑 | [配置、模型接入与可选组件指南](docs/configuration.md) | 选择 ModelPort、官方直连和 Memory 开关 |
| 先建立全局图 | [项目学习地图](docs/learning/00-project-study-map.md) | 知道产品、数据、生成和质量四条主线 |
| 再跑通本地环境 | [本地启动与健康检查](docs/learning/01-quick-start.md) | 拉起数据库、后端、前端和可选观测组件 |
| 理解内部组件 | [内部组件学习指南](docs/internal-components.md) | 把页面、服务、数据、Skills、验证和运维串起来 |
| 学会生成链路 | [AI 工作空间生成链路](docs/learning/02-ai-workspace-generation.md) | 理解 run plan、data、evidence、validation 和 repair plan |
| 学会数据与策略 | [市场数据与策略平台](docs/learning/03-market-data-and-strategy-platform.md) | 理解股票池、K 线、补数、因子和基础组件 |
| 学会查接口和字段 | [API 总览](docs/api-reference.md) / [数据字典](docs/data-dictionary.md) | 知道页面读哪个接口、字段来自哪里 |
| 学会 Skills | [Skills 编写与迭代教程](docs/learning/07-skills-authoring.md) | 知道如何修改、发布、打包和验证 skill |
| 看后续优先级 | [持续完善路线图](docs/ROADMAP.md) | 知道哪些事该先做，哪些事暂时不该做 |

文档维护也算项目能力的一部分。改代码时如果改变了页面入口、组件职责、数据字段、环境变量、SQL 或 skill 行为，请同步更新对应文档；具体写法见 [文档写作风格指南](docs/documentation-style-guide.md)。

## 本地数据与 Git 边界

以下内容默认不进入 Git：`.env`、`.env.local`、`.next/`、`node_modules/`、`data/`、`tmp/`、`public/uploads/`、`public/generated/`、`services/market-data/.venv/`、`services/**/.ruff_cache/`。

首次使用需要的 PostgreSQL / TimescaleDB SQL 放在 `sqls/`。生成工作空间源码和大产物放在 `data/projects/`，平台数据库只保存索引、状态和摘要。

## 本地可观测性

`npm run obs:up` 会拉起 Loki、Grafana 和 Grafana Alloy。Alloy 会采集 Docker 容器日志，并读取 `tmp/runtime/*.log`、评测队列日志和 Next.js dev 日志写入 Loki。Loki 容器端口 `3100` 默认映射到宿主机 `33100`；Grafana 容器端口 `3000` 默认映射到 `http://localhost:33012`，账号密码来自 `.env`。运行治理中心的“日志”页会优先展示 Loki 集中日志，同时保留本地文件日志兜底。

## 前端启动模式

主前端不再接入 `next-rspack` 或自定义 bundler 切换逻辑。`npm run dev` 直接启动 `next dev`，Next.js 16 在开发态使用自己的默认链路；项目侧只保留启动前后的工程保护：

- `scripts/dev/setup-env.js`：确保 `.env`、`.env.local`、`data/projects/` 存在，并写入主前端端口、应用 URL 和预览端口池。
- `scripts/dev/run-web.js`：生成稳定 Tailwind CSS，探测降级组件恢复情况，必要时同步 Prisma schema，清理过期 Next dev lock/cache，再启动 `npx next dev`。
- `scripts/build/run-build.js`：生产构建入口；默认跳过耗时的 per-route output tracing，需要桌面或 standalone 产物时使用 `npm run build:standalone`。

## 降级模式

`.env` 中的 `QUANTPILOT_DEGRADATION_MODE` 控制组件缺失时的行为：`auto` 适合本地开发，可选组件缺失时自动降级；`strict` 适合 CI/生产，必需组件缺失会失败；`offline` 会跳过多项可选外部组件探测，优先使用本地兜底。只关闭一个组件应使用其 `ENABLED=0`，例如不启用 Memory 使用 `QUANTPILOT_MEMORY_ENABLED=0`，不要为了关闭单一组件切到 `offline`。完整开关见 [配置指南](docs/configuration.md)。

## 来源与许可

项目参考并保留 [tiammomo/QuantPilot](https://github.com/tiammomo/QuantPilot) 的源代码和提交历史，沿用仓库中的 [MIT 许可证](LICENSE) 与原作者版权声明。页面品牌为 SignalForge，不表示上游架构由我从零设计。
