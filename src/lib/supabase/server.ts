import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

// Server Components / Server Actions / Route Handlers client — reads/writes the auth cookie via
// Next.js's cookies() API. Session refresh happens in middleware.ts, not here.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component that can't set cookies — middleware.ts refreshes
          // the session instead, so this is safe to ignore.
        }
      },
    },
  });
}
