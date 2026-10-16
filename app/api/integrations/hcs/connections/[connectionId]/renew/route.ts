import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { errorResponse, renewHcsConnection } from "@/modules/integrations";
import { validateLifecycleRequest } from "../lifecycle";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> },
) {
  const { connectionId } = await params;
  const validation = await validateLifecycleRequest(request, connectionId);
  if ("response" in validation) return validation.response;

  const expiresAt = new Date(Date.now() + env.HCS_CONNECTION_EXPIRY_DAYS * 86_400_000);
  try {
    const result = await renewHcsConnection({
      organizationId: validation.connection.organizationId,
      connectionId,
      expiresAt,
    });

    return NextResponse.json({
      connectionId: result.connection.id,
      accessToken: result.accessToken,
      expiresAt: (result.connection.expiresAt ?? expiresAt).toISOString(),
    });
  } catch {
    return errorResponse(409);
  }
}
