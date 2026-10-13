import { notFound } from "next/navigation";
import { getEvent, getRegistrationByCancelToken } from "@/modules/events";
import { ConfirmCancelForm } from "./confirm-cancel-form";

// spec.md "token A cannot cancel B" / "self-cancel only via signed link" — this page only
// RENDERS the registration's current state; it never cancels on a GET (see
// getRegistrationByCancelToken's own rationale), so a prefetcher or repeat visit is always safe.
// An unknown token has nothing to show, same 404 shape as the event landing page.
export default async function CancelRegistrationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const registration = await getRegistrationByCancelToken(token);
  if (!registration) notFound();

  const event = await getEvent(registration.eventId, registration.organizationId);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 px-4 py-10">
      <h1 className="font-heading text-xl font-semibold">{event?.name ?? "Registro al evento"}</h1>
      {registration.status === "cancelled" ? (
        <p className="text-sm text-muted-foreground">Este registro ya estaba cancelado.</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            ¿Seguro que quieres cancelar tu registro a este evento?
          </p>
          <ConfirmCancelForm token={registration.cancelToken} />
        </>
      )}
    </div>
  );
}
