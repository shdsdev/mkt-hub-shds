"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

export function QuestionLiveRefresh({ children }: { children: ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const interval = window.setInterval(() => router.refresh(), 3000);
    return () => window.clearInterval(interval);
  }, [router]);

  return children;
}
