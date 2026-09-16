"use client";

import Link from "next/link";
import { Activity, CheckCircle2, Clipboard, Database, ExternalLink, RefreshCw, Server, XCircle } from 'lucide-react';

interface InfrastructureHealth {
  provider: string;
  databaseUrl: string;
  connected: boolean;
  timescale: { enabled: boolean; version: string | null };
  quantSchema: { tables: string[] };
  docker: {
    available: boolean;
    running: boolean;
    service: { name: string; state: string; status: string; image: string } | null;
    error?: string;
  };
  commands: Record<string, string>;
}

interface InfrastructureTabProps {
  infrastructure: InfrastructureHealth | null;
  infrastructureError: string | null;
  infrastructureLoading: boolean;
  onRefresh: () => void;
  onCopyCommand: (command: string) => void;
}

function InfrastructureTab({
  infrastructure,
  infrastructureError,
  infrastructureLoading,
  onRefresh,
  onCopyCommand,
}: InfrastructureTabProps) {
  const commands = infrastructure?.commands ?? {
    start: "npm run db:up",
    sync: "npm run prisma:deploy",
    inspect: "npm run db:doctor",
    psql: "npm run db:psql",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Activity className="h-4 w-4" /></span>
            <div>
              <h3 className="text-lg font-semibold text-foreground">基础组件配置</h3>
              <p className="mt-1 text-sm text-muted-foreground">
            查看本地 Docker 数据库连接与时序扩展状态。
              </p>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={infrastructureLoading}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border/70 bg-background px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary/35 hover:bg-primary/5 disabled:opacity-50"
        >
          <RefreshCw className={infrastructureLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          {infrastructureLoading ? "检查中..." : "刷新状态"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2 text-xs font-semibold text-muted-foreground">
            <span className="flex items-center gap-2"><Database className="h-4 w-4 text-primary" />主业务库</span>
            {infrastructure?.connected ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> : <XCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
          </div>
          <p className="mt-3 text-lg font-semibold text-foreground">
            {infrastructure?.provider === "postgresql"
              ? "PostgreSQL"
              : infrastructure?.provider ?? "未连接"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {infrastructure?.connected ? "Prisma schema 可访问" : "等待连接"}
          </p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2 text-xs font-semibold text-muted-foreground">
            <span className="flex items-center gap-2"><Server className="h-4 w-4 text-primary" />时序扩展</span>
            {infrastructure?.timescale.enabled ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> : <XCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
          </div>
          <p className="mt-3 text-lg font-semibold text-foreground">
            {infrastructure?.timescale.enabled ? "TimescaleDB" : "未启用"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {infrastructure?.timescale.version
              ? `版本 ${infrastructure.timescale.version}`
              : "用于股票 K 线、因子和信号"}
          </p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2 text-xs font-semibold text-muted-foreground"><span className="flex items-center gap-2"><Server className="h-4 w-4 text-primary" />Docker 服务</span>{infrastructure?.docker.running ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> : <XCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />}</div>
          <p className="mt-3 text-lg font-semibold text-foreground">
            {infrastructure?.docker.running ? "运行中" : "未运行"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {infrastructure?.docker.service?.status ?? "timescaledb compose 服务"}
          </p>
        </div>
      </div>

      {infrastructureError && (
        <div role="status" className="flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {infrastructureError}
        </div>
      )}

      <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
        <h4 className="text-sm font-semibold text-foreground">连接信息</h4>
        <div className="mt-4 space-y-3">
          <div className="rounded-xl bg-muted/40 p-3">
            <p className="text-xs font-semibold text-muted-foreground">DATABASE_URL</p>
            <p className="mt-1 break-all font-mono text-sm text-foreground">
              {infrastructure?.databaseUrl || "未配置"}
            </p>
          </div>
          <div className="rounded-xl bg-muted/40 p-3">
            <p className="text-xs font-semibold text-muted-foreground">量化时序表</p>
            <p className="mt-1 text-sm text-foreground">
              {infrastructure?.quantSchema.tables.length
                ? infrastructure.quantSchema.tables.map((t) => `quant.${t}`).join("、")
                : "尚未初始化"}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border/70 bg-muted/25 p-5">
        <h4 className="text-sm font-semibold text-foreground">本地运维命令</h4>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {Object.entries(commands).map(([key, command]) => (
            <div
              key={key}
              className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card px-3 py-2"
            >
              <code className="break-all text-sm text-foreground">{command}</code>
              <button
                type="button"
                onClick={() => onCopyCommand(command)}
                aria-label={`复制命令 ${command}`}
                title="复制命令"
                className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border/70 bg-background px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/35 hover:bg-primary/5 hover:text-primary"
              >
                <Clipboard className="h-3.5 w-3.5" />
                复制
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
        <h4 className="text-sm font-semibold text-foreground">全部组件状态</h4>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Redis 缓存、ClickHouse 分析和日志组件的运行状态、健康检查与故障信息统一在运行中心查看。
        </p>
        <Link href="/ops-platform" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
          打开运行中心 <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

export { InfrastructureTab };
export type { InfrastructureTabProps, InfrastructureHealth };
