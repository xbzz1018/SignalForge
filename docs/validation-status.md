# 验证记录与当前边界

[仓库首页](../README.md) · [项目案例](project-case.md) · [评测体系](evals-guide.md)

本页区分代码检查、确定性合同与真实模型任务。更新日期：2026-11-04。本次 GitHub 展示调整不产生新的真实模型评测成绩。

## 可执行的验证入口

```bash
npm run lint
npm run type-check
npm test
npm run test:coverage
npm run build
npm run test:e2e
npm run benchmark:quant:contract
```

[Quality workflow](../.github/workflows/quality.yml)包含前后端检查、浏览器合同、确定性评测与 PostgreSQL fencing 集成。实际结论以[对应提交的 Actions 结果](https://github.com/xbzz1018/SignalForge/actions/workflows/quality.yml)为准。

确定性合同模式使用版本化数据与仓库模板；CI 对此路径显式启用无 namespace 执行，不代表真实模型生成代码的沙箱路径已经通过。真实生成仍应在受支持的 Linux 隔离环境验收。

真实模型 E2E 单独执行，会消耗服务商额度：

```bash
npm run benchmark:quant:e2e -- --model deepseek-v4-flash
```

固定用例、模型、数据快照和预算，保留原始报告、失败阶段、源码身份、Token 与成本。不同代码版本的成绩分别保存。

## 历史模型运行

2026-09-15 的有限批次运行 5 次：3 次通过、2 次失败。模型为配置中记录的 `deepseek-v4-flash`，并发 1，每次 cache-miss 输入预算 24,000；不对失败盲目重试。

| 次数 | 场景 | 结果 | 耗时 | 说明 |
| --- | --- | --- | ---: | --- |
| 1 | 茅台基本面看板 | PASS | 37.351 s | Mission、构建与预览通过 |
| 2 | 沪深 300 技术趋势 | PASS | 35.920 s | Mission、构建与预览通过 |
| 3 | 510300 均线回测 | PASS | 37.792 s | 实验与看板交付通过 |
| 4 | 510300 均线回测 | FAIL | 48.643 s | 出现 `SEMANTIC_TARGET_UNSAFE`；即使 Mission accepted，严格运行门禁仍判失败 |
| 5 | 510300 均线回测 | FAIL | 42.462 s | Provider 返回截断 JSON，验收阶段失败 |

公开摘要见 [20260915-e2e-summary.json](evidence/20260915-e2e-summary.json)。它从本地历史报告提取结果和配置，保留原报告 SHA256 与 build revision，移除了本机路径和调用标识；它不是完整原始日志或新的签名证明。

这批报告来自历史本地 dirty build，不等于当前 main 提交；60% 是 5 次有限样本比例。CI、回放、Mission accepted 都不能单独证明研究结论、收益或长期稳定性。

## 截图来源

[首页截图](learning/assets/research-dashboard.png)来自 2026-09-15 的独立 ETF 技术分析工作空间 `benchmark-etf-technical-300etf`，只裁切到页面上部，未改动页面内容。它与上表五次运行分别保存，不计入该批次的通过次数。原图文件名、摘要、尺寸和裁切范围保存在 [JSON 摘要](evidence/20260915-e2e-summary.json)的 `screenshot` 字段中。

它展示实际生成的界面，不作为指标计算正确性的验证。旧教学文档中的 QuantPilot 截图保留其历史上下文。

## 待完善项

2026-11-03 的源码审查在当前展示调整的基线中定位到以下问题。本次仅优化展示，未把这些项标记为已修复：

| 范围 | 当前问题 | 后续验收标准 |
| --- | --- | --- |
| 请求与执行参数 | 回测预取固定 20/60、daily/qfq、250 根、5 bps，自定义区间未贯通 | 请求、预取、计算和验收消费同一份严格参数合同；不支持的要求进入澄清 |
| 参数校验 | 通用引擎部分非法参数静默使用默认值 | 拒绝非法值与未知字段，保存实际生效参数 |
| 指标窗口 | 前端 `volatility20d` 使用全历史收益 | 最近 20 个收益、缺失/乱序/短样本有确定定义与回归 |
| 费用与收益 | 净值扣费与当期策略收益序列不一致 | 净收益连乘可还原最终净值，风险指标使用同一口径 |
| 年化周期 | 回测固定按 252 年化 | 限制为已正确支持的周期，或按频率明确实现并验证 |
| Agent 进展 | 指纹混入每次变化的调用身份，重复读取可能被当作新进展 | 按可信结果/内容版本判断，无进展时执行有界重规划或停止 |

关键代码：[预取](../src/lib/quant/data-prefetch/market.ts)、[前端指标](../src/lib/quant/data-prefetch/technical.ts)、[回测引擎](../services/market-data/src/quantpilot_market_data/backtest.py)、[PI Runtime](../src/lib/agent/pi/run-engine.ts)。

后续还应验证 Redis 历史截止参数的缓存隔离、Worker 中断恢复、取消与迟到结果竞态。Memory、ModelPort 本地模型和 Loki 各有独立服务验收条件；关闭可选组件的诊断通过不等于完整生产联调。
