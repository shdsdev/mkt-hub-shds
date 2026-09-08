import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  const { response } = await updateSession(request);
  return response;
}

export const config = {
  matcher: [
    // Skip static assets, image optimization files, and the redirect hot path — the redirect
    // engine must stay free of auth/rendering middleware (ARCHITECTURE.md NFR-01, Data Flow).
    "/((?!_next/static|_next/image|favicon.ico|r/|q/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
