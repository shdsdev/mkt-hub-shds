import type { NextRequest } from "next/server";
import { handleRedirect } from "@/modules/redirects";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  return handleRedirect(request, code, "qr_scan");
}
