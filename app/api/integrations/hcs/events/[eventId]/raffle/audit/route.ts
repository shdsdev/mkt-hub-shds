import { NextResponse, type NextRequest } from "next/server";
import { getEvent } from "@/modules/events";
import { authenticateHcsRequest, errorResponse } from "@/modules/integrations";
import { getRaffleForEvent, listRaffleAudit } from "@/modules/raffles";

const SAFE_METADATA_KEYS = ["reason", "previousStatus", "status", "requestId", "connectionId", "note"] as const;

function projectMetadata(metadata: Record<string, unknown>) {
  return Object.fromEntries(
    SAFE_METADATA_KEYS.flatMap((key) => {
      const value = metadata[key];
      return typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null
        ? [[key, value]]
        : [];
    }),
  );
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  let auth;
  try {
    auth = await authenticateHcsRequest(_request);
  } catch (error) {
    return errorResponse(error);
  }

  const { eventId } = await params;
  const organizationId = auth.connection.organizationId;

  try {
    const event = await getEvent(eventId, organizationId);
    if (!event) return errorResponse(404);

    const raffle = await getRaffleForEvent(eventId, organizationId);
    if (!raffle) return errorResponse(404);

    const audit = await listRaffleAudit({ raffleId: raffle.id, eventId, organizationId });
    return NextResponse.json({
      audit: audit.map((entry) => ({
        id: entry.id,
        action: entry.action,
        prizeId: entry.prizeId,
        drawId: entry.drawId,
        createdAt: entry.createdAt.toISOString(),
        actorId: entry.actorExternalId ?? null,
        actorSource: entry.actorSource,
        metadata: projectMetadata(entry.metadata),
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
