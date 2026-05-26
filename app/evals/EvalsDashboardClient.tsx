"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Clock3,
  Database,
  FileText,
  Gauge,
  Layers3,
  Loader2,
  Play,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Square,
  TriangleAlert,
  Wrench,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { QuantEvalDashboardData, QuantEvalQueueItem, QuantEvalRun, QuantEvalRuntimeOption } from '@/lib/quant/evals';

type Props = {
  data: QuantEvalDashboardData;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';

function formatDate(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(value: number) {
  if (!value) return '-';
  if (value < 1000) return `${value} ms`;
  if (value < 60_000) return `${(value / 1000).toFixed(1)} 秒`;
  return `${Math.round(value / 60_000)} 分钟`;
}

function statusBadge(passed: boolean) {
  return passed ? (
    <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
      <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
      通过
    </Badge>
  ) : (
    <Badge className="border-red-200 bg-red-50 text-red-700 hover:bg-red-50">
      <XCircle className="mr-1 h-3.5 w-3.5" />
      失败
    </Badge>
  );
}

function queueBadge(status: QuantEvalQueueItem['status']) {
  const config = {
    queued: 'border-blue-200 bg-blue-50 text-blue-700',
    running: 'border-amber-200 bg-amber-50 text-amber-700',
    passed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    failed: 'border-red-200 bg-red-50 text-red-700',
    cancelled: 'border-slate-200 bg-slate-50 text-slate-600',
  }[status];
  const label = {
    queued: '排队中',
    running: '运行中',
    passed: '已通过',
    failed: '已失败',
    cancelled: '已取消',
  }[status];
  return <Badge className={`${config} hover:${config}`}>{label}</Badge>;
}

function scoreClass(score: number) {
  if (score >= 90) return 'text-emerald-600';
  if (score >= 75) return 'text-amber-600';
  return 'text-red-600';
}

function getLatestRunDelta(runs: QuantEvalRun[]) {
  if (runs.length < 2) return null;
  const [latest, previous] = runs;
  return {
    passRate: latest.passRate - previous.passRate,
    score: latest.averageScore - previous.averageScore,
    failed: latest.failedCount - previous.failedCount,
  };
}

function hasActiveQueue(queue: QuantEvalQueueItem[]) {
  return queue.some((item) => item.status === 'queued' || item.status === 'running');
}

const CLI_LABELS: Record<string, string> = {
  claude: 'Claude Code',
  codex: 'Codex CLI',
};

const FALLBACK_RUNTIME: QuantEvalRuntimeOption = {
  cli: 'claude',
  label: 'Claude Code',
  defaultModel: 'MiniMax-M2.7',
  supportsReasoningEffort: false,
  models: [{ id: 'MiniMax-M2.7', name: 'MiniMax M2.7', description: null }],
};

const selectClassName =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

function getRuntimeOption(runtimeOptions: QuantEvalRuntimeOption[], cli: string) {
  return runtimeOptions.find((option) => option.cli === cli) ?? runtimeOptions[0] ?? FALLBACK_RUNTIME;
}

function getInitialRuntime(data: QuantEvalDashboardData) {
  return data.runtimeOptions.find((option) => option.cli === 'claude') ?? data.runtimeOptions[0] ?? FALLBACK_RUNTIME;
}

function getReasoningEffort(runtime: QuantEvalRuntimeOption, value: string | null | undefined) {
  return runtime.supportsReasoningEffort ? value || 'low' : '';
}

export default function EvalsDashboardClient({ data }: Props) {
  const [dashboard, setDashboard] = useState(data);
  const [caseKeyword, setCaseKeyword] = useState('');
  const [runKeyword, setRunKeyword] = useState('');
  const [selectedCase, setSelectedCase] = useState('all');
  const [limit, setLimit] = useState('all');
  const initialRuntime = getInitialRuntime(data);
  const initialScheduleRuntime = getRuntimeOption(data.runtimeOptions, data.schedule.cli || initialRuntime.cli);
  const [benchmarkCli, setBenchmarkCli] = useState(initialRuntime.cli);
  const [benchmarkModel, setBenchmarkModel] = useState(initialRuntime.defaultModel);
  const [benchmarkReasoningEffort, setBenchmarkReasoningEffort] = useState(getReasoningEffort(initialRuntime, 'low'));
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [scheduleEnabled, setScheduleEnabled] = useState(data.schedule.enabled);
  const [scheduleInterval, setScheduleInterval] = useState(String(data.schedule.intervalHours));
  const [scheduleCli, setScheduleCli] = useState(initialScheduleRuntime.cli);
  const [scheduleModel, setScheduleModel] = useState(data.schedule.model || initialScheduleRuntime.defaultModel);
  const [scheduleReasoningEffort, setScheduleReasoningEffort] = useState(
    getReasoningEffort(initialScheduleRuntime, data.schedule.reasoningEffort || 'low')
  );
  const [scheduleCase, setScheduleCase] = useState(data.schedule.selectedCases[0] ?? 'all');

  const latestRun = dashboard.latestRun;
  const delta = getLatestRunDelta(dashboard.runs);
  const activeQueue = hasActiveQueue(dashboard.queue);
  const runtimeOptions = dashboard.runtimeOptions.length ? dashboard.runtimeOptions : data.runtimeOptions.length ? data.runtimeOptions : [FALLBACK_RUNTIME];
  const benchmarkRuntime = getRuntimeOption(runtimeOptions, benchmarkCli);
  const benchmarkRuntimeSupportsReasoning = benchmarkRuntime.supportsReasoningEffort;
  const scheduleRuntime = getRuntimeOption(runtimeOptions, scheduleCli);
  const scheduleRuntimeSupportsReasoning = scheduleRuntime.supportsReasoningEffort;

  const updateBenchmarkCli = (cli: string) => {
    const runtime = getRuntimeOption(runtimeOptions, cli);
    setBenchmarkCli(cli);
    setBenchmarkModel(runtime.defaultModel);
    setBenchmarkReasoningEffort(getReasoningEffort(runtime, benchmarkReasoningEffort));
  };

  const updateScheduleCli = (cli: string) => {
    const runtime = getRuntimeOption(runtimeOptions, cli);
    setScheduleCli(cli);
    setScheduleModel(runtime.defaultModel);
    setScheduleReasoningEffort(getReasoningEffort(runtime, scheduleReasoningEffort));
  };

  const refreshDashboard = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch(`${API_BASE}/api/evals`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? '刷新评测后台失败');
      }
      setDashboard(payload.data);
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : String(error) });
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!activeQueue) return;
    const timer = window.setInterval(() => {
      void refreshDashboard();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [activeQueue]);

  const startBenchmark = async () => {
    setIsStarting(true);
    setToast(null);
    try {
      const response = await fetch(`${API_BASE}/api/evals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start-benchmark',
          cli: benchmarkCli,
          model: benchmarkModel || benchmarkRuntime.defaultModel,
          reasoningEffort: benchmarkRuntimeSupportsReasoning ? benchmarkReasoningEffort : undefined,
          selectedCases: selectedCase === 'all' ? [] : [selectedCase],
          limit: limit === 'all' ? null : Number(limit),
          keepProjects: false,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? '启动 benchmark 失败');
      }
      setToast({ type: 'success', message: '评测任务已进入队列。' });
      await refreshDashboard();
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : String(error) });
    } finally {
      setIsStarting(false);
    }
  };

  const cancelBenchmark = async (queueId: string) => {
    setToast(null);
    try {
      const response = await fetch(`${API_BASE}/api/evals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel-benchmark', queueId }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? '取消评测任务失败');
      }
      setToast({ type: 'success', message: '评测任务已取消。' });
      await refreshDashboard();
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : String(error) });
    }
  };

  const saveSchedule = async () => {
    setIsSavingSchedule(true);
    setToast(null);
    try {
      const intervalHours = Number(scheduleInterval);
      const response = await fetch(`${API_BASE}/api/evals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-schedule',
          enabled: scheduleEnabled,
          intervalHours,
          cli: scheduleCli,
          model: scheduleModel || scheduleRuntime.defaultModel,
          reasoningEffort: scheduleRuntimeSupportsReasoning ? scheduleReasoningEffort : undefined,
          selectedCases: scheduleCase === 'all' ? [] : [scheduleCase],
          limit: null,
          keepProjects: false,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? '保存定时回归配置失败');
      }
      setToast({ type: 'success', message: '定时回归配置已保存。' });
      await refreshDashboard();
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : String(error) });
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const checkScheduleNow = async () => {
    setToast(null);
    try {
      const response = await fetch(`${API_BASE}/api/evals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check-schedule' }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? '检查定时回归失败');
      }
      setToast({ type: 'success', message: payload.data.queued ? '已按定时配置加入评测队列。' : '当前未到定时触发时间。' });
      await refreshDashboard();
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : String(error) });
    }
  };

  const filteredCases = useMemo(() => {
    const keyword = caseKeyword.trim().toLowerCase();
    if (!keyword) return dashboard.cases;
    return dashboard.cases.filter((testCase) =>
      [
        testCase.id,
        testCase.name,
        testCase.question,
        testCase.capabilityLabel,
        testCase.typeLabel,
        ...testCase.expectedSymbols,
        ...testCase.tags,
      ]
        .join(' ')
        .toLowerCase()
        .includes(keyword)
    );
  }, [caseKeyword, dashboard.cases]);

  const filteredRuns = useMemo(() => {
    const keyword = runKeyword.trim().toLowerCase();
    if (!keyword) return dashboard.runs;
    return dashboard.runs.filter((run) =>
      [
        run.id,
        run.fileName,
        run.passed ? '通过' : '失败',
        run.metadata.runtime.cli,
        run.metadata.runtime.model,
        ...Object.keys(run.coverage.byCapability),
        ...run.results.map((result) => result.name),
      ]
        .join(' ')
        .toLowerCase()
        .includes(keyword)
    );
  }, [dashboard.runs, runKeyword]);

  const failedResults = latestRun?.results.filter((result) => !result.passed) ?? [];
  const warningResults =
    latestRun?.results.filter((result) =>
      result.validationChecks.some((check) => check.status === 'warning')
    ) ?? [];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/" aria-label="返回首页">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <Gauge className="h-5 w-5 text-red-600" />
                <h1 className="text-2xl font-bold tracking-normal text-slate-950">Agent 评测后台</h1>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                发起回归、追踪队列、比较模型表现，并观察 skill 版本对能力结果的影响。
              </p>
            </div>
          </div>
          <div className="hidden items-center gap-3 md:flex">
            <Badge variant="outline" className="bg-white text-slate-600">
              用例 {dashboard.summary.caseCount}
            </Badge>
            <Badge variant="outline" className="bg-white text-slate-600">
              报告 {dashboard.summary.reportCount}
            </Badge>
            <Button variant="outline" onClick={refreshDashboard} disabled={isRefreshing}>
              <RefreshCcw className={isRefreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
              刷新
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {toast && (
          <div
            className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
              toast.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {toast.message}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-500">
                <ShieldCheck className="h-4 w-4" />
                最新通过率
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-bold text-slate-950">{dashboard.summary.latestPassRate}%</span>
                {delta && (
                  <span className={delta.passRate >= 0 ? 'mb-1 text-sm text-emerald-600' : 'mb-1 text-sm text-red-600'}>
                    {delta.passRate >= 0 ? '+' : ''}
                    {delta.passRate}%
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm text-slate-500">
                {dashboard.summary.latestPassedCount}/{dashboard.summary.latestTotal} 个用例通过
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-500">
                <Sparkles className="h-4 w-4" />
                平均得分
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2">
                <span className={`text-4xl font-bold ${scoreClass(dashboard.summary.latestAverageScore)}`}>
                  {dashboard.summary.latestAverageScore}
                </span>
                {delta && (
                  <span className={delta.score >= 0 ? 'mb-1 text-sm text-emerald-600' : 'mb-1 text-sm text-red-600'}>
                    {delta.score >= 0 ? '+' : ''}
                    {delta.score}
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm text-slate-500">按通过、警告和失败项粗评分</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-500">
                <Layers3 className="h-4 w-4" />
                能力覆盖
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-4xl font-bold text-slate-950">{dashboard.summary.capabilityCount}</span>
              <p className="mt-2 text-sm text-slate-500">核心 Agent 能力域</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-500">
                <TriangleAlert className="h-4 w-4" />
                风险用例
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2">
                <span className={dashboard.summary.latestFailedCount ? 'text-4xl font-bold text-red-600' : 'text-4xl font-bold text-slate-950'}>
                  {dashboard.summary.latestFailedCount}
                </span>
                {delta && delta.failed !== 0 && (
                  <span className={delta.failed <= 0 ? 'mb-1 text-sm text-emerald-600' : 'mb-1 text-sm text-red-600'}>
                    {delta.failed > 0 ? '+' : ''}
                    {delta.failed}
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm text-slate-500">最新运行失败数量</p>
            </CardContent>
          </Card>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Play className="h-5 w-5 text-red-600" />
                一键运行 Benchmark
              </CardTitle>
              <p className="text-sm text-slate-500">可选择 Claude Code 或 Codex CLI。MiniMax M2.7 不使用 reasoning 档位。</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">执行器</label>
                  <select className={selectClassName} value={benchmarkCli} onChange={(event) => updateBenchmarkCli(event.target.value)}>
                    {runtimeOptions.map((runtime) => (
                      <option key={runtime.cli} value={runtime.cli}>
                        {runtime.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">模型</label>
                  <select className={selectClassName} value={benchmarkModel} onChange={(event) => setBenchmarkModel(event.target.value)}>
                    {benchmarkRuntime.models.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </select>
                </div>
                {benchmarkRuntimeSupportsReasoning && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Reasoning</label>
                    <select
                      className={selectClassName}
                      value={benchmarkReasoningEffort}
                      onChange={(event) => setBenchmarkReasoningEffort(event.target.value)}
                    >
                      <option value="low">low</option>
                      <option value="medium">medium</option>
                      <option value="high">high</option>
                      <option value="xhigh">xhigh</option>
                    </select>
                  </div>
                )}
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">用例</label>
                  <select className={selectClassName} value={selectedCase} onChange={(event) => setSelectedCase(event.target.value)}>
                    <option value="all">全部用例</option>
                    {dashboard.cases.map((testCase) => (
                      <option key={testCase.id} value={testCase.id}>
                        {testCase.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">数量限制</label>
                  <select className={selectClassName} value={limit} onChange={(event) => setLimit(event.target.value)}>
                    <option value="all">不限制</option>
                    <option value="1">1 个</option>
                    <option value="3">3 个</option>
                    <option value="6">6 个</option>
                  </select>
                </div>
              </div>

              <Button className="w-full" onClick={startBenchmark} disabled={isStarting}>
                {isStarting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {activeQueue ? '加入运行队列' : '启动评测'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Activity className="h-5 w-5 text-red-600" />
                运行队列
              </CardTitle>
              <p className="text-sm text-slate-500">后台启动的 benchmark 子进程会在这里更新状态。</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {dashboard.queue.slice(0, 5).map((item) => (
                  <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {queueBadge(item.status)}
                          <span className="font-mono text-xs text-slate-500">{item.id}</span>
                        </div>
                        <p className="mt-2 text-sm text-slate-700">
                          {CLI_LABELS[item.cli] ?? item.cli} · {item.model}
                          {item.reasoningEffort ? ` · ${item.reasoningEffort}` : ''}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          创建 {formatDate(item.createdAt)} · 开始 {formatDate(item.startedAt)}
                        </p>
                        {item.error && <p className="mt-2 text-sm text-red-600">{item.error}</p>}
                      </div>
                      {item.reportId ? (
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/evals/runs/${item.reportId}`}>报告</Link>
                        </Button>
                      ) : item.status === 'running' ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-5 w-5 animate-spin text-amber-600" />
                          <Button variant="outline" size="sm" onClick={() => cancelBenchmark(item.id)}>
                            <Square className="h-3.5 w-3.5" />
                            取消
                          </Button>
                        </div>
                      ) : item.status === 'queued' ? (
                        <Button variant="outline" size="sm" onClick={() => cancelBenchmark(item.id)}>
                          <Square className="h-3.5 w-3.5" />
                          取消
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
                {!dashboard.queue.length && (
                  <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                    暂无队列记录。
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Activity className="h-5 w-5 text-red-600" />
                    最新运行
                  </CardTitle>
                  <p className="mt-1 text-sm text-slate-500">
                    {latestRun ? `${formatDate(latestRun.createdAt)} · ${formatDuration(latestRun.durationMs)}` : '暂无评测报告'}
                  </p>
                </div>
                {latestRun && (
                  <Button asChild>
                    <Link href={`/evals/runs/${latestRun.id}`}>查看详情</Link>
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {latestRun ? (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                      <p className="text-sm text-slate-500">报告文件</p>
                      <p className="mt-2 truncate font-mono text-sm text-slate-900">{latestRun.fileName}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                      <p className="text-sm text-slate-500">模型</p>
                      <p className="mt-2 truncate text-sm font-semibold text-slate-900">
                        {latestRun.metadata.runtime.cli} · {latestRun.metadata.runtime.model}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                      <p className="text-sm text-slate-500">事件总量</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">
                        {latestRun.results.reduce((total, result) => total + (result.eventAudit?.total ?? 0), 0)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                      <p className="text-sm text-slate-500">警告用例</p>
                      <p className="mt-2 text-2xl font-semibold text-amber-600">{warningResults.length}</p>
                    </div>
                  </div>

                  {failedResults.length ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                      <p className="font-semibold text-red-800">失败用例</p>
                      <div className="mt-3 space-y-2">
                        {failedResults.map((result) => (
                          <Link
                            key={result.id}
                            href={`/evals/runs/${latestRun.id}#case-${result.id}`}
                            className="block rounded-md bg-white p-3 text-sm text-red-700 hover:bg-red-50"
                          >
                            {result.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                      最新评测全部通过。后续要重点观察警告项、数据源降级和截图冒烟是否稳定。
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">
                  暂无报告。运行 <span className="font-mono text-slate-700">npm run benchmark:quant</span> 后这里会自动展示。
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <BarChart3 className="h-5 w-5 text-red-600" />
                能力矩阵
              </CardTitle>
              <p className="text-sm text-slate-500">按最新运行统计每类能力的通过状态。</p>
            </CardHeader>
            <CardContent>
              {latestRun ? (
                <div className="space-y-3">
                  {Object.entries(latestRun.coverage.byCapability).map(([capabilityId, item]) => {
                    const label = dashboard.cases.find((testCase) => testCase.capabilityId === capabilityId)?.capabilityLabel ?? capabilityId;
                    const rate = item.total ? Math.round((item.passed / item.total) * 100) : 0;
                    return (
                      <div key={capabilityId} className="rounded-lg border border-slate-200 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-950">{label}</p>
                            <p className="text-xs text-slate-500">{capabilityId}</p>
                          </div>
                          <span className={rate === 100 ? 'text-sm font-semibold text-emerald-600' : 'text-sm font-semibold text-amber-600'}>
                            {rate}%
                          </span>
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={rate === 100 ? 'h-full rounded-full bg-emerald-500' : 'h-full rounded-full bg-amber-500'}
                            style={{ width: `${rate}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-slate-500">暂无能力矩阵。</p>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Database className="h-5 w-5 text-red-600" />
                模型对比
              </CardTitle>
              <p className="text-sm text-slate-500">按执行器、模型以及可选运行参数聚合历史报告。</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {dashboard.modelComparison.map((item) => (
                  <div key={item.key} className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-950">
                          {CLI_LABELS[item.cli] ?? item.cli} · {item.model}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.reasoningEffort && item.reasoningEffort !== '-' ? `reasoning ${item.reasoningEffort} · ` : ''}
                          {item.runs} 次运行
                        </p>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/evals/runs/${item.latestRunId}`}>最新</Link>
                      </Button>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div className="rounded-md bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">最新通过率</p>
                        <p className="mt-1 text-lg font-semibold text-slate-950">{item.latestPassRate}%</p>
                      </div>
                      <div className="rounded-md bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">平均得分</p>
                        <p className={`mt-1 text-lg font-semibold ${scoreClass(item.averageScore)}`}>{item.averageScore}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {!dashboard.modelComparison.length && (
                  <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                    暂无模型对比数据。
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Wrench className="h-5 w-5 text-red-600" />
                Skill 版本影响
              </CardTitle>
              <p className="text-sm text-slate-500">新报告会绑定 skills.lock 快照，用于观察版本升级后的回归表现。</p>
            </CardHeader>
            <CardContent>
              <div className="max-h-[520px] space-y-3 overflow-y-auto pr-2">
                {dashboard.skillVersionImpact.map((item) => (
                  <div key={`${item.skillId}@${item.version}`} className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-sm font-semibold text-slate-950">{item.skillId}</p>
                        <p className="mt-1 text-xs text-slate-500">v{item.version} · {item.runs} 次运行</p>
                      </div>
                      <Badge className={item.latestPassRate === 100 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}>
                        {item.latestPassRate}%
                      </Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div className="rounded-md bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">平均通过率</p>
                        <p className="mt-1 text-lg font-semibold text-slate-950">{item.averagePassRate}%</p>
                      </div>
                      <div className="rounded-md bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">平均得分</p>
                        <p className={`mt-1 text-lg font-semibold ${scoreClass(item.averageScore)}`}>{item.averageScore}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {!dashboard.skillVersionImpact.length && (
                  <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                    旧报告没有 skill 快照。重新运行一次 benchmark 后这里会出现归因数据。
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Clock3 className="h-5 w-5 text-red-600" />
                定时回归
              </CardTitle>
              <p className="text-sm text-slate-500">
                保存轻量定时配置后，可由页面手动检查或外部 cron 调用 npm run check:eval-schedule。
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">状态</label>
                  <select
                    className={selectClassName}
                    value={scheduleEnabled ? 'enabled' : 'disabled'}
                    onChange={(event) => setScheduleEnabled(event.target.value === 'enabled')}
                  >
                    <option value="enabled">启用</option>
                    <option value="disabled">停用</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">执行器</label>
                  <select className={selectClassName} value={scheduleCli} onChange={(event) => updateScheduleCli(event.target.value)}>
                    {runtimeOptions.map((runtime) => (
                      <option key={runtime.cli} value={runtime.cli}>
                        {runtime.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">模型</label>
                  <select className={selectClassName} value={scheduleModel} onChange={(event) => setScheduleModel(event.target.value)}>
                    {scheduleRuntime.models.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </select>
                </div>
                {scheduleRuntimeSupportsReasoning && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Reasoning</label>
                    <select
                      className={selectClassName}
                      value={scheduleReasoningEffort}
                      onChange={(event) => setScheduleReasoningEffort(event.target.value)}
                    >
                      <option value="low">low</option>
                      <option value="medium">medium</option>
                      <option value="high">high</option>
                      <option value="xhigh">xhigh</option>
                    </select>
                  </div>
                )}
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">间隔</label>
                  <select className={selectClassName} value={scheduleInterval} onChange={(event) => setScheduleInterval(event.target.value)}>
                    <option value="6">6 小时</option>
                    <option value="12">12 小时</option>
                    <option value="24">24 小时</option>
                    <option value="72">3 天</option>
                    <option value="168">7 天</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">用例</label>
                  <select className={selectClassName} value={scheduleCase} onChange={(event) => setScheduleCase(event.target.value)}>
                    <option value="all">全部用例</option>
                    {dashboard.cases.map((testCase) => (
                      <option key={testCase.id} value={testCase.id}>
                        {testCase.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 md:grid-cols-3">
                <div>
                  <p className="text-xs text-slate-500">下次触发</p>
                  <p className="mt-1 font-medium text-slate-900">{formatDate(dashboard.schedule.nextRunAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">上次触发</p>
                  <p className="mt-1 font-medium text-slate-900">{formatDate(dashboard.schedule.lastRunAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">最近队列</p>
                  <p className="mt-1 truncate font-mono text-slate-900">{dashboard.schedule.lastQueuedRunId ?? '-'}</p>
                </div>
              </div>
              <div className="flex flex-col gap-2 md:flex-row">
                <Button onClick={saveSchedule} disabled={isSavingSchedule} className="flex-1">
                  {isSavingSchedule ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock3 className="h-4 w-4" />}
                  保存定时配置
                </Button>
                <Button variant="outline" onClick={checkScheduleNow} className="flex-1">
                  <RefreshCcw className="h-4 w-4" />
                  立即检查触发
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Wrench className="h-5 w-5 text-red-600" />
                失败修复单
              </CardTitle>
              <p className="text-sm text-slate-500">失败报告会自动沉淀修复单，保留模型、case、失败项和建议动作。</p>
            </CardHeader>
            <CardContent>
              <div className="max-h-[440px] space-y-3 overflow-y-auto pr-2">
                {dashboard.repairTickets.slice(0, 8).map((ticket) => (
                  <div key={ticket.id} className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={ticket.severity === 'high' ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-700'}>
                            {ticket.severity === 'high' ? '高优先级' : '中优先级'}
                          </Badge>
                          <Badge variant="outline" className="bg-white">
                            {ticket.status === 'open' ? '待处理' : '已解决'}
                          </Badge>
                        </div>
                        <p className="mt-2 font-semibold text-slate-950">{ticket.title}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {ticket.caseId} · {ticket.model} · {formatDate(ticket.createdAt)}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/evals/runs/${ticket.runId}`}>报告</Link>
                      </Button>
                    </div>
                    <div className="mt-3 space-y-1 text-sm text-slate-600">
                      {(ticket.failures.length ? ticket.failures : ticket.validationSummaries).slice(0, 2).map((line) => (
                        <p key={line}>- {line}</p>
                      ))}
                    </div>
                  </div>
                ))}
                {!dashboard.repairTickets.length && (
                  <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                    暂无失败修复单。
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <FileText className="h-5 w-5 text-red-600" />
                    评测用例
                  </CardTitle>
                  <p className="mt-1 text-sm text-slate-500">固定问句、预期标的、输入形态和产物契约。</p>
                </div>
                <div className="relative w-full md:w-72">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={caseKeyword}
                    onChange={(event) => setCaseKeyword(event.target.value)}
                    placeholder="搜索用例、能力或标的..."
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="max-h-[620px] space-y-3 overflow-y-auto pr-2">
                {filteredCases.map((testCase) => (
                  <div key={testCase.id} className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-950">{testCase.name}</p>
                        <p className="mt-1 line-clamp-2 text-sm text-slate-500">{testCase.question}</p>
                      </div>
                      <Badge variant="outline" className="shrink-0 bg-white">
                        {testCase.capabilityLabel}
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge className="border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-50">
                        {testCase.typeLabel}
                      </Badge>
                      {testCase.expectedSymbols.slice(0, 4).map((symbol) => (
                        <Badge key={symbol} variant="outline" className="bg-white font-mono">
                          {symbol}
                        </Badge>
                      ))}
                      {testCase.expectedTemplateId && (
                        <Badge variant="outline" className="bg-white">
                          {testCase.expectedTemplateId}
                        </Badge>
                      )}
                      {testCase.hasImageAttachment && (
                        <Badge className="border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-50">
                          图片输入
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Database className="h-5 w-5 text-red-600" />
                    运行记录
                  </CardTitle>
                  <p className="mt-1 text-sm text-slate-500">读取 {dashboard.reportsDir} 中的本地评测报告。</p>
                </div>
                <div className="relative w-full md:w-72">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={runKeyword}
                    onChange={(event) => setRunKeyword(event.target.value)}
                    placeholder="搜索运行、能力或用例..."
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <div className="grid min-w-[760px] grid-cols-[1.2fr_0.7fr_0.7fr_0.7fr_0.7fr_0.5fr] border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500">
                  <span>运行</span>
                  <span>模型</span>
                  <span>通过率</span>
                  <span>得分</span>
                  <span>耗时</span>
                  <span className="text-right">详情</span>
                </div>
                <div className="max-h-[620px] overflow-auto">
                  {filteredRuns.map((run) => (
                    <div
                      key={run.id}
                      className="grid min-w-[760px] grid-cols-[1.2fr_0.7fr_0.7fr_0.7fr_0.7fr_0.5fr] items-center border-b border-slate-100 px-4 py-3 text-sm last:border-b-0"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {statusBadge(run.passed)}
                          <span className="truncate font-mono text-xs text-slate-500">{run.fileName}</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{formatDate(run.createdAt)}</p>
                      </div>
                      <span className="truncate text-xs text-slate-600">
                        {run.metadata.runtime.cli} · {run.metadata.runtime.model}
                      </span>
                      <span className={run.passRate === 100 ? 'font-semibold text-emerald-600' : 'font-semibold text-amber-600'}>
                        {run.passRate}%
                      </span>
                      <span className={`font-semibold ${scoreClass(run.averageScore)}`}>{run.averageScore}</span>
                      <span className="text-slate-600">{formatDuration(run.durationMs)}</span>
                      <div className="text-right">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/evals/runs/${run.id}`}>查看</Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                  {!filteredRuns.length && (
                    <div className="p-8 text-center text-sm text-slate-500">没有匹配的运行记录。</div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="flex items-start gap-3 p-5">
              <Clock3 className="mt-1 h-5 w-5 text-slate-500" />
              <div>
                <p className="font-semibold text-slate-950">当前版本定位</p>
                <p className="mt-1 text-sm text-slate-500">
                  已支持一键运行、队列状态、模型聚合和 skill lock 快照归因。
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-start gap-3 p-5">
              <Database className="mt-1 h-5 w-5 text-slate-500" />
              <div>
                <p className="font-semibold text-slate-950">数据来源</p>
                <p className="mt-1 text-sm text-slate-500">
                  用例来自 {dashboard.casesPath}，报告来自 {dashboard.reportsDir}。
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-start gap-3 p-5">
              <Activity className="mt-1 h-5 w-5 text-slate-500" />
              <div>
                <p className="font-semibold text-slate-950">后续增强</p>
                <p className="mt-1 text-sm text-slate-500">
                  可继续做取消运行、失败自动开修复单、定时回归和 CI 对接。
                </p>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
