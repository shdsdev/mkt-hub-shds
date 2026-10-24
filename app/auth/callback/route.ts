import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/modules/auth";
import { isActive } from "@/modules/users";

// Consumes the Supabase invitation link: exchanges the one-time code for a session and routes the
// recipient to password setup. Provider codes, tokens, and errors are never returned to the client.
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const tokenType = requestUrl.searchParams.get("type");
  const provider = requestUrl.searchParams.get("provider");
  const requestedNext = requestUrl.searchParams.get("next");
  // Open-redirect guard: `startsWith("/") && !startsWith("//")` alone still lets
  // `next=/\evil.com` through — some browsers resolve a leading `/\` as protocol-relative,
  // sending the recipient off this origin. Resolve against the request's own origin and verify
  // the result actually stayed on it, rather than pattern-matching the raw string.
  let next = "/password-setup";
  if (requestedNext?.startsWith("/") && !requestedNext.startsWith("//") && !requestedNext.includes("\\")) {
    const resolved = new URL(requestedNext, requestUrl);
    if (resolved.origin === requestUrl.origin) {
      next = resolved.pathname + resolved.search;
    }
  }
  if (!code && !(tokenHash && (tokenType === "invite" || tokenType === "recovery"))) {
    return NextResponse.redirect(new URL("/login?error=invitation", request.url));
  }

  const supabase = await createClient();
  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({ type: tokenType!, token_hash: tokenHash! });
  if (error) {
    return NextResponse.redirect(new URL("/login?error=invitation", request.url));
  }

  if (provider === "google") {
    try {
      const user = await getCurrentUser();
      if (!user || !isActive(user.profile)) throw new Error("Google profile is not authorized");
      if (user.profile.role === "RECEPTION") next = "/events";
    } catch {
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL("/login?error=google_access", request.url));
    }
  }

  return NextResponse.redirect(new URL(next, request.url));
}
