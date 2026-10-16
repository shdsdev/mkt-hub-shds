import { NextResponse, type NextRequest } from "next/server";
import { revokeHcsConnection } from "@/modules/integrations";
import { errorResponse } from "@/modules/integrations";
import { validateLifecycleRequest } from "../lifecycle";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> },
) {
  const { connectionId } = await params;
  const validation = await validateLifecycleRequest(request, connectionId);
  if ("response" in validation) return validation.response;

  try {
    const connection = await revokeHcsConnection({
      organizationId: validation.connection.organizationId,
      connectionId,
    });
    if (!connection) return errorResponse(404);
    if (!connection.revokedAt) return errorResponse(409);

    return NextResponse.json({
      success: true,
      connectionId: connection.id,
      revokedAt: connection.revokedAt.toISOString(),
    });
  } catch {
    return errorResponse(409);
  }
}
