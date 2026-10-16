import { NextResponse, type NextRequest } from "next/server";
import { getEvent } from "@/modules/events";
import { getRaffleForEvent } from "@/modules/raffles";
import { authenticateHcsRequest, errorResponse } from "@/modules/integrations";

export async function GET(request: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  let auth;
  try {
    auth = await authenticateHcsRequest(request);
  } catch (error) {
    return errorResponse(error);
  }

  const { eventId } = await params;
  const event = await getEvent(eventId, auth.connection.organizationId);
  if (!event) return errorResponse(404);

  const raffle = await getRaffleForEvent(eventId, auth.connection.organizationId);
  if (!raffle) return errorResponse(404);

  return NextResponse.json({
    event: { id: event.id, name: event.name, status: event.status },
    raffle: { id: raffle.id, status: raffle.status },
    capabilities: { canValidate: true, canClaim: true, canResend: true },
  });
}
