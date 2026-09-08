import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  MessagesSquare,
  Boxes,
  FolderKanban,
  Library,
  Brain,
  Telescope,
  FileText,
  ListChecks,
  KeyRound,
  Settings,
  Menu,
  X,
  LogOut,
  ShieldCheck,
  Bell,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/hooks/useRoles";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "Dashboard", to: "/dashboard" as const, icon: LayoutDashboard },
  { label: "Chat", to: "/chat" as const, icon: MessagesSquare },
  { label: "Models", to: "/models" as const, icon: Boxes },
  { label: "Projects", to: "/projects" as const, icon: FolderKanban },
  { label: "Knowledge", to: "/knowledge" as const, icon: Library },
  { label: "Memory", to: "/memory" as const, icon: Brain },
  { label: "Research", to: "/research" as const, icon: Telescope },
  { label: "Reports", to: "/reports" as const, icon: FileText },
  { label: "Tasks", to: "/tasks" as const, icon: ListChecks },
  { label: "Notifications", to: "/notifications" as const, icon: Bell },
  { label: "API / Developers", to: "/api-keys" as const, icon: KeyRound },
  { label: "Settings", to: "/settings" as const, icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: roles } = useRoles();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-5">
        <Link to="/dashboard" onClick={() => setOpen(false)}>
          <Logo />
        </Link>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
          className="rounded-md border border-sidebar-border p-1.5 lg:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {NAV.map(({ label, to, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            activeProps={{
              className: "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
            }}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="space-y-1 border-t border-sidebar-border p-3">
        {roles?.isAdmin ? (
          <Link
            to="/admin"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-admin transition-colors hover:bg-admin/10"
          >
            <ShieldCheck className="h-4 w-4" />
            Admin console
          </Link>
        ) : null}
        <button
          type="button"
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-sidebar-border bg-sidebar lg:block">
        {sidebar}
      </aside>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-sidebar-border bg-sidebar">
            {sidebar}
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/85 px-5 backdrop-blur-xl lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
            className="rounded-md border border-border p-2"
          >
            <Menu className="h-4 w-4" />
          </button>
          <Logo />
        </header>

        <main className={cn("mx-auto w-full max-w-6xl px-5 py-8 lg:px-10 lg:py-10")}>{children}</main>
      </div>
    </div>
  );
}

export function QuickAction({
  to,
  label,
  description,
  icon: Icon,
}: {
  to: "/chat" | "/research" | "/projects" | "/knowledge" | "/reports";
  label: string;
  description: string;
  icon: typeof MessagesSquare;
}) {
  return (
    <Link
      to={to}
      className="panel group flex items-start gap-3 p-4 transition-colors hover:border-primary/40"
    >
      <span className="rounded-md border border-border bg-elevated p-2 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <span className="space-y-0.5">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
    </Link>
  );
}

export { Button };
