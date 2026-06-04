"use client";

import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme, type ColorMode } from "@/contexts/ThemeContext";

type ThemeToggleProps = {
  className?: string;
  compact?: boolean;
};

const OPTIONS: Array<{ mode: ColorMode; label: string; icon: typeof Sun }> = [
  { mode: "light", label: "亮色", icon: Sun },
  { mode: "dark", label: "暗色", icon: Moon },
];

export function ThemeToggle({ className, compact = false }: ThemeToggleProps) {
  const { colorMode, setColorMode } = useTheme();

  return (
    <div
      className={cn(
        "inline-flex h-8 items-center gap-0.5 rounded-md border border-border bg-muted/50 p-0.5",
        className,
      )}
      role="group"
      aria-label="界面主题"
    >
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const active = colorMode === option.mode;

        return (
          <button
            key={option.mode}
            type="button"
            title={option.label}
            aria-pressed={active}
            onClick={() => setColorMode(option.mode)}
            className={cn(
              "inline-flex h-7 items-center justify-center gap-1.5 rounded px-2 text-xs font-medium transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
              compact ? "w-7 px-0" : "min-w-14",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {!compact && <span className="hidden sm:inline">{option.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
