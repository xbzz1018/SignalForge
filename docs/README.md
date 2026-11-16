# SignalForge 文档索引

了解项目先读[项目案例](project-case.md)，运行项目看[本地运行](quick-start.md)，判断当前完成程度看[验证记录](validation-status.md)。

## 运行与维护

| 文档 | 内容 |
| --- | --- |
| [本地运行](quick-start.md) / [配置指南](configuration.md) | 依赖、启动、模型选择与可选组件 |
| [模型接入](model-providers.md) / [基础设施](infrastructure.md) | Provider、数据库、缓存和服务端口 |
| [认证与访问治理](authentication.md) | 登录、角色、项目权限与用量配额 |
| [运行手册](operations-runbook.md) / [故障排查](troubleshooting.md) | 补数、长任务、缓存及失败定位 |
| [生产发布](release-runbook.md) / [数据生命周期](data-lifecycle.md) | 发布、备份、恢复和清理边界 |
| [本地产物](local-generated-files.md) | 生成文件与 Git 提交范围 |

## 架构与实现

| 文档 | 内容 |
| --- | --- |
| [架构总览](architecture.md) / [项目结构](project-structure.md) | 主链路、运行进程与代码分层 |
| [模块边界](module-boundaries.md) / [内部组件](internal-components.md) | 依赖约束、组件职责 |
| [PI Agent 集成](pi-agent-migration.md) / [PI Agent 架构](pi-agent.md) | 工具循环、上下文、预算与执行治理 |
| [Data Agent 合同](data-agent-architecture.md) | Profile、Domain Pack 与任务边界 |
| [后端能力架构](backend-capability-architecture.md) / [后端可靠性](backend-reliability.md) | 数据服务分层、事务、幂等、缓存与恢复 |
| [API 总览](api-reference.md) / [数据字典](data-dictionary.md) | 接口与数据库字段 |
| [工作空间契约](generated-workspace-contract.md) | 产物、证据、验证和修复要求 |
| [Skills 治理](skills-governance.md) | 元数据、版本、打包与回滚 |

## 投研与质量

| 文档 | 内容 |
| --- | --- |
| [行情数据源](market-data-source-knowledge.md) | 来源、字段口径与补数规则 |
| [策略平台](strategy-platform-guide.md) | 股票池、ETF/指数池、策略与因子 |
| [研究正确性](research-correctness.md) | 参数冻结、成交时点、费用和指标计算 |
| [投研报告](research-automation-guide.md) | 观察池、报告库与日报任务 |
| [运行治理](ops-platform-guide.md) | 工作空间健康、检查结果与日志 |
| [评测指南](evals-guide.md) / [验证记录](validation-status.md) | 合同测试、真实模型验收与限制 |
| [能力对应表](resume-implementation-map.md) / [路线图](ROADMAP.md) | 实现落点与未完成范围 |

## 可选接入与开发资料

- [用户记忆](user-memory-integration.md)、[知识平台](knowledge-platform-integration.md)、[联合上下文](context-composition.md)：可选服务的接入、隔离与归因。
- [开发阅读路线](learning/README.md)：启动、数据、Agent、Skills 与评测的分步说明。
- [文档约定](documentation-style-guide.md)：文档分工、截图来源和维护规则。
