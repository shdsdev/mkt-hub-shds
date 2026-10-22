import Link from "next/link";
import type { UserRole } from "@/modules/users";

// Shared cross-navigation between an event's admin pages — none of these pages linked to each
// other before (found via user feedback: "no sé cómo llegar a los registros/check-in/dashboard").
export function EventSubNav({ eventId, current, role }: { eventId: string; current: "edit" | "registrations" | "dashboard" | "check-in" | "internal-form" | "raffle" | "questions"; role: UserRole }) {
  const tabs = [
    { key: "edit", label: "Editar", href: `/events/${eventId}/edit` },
    { key: "registrations", label: "Registros", href: `/events/${eventId}/registrations` },
    { key: "check-in", label: "Check-in", href: `/events/${eventId}/check-in` },
    { key: "internal-form", label: "Formulario interno", href: `/events/${eventId}/internal-form` },
    { key: "raffle", label: "Sorteo", href: `/events/${eventId}/raffle` },
    { key: "questions", label: "Preguntas", href: `/events/${eventId}/questions` },
    { key: "dashboard", label: "Resultados", href: `/events/${eventId}/dashboard` },
  ].filter((tab) =>
    role === "ADMIN" ||
    role === "EVENT_EDITOR" ||
    (role === "RECEPTION" && (tab.key === "registrations" || tab.key === "check-in" || tab.key === "internal-form")),
  );

  return (
    <nav className="w-full overflow-x-auto border-b border-border text-sm">
      <div className="flex min-w-max w-max justify-start gap-1 p-1 sm:mx-auto sm:justify-center">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={tab.key === current ? "page" : undefined}
            className={
              tab.key === current
                ? "flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap border-b-2 border-primary px-4 py-2 text-center font-medium text-foreground outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50"
                : "flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap border-b-2 border-transparent px-4 py-2 text-center text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            }
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
