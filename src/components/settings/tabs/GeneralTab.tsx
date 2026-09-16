"use client";

import { ArrowRight, Bot, CheckCircle2, KeyRound, ListChecks } from "lucide-react";

interface GeneralTabProps {
  defaultCliName: string;
  isDefaultCliInstalled: boolean;
  defaultModelName: string;
  configuredServiceCount: number;
  installedAgentCount: number;
  totalAgentCount: number;
  onNavigateToAgents: () => void;
  onNavigateToServices: () => void;
}

const GENERATION_POLICIES = [
  {
    title: "生成工作空间",
    description: "首页任务会使用默认智能体与模型创建工作空间，并继承已配置的服务令牌。",
    status: "自动继承",
  },
  {
    title: "评测链路",
    description: "测试用例、评测集和运行记录使用同一套模型与服务连接，便于复盘生成质量。",
    status: "统一配置",
  },
  {
    title: "失败修复",
    description: "运行中心负责健康检查、生成链路观测和失败修复，这里只维护全局默认项。",
    status: "治理中心处理",
  },
];

function GeneralTab({
  defaultCliName,
  isDefaultCliInstalled,
  defaultModelName,
  configuredServiceCount,
  installedAgentCount,
  totalAgentCount,
  onNavigateToAgents,
  onNavigateToServices,
}: GeneralTabProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><Bot className="h-4 w-4 text-primary" />默认智能体</div>
          <p className="mt-3 text-lg font-semibold text-foreground">{defaultCliName || "未配置"}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {isDefaultCliInstalled ? "已安装，可用于新任务" : "未检测到安装状态"}
          </p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><Bot className="h-4 w-4 text-primary" />默认模型</div>
          <p className="mt-3 line-clamp-2 min-h-12 text-lg font-semibold text-foreground">{defaultModelName || "未选择模型"}</p>
          <p className="mt-1 text-sm text-muted-foreground">首页创建任务时默认采用该模型</p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><KeyRound className="h-4 w-4 text-primary" />服务令牌</div>
          <p className="mt-3 text-lg font-semibold text-foreground">{configuredServiceCount}/3 已配置</p>
          <p className="mt-1 text-sm text-muted-foreground">GitHub、Supabase、Vercel 连接状态</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><ListChecks className="h-4 w-4" /></span>
            <div>
              <h3 className="text-lg font-semibold text-foreground">生成链路默认配置</h3>
              <p className="mt-1 text-sm text-muted-foreground">
              这里的配置会影响首页生成、项目会话和评测运行；具体工作空间健康与修复在运行中心处理。
              </p>
            </div>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <button
              type="button"
              onClick={onNavigateToAgents}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border/70 bg-background px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary/35 hover:bg-primary/5"
            >
              <Bot className="h-4 w-4 text-primary" />
              配置智能体
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onNavigateToServices}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <KeyRound className="h-4 w-4" />
              配置服务令牌
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {GENERATION_POLICIES.map((policy) => (
            <div
              key={policy.title}
              className="flex items-start justify-between gap-4 rounded-xl border border-border/60 bg-muted/35 px-4 py-3"
            >
              <div className="flex min-w-0 items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <p className="font-semibold text-foreground">{policy.title}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{policy.description}</p>
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-background px-2.5 py-1 text-xs font-semibold text-muted-foreground ring-1 ring-border/70">
                {policy.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-primary/25 bg-primary/[0.045] p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-foreground">当前可用智能体</span>
          <span className="rounded-full bg-background px-2.5 py-1 text-xs font-semibold text-primary ring-1 ring-primary/20">
            {installedAgentCount}/{totalAgentCount}
          </span>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          未安装的智能体不会作为默认选项。新建工作空间时，如果需要切换运行时，可以在首页输入框下方临时选择。
        </p>
      </div>
    </div>
  );
}

export { GeneralTab };
export type { GeneralTabProps };
