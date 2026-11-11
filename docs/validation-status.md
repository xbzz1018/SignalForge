# 验证记录与当前边界

[仓库首页](../README.md) · [项目案例](project-case.md) · [评测体系](evals-guide.md)

本页区分代码检查、确定性合同与真实模型任务。更新日期：2026-11-11。本轮请求与计算修复不产生新的真实模型评测成绩。

## 依赖维护记录

2026-11-04，展示 PR 的 Quality CI 在前后端生产依赖审计处失败。维护更新将 Next.js 与 ESLint 配置锁定到 `16.4.5`、Better Auth 到 `1.7.16`、Zod 到 `4.6.7`、Sharp 到 `0.35.5`，并同步 Vitest/coverage `4.1.12` 及相关传递依赖；更新了过期的 brace-expansion 覆盖版本。后端仅更新 anyio `4.14.2`、certifi `2026.10.23`、soupsieve `2.9` 和 urllib3 `2.8.0`。

本地 `npm audit --omit=dev --audit-level=high` 为 0 项；后端包含全部可选提供商的哈希锁定依赖审计未发现已知漏洞。全 npm 审计仍有 16 项中等级别的开发工具链报告，根因是 minimatch；未用审计建议的强制替换修改工具链主版本。审计结果会随公告更新，后续仍需定期复查。

回归验收以本 PR 最新提交的 Quality CI 为准，包含类型、覆盖率、构建、浏览器合同、登录和 PostgreSQL fencing 检查；本节不代表新的真实模型评测或生产部署验收。

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

2026-11-03 的源码审查定位到请求、计算及进展判断问题。2026-11-11 合并远端已有修复与本地改进，当前实现及剩余边界如下。

| 范围 | 当前实现 | 验证及边界 |
| --- | --- | --- |
| 请求与执行参数 | 规划冻结均线窗口、周期、复权、日期、资金与费率；预取及最终数据验收核对同一合同 | 对话仅支持简单均线交叉；不支持或含糊的输入进入澄清；区间前行情仅用于指标预热 |
| 参数校验 | 拒绝非法、非有限、越界、未知及重复查询参数；实验保存实际默认值 | 后端 pytest 验证实际 HTTP 参数贯通及非法请求在取数前失败 |
| 指标窗口 | 最近 21 根有效日线产生 20 个收益；完整均线、区间收益和成交量窗口保留缺失位置；空样本风险值为 `null` | 前端排序有效日期，日期非法/重复时不输出 20 日波动率；后端回测拒绝乱序、重复或缺失收盘价 |
| 费用与收益 | 当期策略收益、风险序列与已平仓交易收益均包含手续费 | 离线用例核对收益与净值；仍不模拟滑点、停牌或成交约束 |
| 年化周期 | 日/周/月线分别使用 252/52/12；拒绝分钟线回测 | pytest 比较频率变化下的年化收益和波动率 |
| Agent 进展 | 规范工具输入与有效观察，宿主提供工作空间内容摘要；连续无进展时停止 | 脚本化 PI 工具循环覆盖重复读取、失败、同内容写入，以及真实内容变化后的终端提交 |

关键代码：[预取](../src/lib/quant/data-prefetch/market.ts)、[前端指标](../src/lib/quant/data-prefetch/technical.ts)、[回测引擎](../services/market-data/src/quantpilot_market_data/backtest.py)、[PI Runtime](../src/lib/agent/pi/run-engine.ts)。

分钟线 Redis 缓存已按 `end` 隔离；命中、强制刷新失败后的同查询回退与不同截止日期不串用，见 [缓存回归](../services/market-data/tests/test_quotes_service.py)。这使用内存缓存替身，真实 Redis 服务验收仍需单独执行。

本轮本地 Python 3.14 后端测试为 208 通过、4 跳过（未配置测试数据库的集成项）；Ruff、TypeScript、Skills 完整性及模块边界检查通过。ESLint 无错误，有两项既有导航警告。Windows 工作空间目录同步及目录符号链接仍有限制，完整前端、浏览器和数据库门禁以同一提交的 Linux Actions 为准。

计算用例见[前端窗口回归](../src/lib/quant/data-prefetch/technical.test.ts)、[回测正确性](../services/market-data/tests/test_backtest_correctness.py)及[离线回放](../services/market-data/tests/test_backtest_experiments.py)。确定性市场服务的回测夹具现在返回评估区间，并拒绝其固定结果不支持的参数，避免夹具被误认为通用计算引擎。详细计算口径见[请求与回测校验](research-correctness.md)，功能落点见[能力对应表](resume-implementation-map.md)。

后续还应验证 Worker 中断恢复、取消与迟到结果竞态。Memory、ModelPort 本地模型和 Loki 各有独立服务验收条件；关闭可选组件的诊断通过不等于完整生产联调。
