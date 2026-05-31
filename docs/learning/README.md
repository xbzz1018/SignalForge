# QuantPilot 教学路径

这一组文档用于带新同学从“跑起来”到“能改、能评测、能优化生成页面”。它不是纯命令备忘录，而是偏教学材料：每篇会先解释基础概念，再说明 QuantPilot 为什么这样设计，最后给出操作步骤、检查方法和常见误区。

如果只想快速查命令，看根目录 README；如果想理解项目能力、模块边界和后续怎么扩展，应优先读这里。

## 课程列表

| 顺序 | 文档 | 学完以后应当能做什么 |
| --- | --- | --- |
| 1 | [本地启动与健康检查](01-quick-start.md) | 拉起数据库、后端、前端，并确认页面可用 |
| 2 | [AI 工作空间生成链路](02-ai-workspace-generation.md) | 理解用户问题如何变成可验证工作空间 |
| 3 | [市场数据与策略平台](03-market-data-and-strategy-platform.md) | 理解股票池、ETF/指数池、K 线、估值、板块资金和缓存 |
| 4 | [Skills 与可视化看板](04-skills-and-visual-dashboard.md) | 知道如何增强生成页面的审美、布局和自修复能力 |
| 5 | [评测、运维与质量门](05-evaluation-and-operations.md) | 会跑评测、看工作空间健康、定位验证失败 |
| 6 | [开发者协作手册](06-developer-playbook.md) | 知道代码该放哪里、怎么验证、哪些产物不要提交 |

## 截图索引

截图来自本地 `http://localhost:3000`，采集时已检查无错误覆盖层、无验证失败页、无横向溢出。

| 页面 | 截图 |
| --- | --- |
| 首页工作台 | [assets/home.png](assets/home.png) |
| 策略平台 | [assets/strategy-platform.png](assets/strategy-platform.png) |
| Skills 管理 | [assets/skills.png](assets/skills.png) |
| 评测平台 | [assets/eval-platform.png](assets/eval-platform.png) |
| 数据平台 | [assets/data-platform.png](assets/data-platform.png) |
| 运维平台 | [assets/ops-platform.png](assets/ops-platform.png) |

## 学习建议

- 先把 01 跑通，再读后续文档；没有可运行环境时，很多概念会变得抽象。
- 生成页面相关问题优先看 02 和 04。
- 数据缺失、K 线不完整、板块资金慢，优先看 03。
- “看板验证未通过”“产物契约不通过”“截图里有错误页”，优先看 05。
- 每篇文档中的“基础概念”都值得读。很多问题不是代码写错，而是没有理解数据源、缓存、验证、skill 或运行时的职责边界。
- 学习时建议同时打开页面和代码：页面负责建立直觉，代码负责确认真实实现。

## 课程写作规范

后续新增或更新 learning 文档时，尽量保持这个结构：

1. 先讲目标和读完后应掌握的能力。
2. 解释基础概念，避免只堆产品名和命令。
3. 讲清楚设计取舍，例如为什么使用 TimescaleDB、为什么需要 evidence、为什么要有降级模式。
4. 给可执行步骤和验证方式。
5. 列出常见误区和排障入口。

教学文档可以比 README 更啰嗦一点。README 负责让人快速启动，learning 负责让人真正理解。
