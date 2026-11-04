# 本地运行 SignalForge

[仓库首页](../README.md) · [配置指南](configuration.md) · [故障排查](troubleshooting.md)

以下是已记录的 WSL2 开发拓扑。生成项目的 build/preview 依赖 Linux namespace 隔离，需要在 Linux 中运行。

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

`npm ci` 的 postinstall 创建缺失的 `.env`、`.env.local` 和本地目录。数据库名称、环境变量和 Python 包仍使用内部名称 `quantpilot`。

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

默认均线回测可用 `20/60`、日线、前复权、5 bps 作为研究例子。自定义日期、窗口与费用的贯通仍需按[已知限制](validation-status.md#待完善项)核查，不能仅凭页面生成成功确认参数已生效。

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

代码验证命令与真实模型评测的边界见[验证记录](validation-status.md)。开发产生的 `.env.local`、数据库卷、`data/projects/`、`tmp/`、`.next/` 和虚拟环境保留在本地。
