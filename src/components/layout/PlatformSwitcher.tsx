"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BarChart3,
  Blocks,
  BookOpenCheck,
  BrainCircuit,
  FileChartColumn,
  Grid2X2,
  Home,
  ShieldCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

const PRODUCTS = [
  { href: "/", label: "信号台", description: "提出假设与管理研究任务", icon: Home, group: "research" },
  { href: "/strategy-platform", label: "策略沙盒", description: "筛选、回测与策略复盘", icon: BarChart3, group: "research" },
  { href: "/research-reports", label: "报告档案", description: "观察池、日报与交付", icon: FileChartColumn, group: "research" },
  { href: "/business-knowledge", label: "研究规范", description: "能力、规范与数据契约", icon: BookOpenCheck, group: "governance" },
  { href: "/skills", label: "工具市场", description: "Skills 市场、版本与 Studio", icon: Blocks, group: "governance" },
  { href: "/eval-platform", label: "质量评测", description: "契约、基准与端到端评测", icon: BrainCircuit, group: "governance" },
  { href: "/ops-platform", label: "运行中心", description: "服务、任务与交付健康", icon: ShieldCheck, group: "governance" },
] as const

const PRODUCT_GROUPS = [
  { id: "research", label: "研究与交付" },
  { id: "governance", label: "能力与治理" },
] as const

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)
}

type PlatformSwitcherProps = {
  beforeNavigate?: (href: string) => boolean
}

export function PlatformSwitcher({ beforeNavigate }: PlatformSwitcherProps = {}) {
  const pathname = usePathname() ?? "/"
  const currentProduct = PRODUCTS.find((product) => isActive(pathname, product.href))

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 w-9 gap-2 rounded-xl border-border/70 bg-background/75 px-0 shadow-sm sm:w-auto sm:px-2.5"
          aria-label={`打开研究空间导航${currentProduct ? `，当前为${currentProduct.label}` : ""}`}
        >
          <Grid2X2 className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">研究空间</span>
          {currentProduct ? (
            <span className="hidden max-w-24 truncate border-l border-border/70 pl-2 text-muted-foreground xl:inline">
              {currentProduct.label}
            </span>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[min(92vw,420px)] overflow-y-auto border-border/70 p-0 pb-[env(safe-area-inset-bottom)] sm:max-w-[420px]">
        <SheetHeader className="border-b border-border/60 px-5 py-5 pr-12">
          <SheetTitle>SignalForge 研究空间</SheetTitle>
          <SheetDescription>围绕同一研究任务，在研究、策略、交付与治理之间切换。</SheetDescription>
        </SheetHeader>
        <nav className="p-4" aria-label="研究空间">
          {PRODUCT_GROUPS.map((group, groupIndex) => (
            <section key={group.id} className={cn(groupIndex > 0 && "mt-5 border-t border-border/55 pt-4")}>
              <p className="mb-2 px-1 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground">
                {group.label}
              </p>
              <div className="grid gap-2">
                {PRODUCTS.filter((product) => product.group === group.id).map((product) => {
                  const Icon = product.icon
                  const active = isActive(pathname, product.href)
                  return (
                    <SheetClose asChild key={product.href}>
                      <Link
                        href={product.href}
                        aria-current={active ? "page" : undefined}
                        onClick={(event) => {
                          if (active || !beforeNavigate || beforeNavigate(product.href)) return
                          event.preventDefault()
                          event.stopPropagation()
                        }}
                        className={cn(
                          "group flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors",
                          active
                            ? "border-primary/35 bg-primary/10 text-primary"
                            : "border-border/55 bg-card hover:border-primary/25 hover:bg-primary/5",
                        )}
                      >
                        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:text-primary")}>
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2 text-sm font-semibold text-foreground">
                            {product.label}
                            {active ? <span className="text-[10px] font-medium text-primary">当前</span> : null}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">{product.description}</span>
                        </span>
                      </Link>
                    </SheetClose>
                  )
                })}
              </div>
            </section>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  )
}
