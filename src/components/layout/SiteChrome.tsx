import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "Features", to: "/features" as const },
  { label: "Models", to: "/models-overview" as const },
  { label: "Agents", to: "/agents-overview" as const },
  { label: "Developers", to: "/developers" as const },
  { label: "Docs", to: "/docs" as const },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-all duration-300",
        scrolled
          ? "border-b border-border/60 bg-background/80 backdrop-blur-xl shadow-[0_1px_0_0_color-mix(in_oklab,var(--foreground)_4%,transparent)]"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5 lg:px-8">
        <Link to="/" className="transition-opacity hover:opacity-80">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-0.5 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-md px-3.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground"
              activeProps={{ className: "text-foreground bg-secondary/50" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Button asChild variant="ghost" size="sm">
            <Link to="/login">Log in</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/signup">Get Started</Link>
          </Button>
        </div>

        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
          className="rounded-md border border-border/80 p-2 transition-colors hover:bg-secondary lg:hidden"
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {open ? (
        <div className="animate-in-fade border-t border-border/60 bg-background/95 backdrop-blur-xl lg:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-0.5 px-5 py-4">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button asChild variant="outline" size="sm" onClick={() => setOpen(false)}>
                <Link to="/login">Log in</Link>
              </Button>
              <Button asChild size="sm" onClick={() => setOpen(false)}>
                <Link to="/signup">Get Started</Link>
              </Button>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}

const FOOTER_LINKS = [
  { label: "Features", to: "/features" as const },
  { label: "Developers", to: "/developers" as const },
  { label: "Documentation", to: "/docs" as const },
  { label: "Privacy", to: "/privacy" as const },
  { label: "Terms", to: "/terms" as const },
  { label: "Contact", to: "/contact" as const },
  { label: "Status", to: "/status" as const },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border/70 bg-surface/30">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-5 py-14 lg:flex-row lg:items-start lg:justify-between lg:px-8">
        <div className="max-w-sm space-y-4">
          <Logo />
          <p className="text-sm leading-relaxed text-muted-foreground">
            Aether is a modular AI platform: models, memory, knowledge, research, agents, projects
            and a developer API under one roof.
          </p>
        </div>
        <nav className="grid grid-cols-2 gap-x-12 gap-y-2.5 sm:grid-cols-3">
          {FOOTER_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="border-t border-border/50">
        <div className="mx-auto max-w-7xl px-5 py-5 text-xs text-muted-foreground lg:px-8">
          © {new Date().getFullYear()} Aether AI Platform. Foundation build.
        </div>
      </div>
    </footer>
  );
}
