# QuantPilot 文档总览

这个目录保存 QuantPilot 的项目知识。根目录 README 只做入口，长期规则、架构设计、教学材料、数据源口径和排障经验都应沉淀到这里。

## 先读哪几篇

| 目标 | 文档 |
| --- | --- |
| 想快速跑起来 | [教学 01：本地启动与健康检查](learning/01-quick-start.md) |
| 想理解生成链路 | [教学 02：AI 工作空间生成链路](learning/02-ai-workspace-generation.md) |
| 想理解数据和策略平台 | [教学 03：市场数据与策略平台](learning/03-market-data-and-strategy-platform.md) |
| 想优化生成页面 | [教学 04：Skills 与可视化看板](learning/04-skills-and-visual-dashboard.md) |
| 想做评测和运维 | [教学 05：评测、运维与质量门](learning/05-evaluation-and-operations.md) |
| 想参与开发 | [教学 06：开发者协作手册](learning/06-developer-playbook.md) |

## 知识地图

| 模块 | 文档 | 关注点 |
| --- | --- | --- |
| 总体架构 | [架构总览](architecture.md) | 主链路、运行时、数据层、控制台和质量门 |
| 项目结构 | [项目结构与分层边界](project-structure.md) | 前端、后端、量化领域层、脚本和生成工作空间边界 |
| 基础设施 | [基础设施配置](infrastructure.md) | PostgreSQL、TimescaleDB、Redis、Loki/Grafana/Alloy、SQL 初始化和降级模式 |
| 行情数据 | [行情数据源采集知识库](market-data-source-knowledge.md) | 东方财富、Baostock、AKShare、字段口径和补数规则 |
| 工作空间契约 | [生成工作空间契约](generated-workspace-contract.md) | run plan、数据文件、证据、验证、视觉检查和修复计划 |
| Skills | [Skills 治理规范](skills-governance.md) | skill 元数据、版本、发布、回滚和锁文件 |
| 评测 | [Agent 评测指南](evals-guide.md) | 用例、评测集、评测器、队列、运行记录和 CI 门禁 |
| 本地产物 | [本地产物与生成文件边界](local-generated-files.md) | 哪些文件可提交、哪些文件只保留本地 |
| 排障 | [故障排查](troubleshooting.md) | 端口、数据库、生成工作空间、验证和常见失败 |
| 市场数据服务 | [市场数据服务 README](../services/market-data/README.md) | FastAPI 接口、provider、补数端点和后端开发 |

## 当前能力分层

```mermaid
flowchart TB
  U[用户问题 / 截图] --> W[Next.js AI 工作台]
  W --> R[Agent Runtime]
  R --> SK[QuantPilot Skills]
  W --> MD[FastAPI 市场数据服务]
  MD --> PG[(PostgreSQL)]
  MD --> TS[(TimescaleDB)]
  MD --> RD[(Redis)]
  OP --> LK[(Loki / Grafana / Alloy)]
  R --> WS[data/projects 工作空间]
  WS --> V[预览与自动验证]
  W --> SP[策略平台]
  W --> DP[数据平台]
  W --> OP[运维平台]
  W --> EP[评测平台]
```

## 文档维护规则

- README 只保留定位、启动和导航；复杂知识放到 `docs/`。
- 业务规则先写到对应专题文档，再在教学文档里用步骤串起来。
- 页面截图放在 `docs/learning/assets/`，命名使用页面或流程含义，例如 `strategy-platform.png`。
- 截图前需要确认页面没有 Next 错误覆盖层、验证失败页、明显横向溢出或加载空白。
- 真实密钥、个人路径、未脱敏日志不要写入文档。
- `data/`、`tmp/`、`.next/`、虚拟环境和生成项目大产物不进入 Git。
