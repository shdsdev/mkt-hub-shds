import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { getProfile } from "@/modules/users";

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;
  const restricted = pathname === "/" ||
    /^\/(admin|analytics|audit|campaigns|links|notifications|qr|settings)(\/|$)/.test(pathname);

  if (!user || !restricted) return response;

  const profile = await getProfile(user.id);
  if (profile?.role !== "RECEPTION") return response;

  // Never redirect a mutation: a 307 would replay its method and body at /events.
  const blockedResponse = request.method === "GET" || request.method === "HEAD"
    ? NextResponse.redirect(new URL("/events", request.url))
    : new NextResponse(null, { status: 403 });
  for (const cookie of response.cookies.getAll()) {
    blockedResponse.cookies.set(cookie);
  }
  return blockedResponse;
}

export const config = {
  matcher: [
    // Skip static assets, image optimization files, and the redirect hot path — the redirect
    // engine must stay free of auth/rendering middleware (ARCHITECTURE.md NFR-01, Data Flow).
    "/((?!_next/static|_next/image|favicon.ico|r/|q/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    // Protected downloads must not bypass the policy through an image extension.
    "/:module(admin|analytics|audit|campaigns|links|notifications|qr|settings)/:path*",
  ],
};
