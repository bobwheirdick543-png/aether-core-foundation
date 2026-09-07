import type { ReactNode } from "react";
import { SiteHeader, SiteFooter } from "@/components/layout/SiteChrome";
import { Section } from "@/components/marketing/Sections";

export function InfoPage({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <Section eyebrow={eyebrow} title={title} description={description} className="border-t-0">
        {children}
      </Section>
      <SiteFooter />
    </div>
  );
}
