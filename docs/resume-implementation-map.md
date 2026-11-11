# 项目能力与实现对应

SignalForge 的原版实现由 Python/FastAPI 市场数据服务和 TypeScript/Next.js 工作台组成。本文用于核对项目介绍与代码能力，不提供未经测量的性能或成功率。

| 能力 | 实现入口 | 验证入口与边界 |
| --- | --- | --- |
| Agent 与 Skills 编排 | [PI Agent 宿主](../src/lib/services/cli/pi-agent.ts)、[阶段及预算](../src/lib/agent/core/phase-graph.ts)、[Skills 编译与安装](../src/lib/agent/skills/compiler.ts)、[失败项修复范围](../src/lib/quant/validation/repair.ts) | 按数据准备、工作空间生成、失败修复阶段选择 Skills；有轮次、工具与 Token 预算。标准且数据就绪的看板可走确定性编译，不是每一步都调用模型。 |
| 行情数据服务 | [东方财富](../services/market-data/src/quantpilot_market_data/providers/eastmoney.py)、[Baostock](../services/market-data/src/quantpilot_market_data/providers/baostock.py)、[本地行情与覆盖/时效检查](../services/market-data/src/quantpilot_market_data/services/kline_gateway.py)、[补数任务](../services/market-data/src/quantpilot_market_data/services/ingestion_jobs.py)、[分时缓存](../services/market-data/src/quantpilot_market_data/services/quotes.py) | TimescaleDB 读取历史行情，Redis 缓存分时查询；供应商有各自的资产、周期及复权支持范围。缓存回归使用替身，不表示本次已完成真实供应商及 Redis 联调。 |
| 策略回测与追溯 | [请求参数合同](../src/lib/domains/finance/backtest-request.ts)、[回测计算](../services/market-data/src/quantpilot_market_data/backtest.py)、[实验捕获与哈希](../services/market-data/src/quantpilot_market_data/backtest_experiments.py)、[离线复算](../services/market-data/src/quantpilot_market_data/replay_backtest.py) | [pytest 回测正确性](../services/market-data/tests/test_backtest_correctness.py)与[路由参数贯通](../services/market-data/tests/test_backtest_routes.py)。对话回测明确支持简单均线交叉；后端另有登记策略。复算要求匹配的实现与运行时。 |
| 产物验证与页面回归 | [产物契约](../src/lib/quant/artifact-contracts.ts)、[交付验证](../src/lib/quant/validation.ts)、[预览页面回归](../tests/e2e/chat-preview.spec.ts)、[编辑流程回归](../tests/e2e/chat-file-editor.spec.ts) | 检查数据、构建及预览等验收项。pytest 验证回测计算，Playwright 验证页面流程；浏览器合同使用受控接口，不等于任意真实模型任务已通过。 |
| 图表与报告 | [看板生成 Skill](../.pi/skills/dashboard-visualization/SKILL.md)、[结构化研究报告](../src/lib/quant/research-reports.ts) | 支持研究看板及结构化报告。报告模块有独立的数据采样和生成入口，不应描述为任意对话都自动产出任意格式报告。 |

历史行情表及 hypertable 初始化见 [TimescaleDB SQL](../sqls/001-quant-timeseries.sql)，项目、任务与报告状态见 [Prisma 模型](../prisma/schema.prisma)。

回测采用单标的、做多/空仓、收盘信号与成交的简化模型，保存费用与行情快照，未模拟滑点、停牌和涨跌停成交约束。它适合表述为研究和结果核查能力；不宜扩展为实盘交易、完整交易撮合或生产级金融数据平台。计算口径见[研究请求与回测结果校验](research-correctness.md)，实际门禁见[验证记录](validation-status.md)。
