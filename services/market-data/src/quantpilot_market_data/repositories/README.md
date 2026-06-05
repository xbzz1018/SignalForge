# Repository Boundary

`repositories/` 是 TimescaleDB/PostgreSQL 持久化边界。

职责：

- 管理 SQL、连接、事务、批量写入、分页查询和数据库错误转换。
- 把表结构和查询优化细节封装在 repository 内。
- 为 service 层提供稳定函数，例如 bars、universes、factors、ingestion、sector_flow 和 foundation。

不放在这里：

- HTTP 状态码和 FastAPI 异常。
- 外部数据源 client。
- Redis cache-aside 策略。
- 页面展示字段拼装。

迁移策略：先通过领域 repository facade 切断 service 对 `database.py` 的直接依赖，再从 `database.py` 中按领域抽出低风险查询，最后逐步移动批量写入和任务状态更新。

当前已落地：

- `analytics.py`
- `foundation.py`
- `ingestion.py`
- `research.py`
