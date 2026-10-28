"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { UserRole } from "@/modules/users";

// Shared cross-navigation between an event's admin pages — none of these pages linked to each
// other before (found via user feedback: "no sé cómo llegar a los registros/check-in/dashboard").
export function EventSubNav({ eventId, current, role }: { eventId: string; current: "edit" | "registrations" | "dashboard" | "check-in" | "internal-form" | "raffle" | "questions" | "audit"; role: UserRole }) {
  const activeTabRef = useRef<HTMLAnchorElement>(null);
  const tabs = [
    { key: "edit", label: "Editar", href: `/events/${eventId}/edit` },
    { key: "registrations", label: "Registros", href: `/events/${eventId}/registrations` },
    { key: "check-in", label: "Check-in", href: `/events/${eventId}/check-in` },
    { key: "internal-form", label: "Formulario interno", href: `/events/${eventId}/internal-form` },
    { key: "raffle", label: "Sorteo", href: `/events/${eventId}/raffle` },
    { key: "questions", label: "Preguntas", href: `/events/${eventId}/questions` },
    { key: "dashboard", label: "Resultados", href: `/events/${eventId}/dashboard` },
    { key: "audit", label: "Historial", href: `/events/${eventId}/audit` },
  ].filter((tab) =>
    role === "ADMIN" ||
    role === "EVENT_EDITOR" ||
    (role === "RECEPTION" && (tab.key === "registrations" || tab.key === "check-in" || tab.key === "internal-form" || tab.key === "dashboard")),
  );

  useEffect(() => {
    const activeTab = activeTabRef.current;
    const tabList = activeTab?.parentElement;
    if (!activeTab || !tabList || tabList.scrollWidth <= tabList.clientWidth) return;

    const targetLeft = activeTab.offsetLeft - (tabList.clientWidth - activeTab.offsetWidth) / 2;
    tabList.scrollTo({ left: Math.max(0, targetLeft), behavior: "smooth" });
  }, [current]);

  return (
    <nav className="max-w-full overflow-x-auto overscroll-x-contain text-sm [scrollbar-width:thin]">
      <div className="mx-auto flex w-max min-w-max justify-start gap-0.5 rounded-xl border border-border bg-muted/40 p-1 sm:gap-1 sm:p-1">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            ref={tab.key === current ? activeTabRef : undefined}
            href={tab.href}
            aria-current={tab.key === current ? "page" : undefined}
            className={
              tab.key === current
                ? "flex min-h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-lg bg-accent px-3 py-2 text-center font-medium text-accent-foreground shadow-sm ring-1 ring-accent/60 outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 sm:px-4"
                : "flex min-h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-lg px-3 py-2 text-center text-muted-foreground outline-none transition-colors hover:bg-background/70 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 sm:px-4"
            }
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
