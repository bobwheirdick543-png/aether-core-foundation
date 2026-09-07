import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Gauge,
  Users,
  Boxes,
  Bot,
  Library,
  Telescope,
  ListChecks,
  FolderKanban,
  KeyRound,
  Activity,
  ScrollText,
  Server,
  Settings,
  Menu,
  X,
  LogOut,
  ArrowLeft,
} from "lucide-react";
import { AetherMark } from "@/components/brand/Logo";
import { supabase } from "@/integrations/supabase/client";

const NAV = [
  { label: "Overview", to: "/admin" as const, icon: Gauge, exact: true },
  { label: "Users", to: "/admin/users" as const, icon: Users },
  { label: "AI Models", to: "/admin/models" as const, icon: Boxes },
  { label: "AI Agents", to: "/admin/agents" as const, icon: Bot },
  { label: "Knowledge", to: "/admin/knowledge" as const, icon: Library },
  { label: "Research", to: "/admin/research" as const, icon: Telescope },
  { label: "Tasks", to: "/admin/tasks" as const, icon: ListChecks },
  { label: "Projects", to: "/admin/projects" as const, icon: FolderKanban },
  { label: "API Keys", to: "/admin/api-keys" as const, icon: KeyRound },
  { label: "Usage", to: "/admin/usage" as const, icon: Activity },
  { label: "Logs", to: "/admin/logs" as const, icon: ScrollText },
  { label: "System", to: "/admin/system" as const, icon: Server },
  { label: "Settings", to: "/admin/settings" as const, icon: Settings },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/admin/login", replace: true });
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between border-b border-admin/25 px-5">
        <Link to="/admin" className="inline-flex items-center gap-2.5">
          <AetherMark className="h-6 w-6 text-admin" />
          <span className="text-[13px] font-semibold uppercase tracking-[0.18em]">
            Aether <span className="text-admin">Admin</span>
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
          className="rounded-md border border-admin/25 p-1.5 lg:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {NAV.map(({ label, to, icon: Icon, exact }) => (
          <Link
            key={to}
            to={to}
            onClick={() => setOpen(false)}
            activeOptions={{ exact: Boolean(exact) }}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground/70 transition-colors hover:bg-admin/10 hover:text-foreground"
            activeProps={{ className: "bg-admin/15 text-foreground font-medium" }}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="space-y-1 border-t border-admin/25 p-3">
        <Link
          to="/dashboard"
          onClick={() => setOpen(false)}
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground/70 hover:bg-admin/10 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          User workspace
        </Link>
        <button
          type="button"
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground/70 hover:bg-admin/10 hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-admin/25 bg-elevated/60 lg:block">
        {sidebar}
      </aside>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-admin/25 bg-elevated">
            {sidebar}
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <div className="h-0.5 w-full bg-admin/60" />
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-admin/25 bg-background/85 px-5 backdrop-blur-xl lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
            className="rounded-md border border-admin/25 p-2"
          >
            <Menu className="h-4 w-4" />
          </button>
          <span className="text-[13px] font-semibold uppercase tracking-[0.18em]">
            Aether <span className="text-admin">Admin</span>
          </span>
        </header>

        <main className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
