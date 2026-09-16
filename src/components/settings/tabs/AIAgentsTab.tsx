"use client";

import { ArrowRight, Bot, Cloud, Cpu, RefreshCw, Save, ServerCog, Wrench } from "lucide-react";
import type { CLIStatus } from "@/types/cli";

interface CLIOption {
  id: string;
  name: string;
  icon: string;
  description: string;
  models: { id: string; name: string; description?: string; provider?: string; runtime?: string; external?: boolean }[];
  color: string;
  brandColor: string;
  downloadUrl: string;
  installCommand: string;
  enabled?: boolean;
}

interface AIAgentsTabProps {
  cliOptions: CLIOption[];
  cliStatus: CLIStatus;
  saveMessage: { type: "success" | "error"; text: string } | null;
  isLoading: boolean;
  selectedModelId?: string;
  onRefreshCliStatus: () => void;
  onSaveSettings: () => void;
  onSelectModel: (modelId: string) => void;
  onOpenInstallModal: (cli: CLIOption) => void;
}

function AIAgentsTab({
  cliOptions,
  cliStatus,
  saveMessage,
  isLoading,
  selectedModelId,
  onRefreshCliStatus,
  onSaveSettings,
  onSelectModel,
  onOpenInstallModal,
}: AIAgentsTabProps) {
  const runtime = cliOptions[0];
  const status = runtime ? cliStatus[runtime.id] : undefined;
  const installed = Boolean(status?.installed);
  const configured = Boolean(status?.configured);
  const configuredModelIds = new Set(status?.models ?? []);

  const connectionForModel = (model: CLIOption["models"][number]) => {
    if (model.runtime === "deepseek-official") {
      return {
        label: "DeepSeek 官方直连",
        endpoint: "https://api.deepseek.com",
        credentialEnv: "DEEPSEEK_API_KEY",
      };
    }
    if (model.id.startsWith("local_qwen:")) {
      return {
        label: "本机 OpenAI-compatible",
        endpoint: "http://127.0.0.1:38082/v1",
        credentialEnv: "MODELPORT_API_KEY",
      };
    }
    return {
      label: "ModelPort 路由",
      endpoint: "http://127.0.0.1:38082/v1",
      credentialEnv: "MODELPORT_API_KEY",
    };
  };

  const modelStatusLabel = (model: CLIOption["models"][number], modelConfigured: boolean) => {
    if (modelConfigured) return "已配置";
    if (model.runtime === "deepseek-official") return "需要官方 Key";
    if (model.id.startsWith("local_qwen:")) return "本机服务未就绪";
    return "ModelPort 未就绪";
  };

  const modelIcon = (model: CLIOption["models"][number]) => {
    if (model.runtime === "deepseek-official") return Cloud;
    if (model.id.startsWith("local_qwen:")) return Cpu;
    return ServerCog;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">MODEL ROUTING</p>
          <h3 className="mt-2 text-lg font-semibold text-foreground">PI Agent 模型路由</h3>
          <p className="mt-1 text-sm text-muted-foreground">本地 Qwen 保持默认；DeepSeek 可选择 ModelPort 转发或官方 API 直连。</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefreshCliStatus}
            type="button"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border/70 bg-background px-3 py-2 text-xs font-semibold text-foreground transition hover:border-primary/35 hover:bg-primary/5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            刷新状态
          </button>
          <button
            type="button"
            onClick={onSaveSettings}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {isLoading ? "保存中..." : "确认配置"}
          </button>
        </div>
      </div>

      {saveMessage && (
        <div role="status" className={`rounded-xl border px-4 py-3 text-sm ${saveMessage.type === "success" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300"}`}>
          {saveMessage.text}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        <div className="border-b border-border/60 bg-gradient-to-r from-primary/10 via-card to-cyan-500/10 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Bot className="h-5 w-5" /></span>
              <div>
                <h4 className="font-semibold text-foreground">{runtime?.name ?? "PI Agent"}</h4>
                <p className="mt-1 text-xs text-muted-foreground">{runtime?.description}</p>
              </div>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${configured && installed ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}>
              {configured && installed ? "已就绪" : "待配置"}
            </span>
          </div>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-2">
          {runtime?.models.map((model) => {
            const connection = connectionForModel(model);
            const modelConfigured = configuredModelIds.has(model.id);
            const selected = selectedModelId === model.id;
            const ModelIcon = modelIcon(model);
            return (
              <button
                key={model.id}
                type="button"
                onClick={() => onSelectModel(model.id)}
                className={`rounded-xl border p-4 text-left transition ${selected ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border/70 bg-muted/30 hover:border-primary/30"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-semibold text-foreground"><ModelIcon className="h-4 w-4 shrink-0 text-primary" />{model.name}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{model.description}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${modelConfigured ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}>
                    {modelStatusLabel(model, modelConfigured)}
                  </span>
                </div>
                <code className="mt-3 block break-all text-xs text-primary">{model.id}</code>
                <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                  <span>{connection.label}</span>
                  <code className="break-all">{connection.endpoint}</code>
                  <code className="sm:col-span-2">{connection.credentialEnv}</code>
                </div>
                {selected && <p className="mt-3 text-xs font-semibold text-primary">当前默认路由</p>}
              </button>
            );
          })}
        </div>

        {!installed && runtime && (
          <div className="border-t border-border/60 px-5 py-4">
            <button type="button" onClick={() => onOpenInstallModal(runtime)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80">
              <Wrench className="h-4 w-4" />
              查看本地执行引擎修复指引
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {!configured && (
          <div className="border-t border-amber-500/25 bg-amber-500/10 px-5 py-4 text-sm text-amber-800 dark:text-amber-300">
            本地 Qwen 与 ModelPort 需要可达的 <code className="rounded bg-background/70 px-1.5 py-0.5">http://127.0.0.1:38082/v1</code>；官方直连只需配置 <code className="rounded bg-background/70 px-1.5 py-0.5">DEEPSEEK_API_KEY</code>。未就绪路由不会影响已选模型。
          </div>
        )}
      </div>
    </div>
  );
}

export { AIAgentsTab };
export type { AIAgentsTabProps, CLIOption };
