import { notFound } from "next/navigation";
import { getCurrentUser } from "@/modules/auth";
import { isActive } from "@/modules/users";
import { canAccessEvent, getEvent, listEventBenefitRedemptions } from "@/modules/events";
import { CheckInForm } from "./check-in-form";
import { BenefitRedemptionForm } from "./benefit-redemption-form";
import { ScannerCoordinatorProvider } from "./qr-scanner";
import { EventSubNav } from "../../event-sub-nav";

// design.md RBAC: "check-in needs any active session ... no new role" — unlike
// app/(protected)/events/[id]/edit/page.tsx, there is deliberately no isAdmin gate here.
export default async function EventCheckInPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isActive(user.profile)) notFound();

  const { id } = await params;
  const event = await getEvent(id, user.profile.organizationId);
  if (!event) notFound();
  if (!(await canAccessEvent({ userId: user.id, organizationId: user.profile.organizationId, role: user.profile.role, eventId: event.id, capability: "check-in" }))) notFound();
  const history = await listEventBenefitRedemptions(event.id);
  const canAnnulHistory = user.profile.role === "ADMIN" || user.profile.role === "EVENT_EDITOR";

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-8">
      {/* Only ADMIN sees the cross-links (Editar/Registros/Resultados are ADMIN-only pages) —
          door staff on a plain active session would just hit notFound() on those. */}
      <EventSubNav eventId={event.id} current="check-in" role={user.profile.role} />
      <ScannerCoordinatorProvider>
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6">
        <div>
          <h1 className="font-heading text-xl font-semibold">Check-in: {event.name}</h1>
          <p className="text-sm text-muted-foreground">
            Escanea el pase del asistente o escribe su código de respaldo.
          </p>
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          <CheckInForm eventId={event.id} confirmationRequired={event.checkInConfirmationRequired} />
          <BenefitRedemptionForm eventId={event.id} history={history} canAnnulHistory={canAnnulHistory} />
        </div>
      </div>
      </ScannerCoordinatorProvider>
    </div>
  );
}
