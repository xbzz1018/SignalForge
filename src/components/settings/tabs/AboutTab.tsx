"use client";

import { Code2, ExternalLink, Lightbulb, LineChart, MessageCircle, Zap } from "lucide-react";

function AboutTab() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="relative mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
          <LineChart className="h-9 w-9" aria-hidden="true" />
        </div>
        <h3 className="text-2xl font-bold text-foreground">SignalForge</h3>
        <p className="mt-2 font-medium text-muted-foreground">Version 1.0.0</p>
      </div>

      <div className="space-y-4 rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
        <div className="text-center">
          <p className="mx-auto max-w-2xl text-base leading-relaxed text-muted-foreground">
            SignalForge 是我的个人量化研究台，复用 PI Agent 的执行能力，接入本地 Qwen、
            DeepSeek 官方直连和可选 ModelPort，并把行情、回测与证据整理成可复核的研究输出。
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 text-center">
          <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
            <div className="mb-2 flex items-center justify-center">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <p className="text-xs font-semibold text-foreground">快速部署</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
            <div className="mb-2 flex items-center justify-center">
              <Lightbulb className="h-5 w-5 text-primary" />
            </div>
            <p className="text-xs font-semibold text-foreground">AI 驱动</p>
          </div>
        </div>
      </div>

      <div className="text-center">
        <div className="flex flex-wrap justify-center gap-3">
          <a
            href="https://github.com/tiammomo/QuantPilot"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border/70 bg-card px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary/35 hover:bg-primary/5"
          >
            <Code2 className="h-4 w-4" />参考仓库<ExternalLink className="h-3.5 w-3.5 text-primary" />
          </a>
          <a
            href="https://discord.gg/NJNbafHNQC"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border/70 bg-card px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary/35 hover:bg-primary/5"
          >
            <MessageCircle className="h-4 w-4" />Discord<ExternalLink className="h-3.5 w-3.5 text-primary" />
          </a>
        </div>
      </div>
    </div>
  );
}

export { AboutTab };
