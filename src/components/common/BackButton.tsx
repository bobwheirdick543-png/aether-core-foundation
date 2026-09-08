import { useRouter, useCanGoBack } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Platform-wide Back control.
 * Uses real history when available; otherwise falls back to a safe route
 * inside the current shell (user workspace or admin control plane).
 */
export function BackButton({
  fallback = "/dashboard",
  label = "Back",
  className,
}: {
  fallback?: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const canGoBack = useCanGoBack();

  function onBack() {
    if (canGoBack) {
      router.history.back();
      return;
    }
    router.navigate({ to: fallback });
  }

  return (
    <button
      type="button"
      onClick={onBack}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-border/80 bg-transparent px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border hover:bg-secondary/60 hover:text-foreground",
        className,
      )}
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
