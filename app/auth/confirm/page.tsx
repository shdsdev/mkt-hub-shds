"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/password-setup";
  }

  const resolved = new URL(value, window.location.origin);
  return resolved.origin === window.location.origin
    ? resolved.pathname + resolved.search
    : "/password-setup";
}

export default function AuthConfirmPage() {
  useEffect(() => {
    let cancelled = false;

    async function confirmSession() {
      const supabase = createClient();
      const params = new URLSearchParams(window.location.search);
      const next = safeNext(params.get("next"));
      const tokenHash = params.get("token_hash");
      const tokenType = params.get("type");
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      let error: { message?: string } | null = null;

      if (tokenHash && (tokenType === "invite" || tokenType === "recovery")) {
        ({ error } = await supabase.auth.verifyOtp({
          type: tokenType,
          token_hash: tokenHash,
        }));
      } else if (params.get("code")) {
        ({ error } = await supabase.auth.exchangeCodeForSession(params.get("code")!));
      } else if (hashParams.get("access_token") && hashParams.get("refresh_token")) {
        ({ error } = await supabase.auth.setSession({
          access_token: hashParams.get("access_token")!,
          refresh_token: hashParams.get("refresh_token")!,
        }));
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) return;
      if (error || !session) {
        window.location.replace("/login?error=recovery");
        return;
      }

      window.location.replace(next);
    }

    void confirmSession().catch(() => {
      if (!cancelled) window.location.replace("/login?error=recovery");
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <p className="text-sm text-muted-foreground">Validando el enlace...</p>
    </main>
  );
}
