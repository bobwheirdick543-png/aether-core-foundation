import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

/* ─── Page Header ───────────────────────────────────────────── */

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border/80 pb-7 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1.5">
        {eyebrow ? (
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight text-balance-tight sm:text-[28px]">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/* ─── Panels ────────────────────────────────────────────────── */

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("panel p-5", className)}>{children}</div>;
}

export function PanelElevated({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("panel-elevated p-5", className)}>{children}</div>;
}

/* ─── Stats ─────────────────────────────────────────────────── */

export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "primary" | "success" | "warning" | "admin";
}) {
  const valueTone = {
    neutral: "",
    primary: "text-primary",
    success: "text-success",
    warning: "text-warning",
    admin: "text-admin",
  }[tone];

  return (
    <div className="panel group p-4 transition-colors hover:border-primary/25">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className={cn("mt-2 font-mono text-2xl font-semibold tabular-nums", valueTone)}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/* ─── Tags / Badges ─────────────────────────────────────────── */

type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "admin";

const toneClass: Record<Tone, string> = {
  neutral: "border-border bg-muted text-muted-foreground",
  primary: "border-primary/30 bg-primary/10 text-primary",
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  danger: "border-destructive/30 bg-destructive/10 text-destructive",
  admin: "border-admin/30 bg-admin/10 text-admin",
};

export function Tag({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide",
        toneClass[tone],
      )}
    >
      {children}
    </span>
  );
}

/* ─── Phase Note ────────────────────────────────────────────── */

export function PhaseNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-dashed border-border/80 bg-muted/30 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
      <span className="mt-px shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-primary">
        UI only
      </span>
      <span>{children}</span>
    </div>
  );
}

/* ─── Empty State ───────────────────────────────────────────── */

export function EmptyState({
  title,
  description,
  actionLabel,
  actionTo,
  icon,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionTo?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="panel flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      {icon ? (
        <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-elevated text-primary">
          {icon}
        </div>
      ) : null}
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">{description}</p>
      {actionLabel && actionTo ? (
        <Button asChild size="sm" className="mt-2">
          <Link to={actionTo}>{actionLabel}</Link>
        </Button>
      ) : null}
    </div>
  );
}

/* ─── Loading / Skeleton ────────────────────────────────────── */

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted/60", className)}
      aria-hidden="true"
    />
  );
}

export function LoadingState({
  message = "Preparing…",
  submessage,
}: {
  message?: string;
  submessage?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <div className="relative flex h-10 w-10 items-center justify-center">
        <span className="absolute inset-0 rounded-full border-2 border-primary/20" />
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-primary" />
      </div>
      <p className="text-sm font-medium">{message}</p>
      {submessage ? (
        <p className="text-xs text-muted-foreground">{submessage}</p>
      ) : null}
    </div>
  );
}

/* ─── Status Dot ────────────────────────────────────────────── */

export function StatusDot({
  status,
  label,
}: {
  status: "online" | "offline" | "busy" | "maintenance";
  label?: string;
}) {
  const colors = {
    online: "bg-success",
    offline: "bg-muted-foreground",
    busy: "bg-warning",
    maintenance: "bg-admin",
  };

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={cn("h-1.5 w-1.5 rounded-full", colors[status], status === "online" && "ai-pulse")} />
      {label ?? status}
    </span>
  );
}
