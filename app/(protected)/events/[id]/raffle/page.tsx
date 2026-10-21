import { notFound } from "next/navigation";
import { getCurrentUser } from "@/modules/auth";
import { canAccessEvent, getEvent, listRegistrations } from "@/modules/events";
import { isActive } from "@/modules/users";
import { getOrCreateRaffle, listRaffleAudit, listRaffleDraws, listRafflePrizes } from "@/modules/raffles";
import { EventSubNav } from "../../event-sub-nav";
import { RaffleManagement } from "./raffle-management";

export default async function RafflePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isActive(user.profile)) notFound();
  const { id } = await params;
  const event = await getEvent(id, user.profile.organizationId);
  if (!event) notFound();
  if (!(await canAccessEvent({ userId: user.id, organizationId: user.profile.organizationId, role: user.profile.role, eventId: event.id, capability: "raffle" }))) notFound();

  const raffle = await getOrCreateRaffle(event.id, user.profile.organizationId, user.id);
  const [prizes, draws, audit, registrations] = await Promise.all([
    listRafflePrizes({ raffleId: raffle.id, organizationId: user.profile.organizationId }),
    listRaffleDraws({ raffleId: raffle.id, eventId: event.id, organizationId: user.profile.organizationId }),
    listRaffleAudit({ raffleId: raffle.id, eventId: event.id, organizationId: user.profile.organizationId }),
    listRegistrations(event.id, user.profile.organizationId),
  ]);

  const filterOptions = {
    occupations: [...new Set(registrations.flatMap((registration) => registration.attendees.map((attendee) => attendee.occupation).filter((value): value is string => Boolean(value))))].sort(),
    clientBrands: [...new Set(registrations.flatMap((registration) => registration.clientBrands ?? []))].sort(),
    interests: [...new Set(registrations.flatMap((registration) => registration.interests ?? []))].sort(),
  };

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-10">
      <EventSubNav eventId={event.id} current="raffle" role={user.profile.role} />
      <RaffleManagement event={event} raffle={raffle} prizes={prizes} draws={draws} audit={audit} filterOptions={filterOptions} />
    </div>
  );
}
