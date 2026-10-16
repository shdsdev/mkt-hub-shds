import { NextResponse, type NextRequest } from "next/server";
import { listEvents } from "@/modules/events";
import { getRaffleForEvent, listRafflePrizes } from "@/modules/raffles";
import { authenticateHcsRequest, errorResponse } from "@/modules/integrations";

const allowedStatuses = new Set(["published", "closed"]);

function parseStatuses(request: NextRequest): Set<string> | undefined {
  const values = new URL(request.url).searchParams.getAll("status");
  if (values.length === 0) return new Set(["published"]);
  const statuses = new Set(values.flatMap((value) => value.split(",").map((item) => item.trim()).filter(Boolean)));
  return statuses.size > 0 && [...statuses].every((status) => allowedStatuses.has(status)) ? statuses : undefined;
}

export async function GET(request: NextRequest) {
  let auth;
  try {
    auth = await authenticateHcsRequest(request);
  } catch (error) {
    return errorResponse(error);
  }

  const statuses = parseStatuses(request);
  if (!statuses) return errorResponse(400);

  try {
    const events = await listEvents(auth.connection.organizationId);
    const visibleEvents = events.filter((event) => statuses.has(event.status));
    const responseEvents = await Promise.all(visibleEvents.map(async (event) => {
      const raffle = await getRaffleForEvent(event.id, auth.connection.organizationId);
      if (!raffle) {
        return {
          id: event.id,
          name: event.name,
          startsAt: event.startsAt.toISOString(),
          status: event.status,
          raffle: { configured: false, hasAvailablePrizes: false, status: "not_configured" },
        };
      }
      const prizes = await listRafflePrizes({ raffleId: raffle.id, organizationId: auth.connection.organizationId });
      return {
        id: event.id,
        name: event.name,
        startsAt: event.startsAt.toISOString(),
        status: event.status,
        raffle: {
          configured: true,
          hasAvailablePrizes: prizes.some((prize) => prize.drawnQuantity < prize.quantity && prize.status !== "paused" && prize.status !== "finished"),
          status: raffle.status,
        },
      };
    }));
    return NextResponse.json({ events: responseEvents });
  } catch {
    return errorResponse(400);
  }
}
