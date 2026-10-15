import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Consumes the Supabase invitation link: exchanges the one-time code for a session and routes the
// recipient to password setup. Provider codes, tokens, and errors are never returned to the client.
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const requestedNext = requestUrl.searchParams.get("next");
  const next = requestedNext?.startsWith("/") && !requestedNext.startsWith("//")
    ? requestedNext
    : "/password-setup";
  if (!code) {
    return NextResponse.redirect(new URL("/login?error=invitation", request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/login?error=invitation", request.url));
  }

  return NextResponse.redirect(new URL(next, request.url));
}
