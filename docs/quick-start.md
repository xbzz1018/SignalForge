# 本地运行 SignalForge

[仓库首页](../README.md) · [配置指南](configuration.md) · [故障排查](troubleshooting.md)

使用 Ubuntu / WSL2 运行 Web、行情服务和后台任务，Docker 提供数据库与缓存。生成项目的构建与预览依赖 Linux namespace 隔离。

## 准备环境

- Ubuntu 22.04 / WSL2，Docker Desktop 开启对应发行版的 WSL integration。
- Node.js 24、npm、Python 3.14 与 uv。
- 可用的模型服务端凭据。下面以仓库配置中已有的 DeepSeek 官方直连 profile 为例。

```bash
git clone https://github.com/xbzz1018/SignalForge.git
cd SignalForge
npm ci
uv sync --project services/market-data --extra baostock --extra akshare --locked
```

`npm ci` 的 postinstall 创建缺失的 `.env`、`.env.local` 和本地目录。

## 配置与启动

在被 Git 忽略的 `.env.local` 中填写自己的服务端凭据与开关：

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

浏览器打开 `http://localhost:3000`；占用时以启动器输出的端口为准。**在模型菜单中显式选择 `deepseek-v4-flash` 官方直连。** 填入 Key 不会改变 `config/llm.json` 中默认的本地 Qwen/ModelPort profile。

Memory、知识服务、ClickHouse 和 Loki/Grafana/Alloy 按需接入，详见[配置指南](configuration.md)。关闭可选服务时，诊断结果应显示 disabled 或 warning；数据库等必需服务失败时要先修复环境。

## 第一次研究

1. 在首页选研究能力，输入标的与目标，例如“分析沪深 300 近期趋势与回撤”。
2. 进入项目聊天查看计划、工具事件和生成进度。
3. 打开预览，核对标的、数据时点和来源；检查构建与 Mission 验收结果。

均线回测可以从“用 20/60 日均线回测 510300”开始，补充起止日期、初始资金、费用与滑点。计算时固定本次参数，输出净值、回撤和交易明细；参数与复跑方法见[策略平台](strategy-platform-guide.md)。

| 页面 | 用途 |
| --- | --- |
| `/`、项目聊天 | 发起研究、追问、查看文件与预览 |
| `/strategy-platform` | 股票/ETF/指数池、K 线、数据覆盖、补数与回测 |
| `/research-reports` | 观察池、报告档案、主题与来源；通知支持 dry-run |
| `/skills`、`/business-knowledge` | Skills 版本治理、研究能力与交付约束 |
| `/eval-platform`、`/ops-platform` | 用例、评测、依赖诊断、Worker 和失败定位 |

## 检查运行状态

```bash
npm run doctor:full -- --model=deepseek-v4-flash
npm run check:market-freshness
```

页面缺数时，先区分行情服务未启动、本地行情过期和供应商不可达。常见处理入口见[运行手册](operations-runbook.md)。

研究项目保存在 `data/projects/`，包含对话、数据文件、页面源码与预览产物。
