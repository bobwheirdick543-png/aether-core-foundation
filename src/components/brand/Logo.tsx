import { cn } from "@/lib/utils";

/** Aether mark: an octahedron drawn as pure vector so it stays crisp anywhere. */
export function AetherMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn("h-7 w-7", className)} aria-hidden="true">
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      >
        <path d="M24 3 L43 24 L24 45 L5 24 Z" />
        <path d="M24 15 L38 24 L24 33 L10 24 Z" opacity="0.75" />
        <path d="M24 3 V45 M5 24 H43" opacity="0.5" />
      </g>
    </svg>
  );
}

export function Logo({ className, subtitle }: { className?: string; subtitle?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <AetherMark className="h-6 w-6 text-primary" />
      <span className="flex items-baseline gap-2">
        <span className="text-[15px] font-semibold tracking-[0.18em] uppercase">Aether</span>
        {subtitle ? (
          <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            {subtitle}
          </span>
        ) : null}
      </span>
    </span>
  );
}
