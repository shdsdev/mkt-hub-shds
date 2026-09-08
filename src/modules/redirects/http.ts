import { NextResponse, type NextRequest } from "next/server";
import { resolveShortLinkByHostAndSlug, buildDestinationUrl } from "@/modules/links";
import { trackRedirect, resolveVisitor } from "@/modules/analytics";

// Shared by app/r/[slug]/route.ts and app/q/[code]/route.ts — both resolve through the same
// short_links row; only source_type differs (SPEC.md §25).
export async function handleRedirect(
  request: NextRequest,
  slug: string,
  sourceType: "link_click" | "qr_scan",
): Promise<NextResponse> {
  // request.headers.get("host") reflects the raw Host header the client sent; nextUrl.hostname
  // is derived from it but strips the port inconsistently across adapters — read it directly and
  // strip the port ourselves.
  const hostname = (request.headers.get("host") ?? "").split(":")[0];
  const resolved = await resolveShortLinkByHostAndSlug(hostname, slug);

  if (!resolved) {
    return new NextResponse(null, { status: 404 });
  }

  const destination = buildDestinationUrl(resolved.link);

  // 302 only — never 301/308 (ADR-003). No-store so a client always re-hits the server.
  const response = NextResponse.redirect(destination, {
    status: 302,
    headers: { "Cache-Control": "no-store" },
  });

  const visitorHash = resolveVisitor(request, response);

  trackRedirect({
    organizationId: resolved.link.organizationId,
    linkId: resolved.link.id,
    shortLinkId: resolved.shortLink.id,
    sourceType,
    visitorHash,
    userAgent: request.headers.get("user-agent"),
  });

  return response;
}
