import Link from "next/link";
import type { UserRole } from "@/modules/users";

// Shared cross-navigation between an event's admin pages — none of these pages linked to each
// other before (found via user feedback: "no sé cómo llegar a los registros/check-in/dashboard").
export function EventSubNav({ eventId, current, role }: { eventId: string; current: "edit" | "registrations" | "dashboard" | "check-in" | "internal-form"; role: UserRole }) {
  const tabs = [
    { key: "edit", label: "Editar", href: `/events/${eventId}/edit` },
    { key: "registrations", label: "Registros", href: `/events/${eventId}/registrations` },
    { key: "check-in", label: "Check-in", href: `/events/${eventId}/check-in` },
    { key: "internal-form", label: "Formulario interno", href: `/events/${eventId}/internal-form` },
    { key: "dashboard", label: "Resultados", href: `/events/${eventId}/dashboard` },
  ].filter((tab) => role === "ADMIN" || tab.key === "registrations" || tab.key === "check-in");

  return (
    <nav className="flex gap-1 border-b border-border text-sm">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={
            tab.key === current
              ? "border-b-2 border-primary px-3 py-2 font-medium text-foreground"
              : "border-b-2 border-transparent px-3 py-2 text-muted-foreground hover:text-foreground"
          }
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
