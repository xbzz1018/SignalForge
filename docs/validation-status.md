# 验证记录与当前边界

[仓库首页](../README.md) · [项目案例](project-case.md) · [评测指南](evals-guide.md)

记录日期：2026-11-16。以下区分本地代码检查、确定性合同和真实模型交付；GitHub CI 以[对应提交的运行结果](https://github.com/xbzz1018/SignalForge/actions/workflows/quality.yml)为准。

## 当前验收结果

| 检查 | 结果与范围 |
| --- | --- |
| TypeScript 完整回归 | Linux 下 229 文件、1489 项通过；5 文件、30 项专用环境测试跳过 |
| Python 完整回归 | 269 通过、0 跳过，含隔离 PostgreSQL/TimescaleDB 与 Redis 集成；2 项依赖提示 |
| 静态检查与构建 | TypeScript、Ruff、Next.js 生产构建通过；ESLint 0 错误、2 项既有导航提示 |
| Playwright 页面合同 | 桌面及移动端 18 项通过，使用受控数据，不算真实模型成绩 |
| 实际浏览器检查 | 57 项通过：登录退出、项目 CRUD、20 个双端页面、模型语义解析及 17 组非法请求 |
| 真实行情 HTTP | 9 项通过：ETF 历史行情、均线回测与非法参数拒绝 |
| PostgreSQL 任务集成 | 29 项通过：并发首次入队、幂等冲突、失联接管、迟到心跳和结果拒绝、Outbox 顺序 |
| 真实行情与存储 | 股票 600519、ETF 510300、指数 000300 各 250 根行情；入库、故障回滚、账本核对、离线复算与 Redis 往返通过 |

摘要见 [基础前后端验收](evidence/20261116-basic-fullstack.json)与[后端可靠性验收](evidence/20261116-backend-reliability.json)。两份摘要保留验收时的源码身份、未提交状态和原始报告哈希；后续提交不改写这些历史字段。原始日志、截图和隔离数据库快照保留在本机 `tmp/`，密钥不进入证据或仓库。

## 一个真实模型交付样本

`index-technical-hs300` 使用官方模型 API，经正式 `/act`、PI Agent 生成、构建、数据契约、双端视觉检查和 Mission accepted receipt 完成交付。

| 项目 | 记录 |
| --- | --- |
| 模型配置 | DeepSeek / `deepseek-v4-flash` |
| 执行 | 3 轮、44.021 秒、0 异常工具失败、0 修复轮次 |
| 用量 | 输入 27964、输出 3354 Tokens；cache-miss 输入 11068 |
| 隔离 | WSL2 / Linux namespace，未允许无沙箱生成执行 |
| 范围 | 1 个样本；未执行完整发布回归，不推导长期成功率 |

此前两次尝试仍保留：ETF 页面因图标 404 被拒绝；修复图标后的指数任务通过标准模板交付，但因没有进入模型生成路径被严格模型门禁拒绝。显式使用已有的 `QUANTPILOT_EVAL_FORCE_MODEL_AGENT=1` 后才得到上述模型样本，未放宽条件或把模板算作模型成绩。

本次也修复了 Windows 行情服务事件循环、Skills 源码查看权限链路、策略和报告的错误 JSON 处理。该模型报告早于最后一处无关的报告字段校验，摘要保留各自构建身份。品牌文案和文档整理后的检查另行记录，不据此声称重跑了模型样本。

品牌与文档整理后，完整 TypeScript 回归、生产构建、Skills 完整性及双端页面实查通过；范围与日志哈希见[展示更新验收](evidence/20261116-project-showcase.json)。

## 截图来源

首页仅展示该通过任务的 K 线与风险摘要区域，保留实际回撤和高风险结论；没有修改页面文字或状态。[裁切坐标、原图及输出哈希](evidence/20261116-showcase.json)可用于核对。截图展示界面，计算正确性另由业务测试核查。

首页另展示 Skills 市场总览。该图来自已有生产构建的独立 UI 环境，页面 HTTP 200、无脚本错误、资源失败或横向溢出；没有调用模型，未启用数据库与行情服务。技能就绪度表示注册表及技能包状态，不表示研究成功率，也不据此验证发布或持久化链路。[截图来源与检查范围](evidence/20261116-readme-gallery.json)保留裁切及哈希记录。

旧教学截图中的失败列表、重复任务及过时执行器已撤下展示。2026-09-15 的历史研究图来源仍保存在[历史摘要](evidence/20260915-e2e-summary.json)，不与新样本合并统计。

## 当前边界

| 范围 | 实现与限制 |
| --- | --- |
| 对话回测 | 单标的简单均线交叉、做多或空仓；自定义参数及区间须通过冻结合同校验 |
| 成交与收益 | 下一根开盘、费用及固定滑点进入账本；尚不模拟完整停牌、涨跌停、容量及退市约束 |
| 数据与复算 | 保存行情快照、参数与引擎身份；哈希与离线复算不证明供应商数据真实性或策略有效性 |
| 中断恢复 | 真实数据库覆盖接管、取消及迟到结果；恢复需要重新规划，不支持任意工具断点续跑 |
| 生成隔离 | 完整 build/preview 在 Linux/WSL2 验收，Windows 原生执行有支持边界 |
| 外部服务 | 本轮未验收生产 Skills 编辑/发布及可选 Memory、Knowledge、ModelPort 和集中日志联调 |
| 交易 | 无券商接入、实盘下单或自动交易 |

计算口径见[研究正确性](research-correctness.md)，实现落点见[能力对应表](resume-implementation-map.md)，集成复跑见[后端可靠性](backend-reliability.md)。

## 依赖复查

2026-11-16，远端 CI 报告 Soup Sieve 2.9 的四项公告，仅将该传递依赖更新至 4.1.1。全部可选数据源的哈希锁定生产审计通过；更新后的本地后端回归为 261 通过、8 项集成测试跳过。[审计摘要](evidence/20261116-dependency-audit.json)保留范围和日志哈希，完整服务集成另以对应提交 CI 为准。

## 验证入口

```bash
npm run lint
npm run type-check
npm test
npm run build
npm run test:e2e
npm run benchmark:quant:contract
```

真实模型评测使用 `npm run benchmark:quant:e2e -- --model deepseek-v4-flash`，需要有效凭据并消耗服务商额度。固定用例、数据和预算后保留所有失败；不要用合同测试替代模型验收。详细配置见[评测指南](evals-guide.md)。

## 历史记录

<details>
<summary>2026-09-15 的有限模型批次</summary>

5 次运行中 3 次通过、2 次失败；模型配置为 `deepseek-v4-flash`，并发 1，cache-miss 输入预算 24000。

| 场景 | 结果 | 耗时 | 记录 |
| --- | --- | ---: | --- |
| 茅台基本面 | PASS | 37.351 秒 | 构建与预览通过 |
| 沪深 300 趋势 | PASS | 35.920 秒 | 构建与预览通过 |
| 510300 均线回测 | PASS | 37.792 秒 | 实验与看板交付通过 |
| 510300 均线回测 | FAIL | 48.643 秒 | `SEMANTIC_TARGET_UNSAFE`，严格门禁拒绝 |
| 510300 均线回测 | FAIL | 42.462 秒 | Provider JSON 截断，验收失败 |

[历史摘要](evidence/20260915-e2e-summary.json)保留本地 dirty build 身份及原报告哈希。60% 只是这 5 次的样本比例，不表示当前版本成功率。

</details>

<details>
<summary>依赖维护记录</summary>

2026-11-04 的维护记录包含前后端生产依赖更新和审计：当时 npm 生产依赖审计为 0 项，后端哈希锁定依赖未发现已知漏洞；全 npm 审计保留 16 项中等级别开发工具链报告。公告会变化，此记录不代表后续时点的审计结论，更新后以实际审计和 Quality CI 为准。

</details>
