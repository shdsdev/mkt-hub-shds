import type { NextRequest } from "next/server";
import { handleRedirect } from "@/modules/redirects";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  return handleRedirect(request, slug, "link_click");
}
