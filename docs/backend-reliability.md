# 后端可靠性与真实行情验收

当前仍使用 Python/FastAPI、PostgreSQL/TimescaleDB 与 Redis。数据库承担任务和研究状态，Redis 是可失效的查询缓存，不承担任务完成事实。

## 实现与核查入口

| 机制 | 实现及验证 |
| --- | --- |
| 任务幂等 | [dispatch store](../src/lib/services/pi-agent-generation-dispatch-store.ts)先锁项目行，再查任务；不存在的任务不能靠行锁串行化。同一请求须保持指令、执行参数、模型、CLI 和重试上限一致。任务和 Outbox 同事务写入。 |
| 接管与并发 | 过期租约经恢复流程重试，新 owner 获得更高 fencing token；旧 owner 的心跳及完成被拒绝。恢复要求重新规划，不承诺从任意工具指令断点继续。[真实 PostgreSQL 测试](../src/lib/services/pi-agent-dispatch-reliability.integration.test.ts)覆盖并发、冲突与接管。 |
| 缓存恢复 | [RedisJsonCache](../services/market-data/src/quantpilot_market_data/cache.py)连接错误后冷却五秒重试；无法序列化的单条结果不会使健康连接永久失效。 |
| 刷新竞态 | 刷新前写唯一 generation，Lua 在写缓存时检查 generation；只有最近发起的刷新可发布。删除缓存同时删除 generation；损坏 JSON 使用比较后删除，避免删除并发替换后的正常值。此机制用于分时缓存。 |
| 事务与索引 | [行情 upsert](../services/market-data/src/quantpilot_market_data/repositories/upserts.py)把行情和同步状态写入同一事务。验收在行情写入后注入失败并核对回滚；保存按证券、周期、复权和时间排序的 EXPLAIN JSON，不据小样本声称查询性能提升。 |
| 时钟一致性 | 财报版本的观测时间及查询截止时点校验均以数据库时钟为准，避免应用时钟漂移拒绝刚保存的快照。 |

## 在隔离服务中复跑

仓库根目录执行：

```bash
docker compose -f deploy/compose.reliability.yml up -d --wait
export MARKET_TEST_DATABASE_URL=postgresql://signalforge_test:signalforge_test_local@127.0.0.1:35434/signalforge_reliability_test
export MARKET_TEST_REDIS_URL=redis://127.0.0.1:36381/0
uv run --project services/market-data pytest -q services/market-data/tests
uv run --extra baostock --project services/market-data python scripts/checks/verify-research-backend.py --output tmp/research-acceptance-unique
```

输出目录必须未存在。默认从东方财富获取三个标的的 250 根日线，截止到 2025-12-31；失败时尝试 Baostock，其资产支持范围可能不同。实际起止日期与数据源随产物记录。调用真实供应商不会使用固定行情替身。

脚本验证 TimescaleDB、真实行情入库及故障回滚、本地行情 HTTP 回测、独立账本和离线复算、Redis 往返，保存行情、回测响应、查询计划及报告。模型凭据缺失单独记录为 blocked；即使简单模型探测可达，完整 Agent/浏览器交付仍需另行运行。

任务集成使用另一个空数据库，避免市场数据回归自建表与行情初始化表冲突：

```bash
docker compose -f deploy/compose.reliability.yml exec -T timescaledb createdb -U signalforge_test signalforge_dispatch_test
export PI_AGENT_TEST_DATABASE_URL=postgresql://signalforge_test:signalforge_test_local@127.0.0.1:35434/signalforge_dispatch_test
npm run test:pi-agent:postgres
```

`createdb` 只需首次运行。集成入口自动应用 Prisma 版本迁移。PowerShell 中改用 `$env:变量名='值'`；原生 Windows 上 psycopg 异步连接需要 SelectorEventLoop；市场服务 CLI 与验收脚本已显式选择兼容循环。pytest 运行器仍需兼容的事件循环，Linux/WSL 可直接使用上述命令。

此 Compose 项目使用独立端口和 tmpfs，凭据仅用于隔离测试；停止后数据不保留。先保存所需证据，再清理该项目：

```bash
docker compose -f deploy/compose.reliability.yml down
```

数值回放需要与产物匹配的 Python、Pydantic、Decimal 设置和引擎源文件；哈希证明内部一致性，不是供应商签名或策略有效性的证明。当前仍不提供实盘交易与完整交易约束模拟。
