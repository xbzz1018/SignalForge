"use client";

import type { ReactNode } from "react";
import { CircleCheck, Info, Plus, RefreshCw, ShieldCheck } from "lucide-react";

interface ServiceToken {
  id: string;
  provider: string;
  token: null;
  token_preview?: string;
  has_token?: boolean;
  name?: string;
  created_at: string;
  last_used?: string;
}

const SERVICE_LABELS: Record<string, string> = {
  github: "GitHub",
  supabase: "Supabase",
  vercel: "Vercel",
};

interface ServicesTabProps {
  tokens: { [key: string]: ServiceToken | null };
  getProviderIcon: (provider: string) => ReactNode;
  onServiceClick: (provider: "github" | "supabase" | "vercel") => void;
}

function ServicesTab({ tokens, getProviderIcon, onServiceClick }: ServicesTabProps) {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><ShieldCheck className="h-4 w-4" /></span>
          <div>
            <h3 className="text-lg font-semibold text-foreground">服务令牌</h3>
            <p className="mt-1 text-sm text-muted-foreground">
          配置 GitHub、Supabase 与 Vercel 令牌。令牌会被所有工作空间复用，用于仓库创建、数据库接入和部署发布。
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {Object.entries(tokens).map(([provider, token]) => (
            <article
              key={provider}
              className="flex min-h-44 flex-col justify-between rounded-2xl border border-border/70 bg-card p-4 shadow-sm"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/60 text-foreground">{getProviderIcon(provider)}</span>
                  <span className={token ? "inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300" : "rounded-full bg-amber-500/10 px-2 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300"}>
                    {token ? <><CircleCheck className="h-3 w-3" />就绪</> : "待配置"}
                  </span>
                </div>
                <p className="mt-5 font-semibold text-foreground">{SERVICE_LABELS[provider] ?? provider}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {token ? (
                    <>已配置令牌 · {new Date(token.created_at).toLocaleDateString()}</>
                  ) : (
                    "未配置令牌"
                  )}
                </p>
              </div>

              <div className="mt-4 border-t border-border/60 pt-3">
                <button
                  type="button"
                  onClick={() => onServiceClick(provider as "github" | "supabase" | "vercel")}
                  className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-border/70 bg-background px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary/35 hover:bg-primary/5"
                >
                  {token ? <RefreshCw className="h-4 w-4 text-primary" /> : <Plus className="h-4 w-4 text-primary" />}
                  {token ? "更新令牌" : "添加令牌"}
                </button>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-dashed border-primary/25 bg-primary/[0.045] p-4">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">令牌使用范围</h3>
              <div className="mt-2 text-sm leading-6 text-muted-foreground">
                <p>
                  这里保存的是平台级凭据。具体项目绑定到哪个 GitHub 仓库、Supabase 项目或 Vercel 项目，
                  仍在对应工作空间的项目设置中完成。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { ServicesTab, SERVICE_LABELS };
export type { ServicesTabProps, ServiceToken };
