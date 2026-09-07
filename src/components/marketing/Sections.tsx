import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Section({
  id,
  eyebrow,
  title,
  description,
  children,
  className,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("border-t border-border/70 py-20 lg:py-24", className)}>
      <div className="mx-auto w-full max-w-7xl px-5 lg:px-8">
        <div className="max-w-2xl">
          {eyebrow ? (
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary">{eyebrow}</p>
          ) : null}
          <h2 className="mt-3 text-2xl font-semibold text-balance-tight sm:text-3xl">{title}</h2>
          {description ? (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
              {description}
            </p>
          ) : null}
        </div>
        {children ? <div className="mt-10">{children}</div> : null}
      </div>
    </section>
  );
}

export function FeatureCard({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="panel group h-full p-5 transition-colors hover:border-primary/40">
      <span className="inline-flex rounded-md border border-border bg-elevated p-2 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <h3 className="mt-4 text-sm font-semibold">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

export function FlowList({ items }: { items: string[] }) {
  return (
    <ol className="grid gap-3 sm:grid-cols-2">
      {items.map((item, i) => (
        <li key={item} className="panel flex items-start gap-3 p-4">
          <span className="font-mono text-xs text-primary">{String(i + 1).padStart(2, "0")}</span>
          <span className="text-sm text-muted-foreground">{item}</span>
        </li>
      ))}
    </ol>
  );
}
