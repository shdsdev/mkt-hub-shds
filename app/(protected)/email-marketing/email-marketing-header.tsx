"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type EmailMarketingSection = "campaigns" | "contacts" | "segments";

const sections: Array<{ key: EmailMarketingSection; label: string; href: string }> = [
  { key: "campaigns", label: "Campañas", href: "/email-marketing" },
  { key: "contacts", label: "Contactos", href: "/email-marketing/contacts" },
  { key: "segments", label: "Segmentos", href: "/email-marketing/segments" },
];

export function EmailMarketingHeader({
  active,
  eyebrow,
  title,
  description,
  action,
}: {
  active: EmailMarketingSection;
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="border-b border-border pb-6 sm:pb-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
          <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <nav className="mt-7 flex w-fit max-w-full gap-1 overflow-x-auto rounded-full border border-border p-1" aria-label="Email Marketing">
        {sections.map((section) => (
          <Link
            key={section.key}
            href={section.href}
            aria-current={active === section.key ? "page" : undefined}
            className={active === section.key
              ? "whitespace-nowrap rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              : "whitespace-nowrap rounded-full px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"}
          >
            {section.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
