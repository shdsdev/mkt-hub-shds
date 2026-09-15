"use client";

import { type ReactNode } from "react";
import { motion } from "motion/react";
import { ChevronLeft } from "lucide-react";

// Rewritten from the installed shadcn "onboarding-screen" component (visual reference only — the
// card shape, spring-animated progress bar, back button, and split layout). Everything else
// (copy, fields, the right-panel content) is QR-specific and lives in the caller: this shell owns
// chrome, not content. Uses this app's own color tokens (bg-card/border-border/etc.) instead of
// the source's hardcoded light/dark literals, since this app doesn't use a light/dark toggle —
// see docs/ARCHITECTURE.md's theming notes.
export function QrWizardShell({
  step,
  totalSteps,
  title,
  subtitle,
  onBack,
  preview,
  children,
}: {
  step: number;
  totalSteps: number;
  title: string;
  subtitle: string;
  onBack?: () => void;
  preview: ReactNode;
  children: ReactNode;
}) {
  const spring = { type: "spring", stiffness: 300, damping: 30 } as const;
  const progressSpring = { type: "spring", stiffness: 100, damping: 20 } as const;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={spring}
      className="flex w-full flex-col overflow-hidden rounded-[32px] border border-border bg-card p-2 shadow-xl md:h-[36rem] md:flex-row"
    >
      {/* Left: step chrome + form content */}
      <div className="flex flex-[1.2] flex-col justify-center rounded-[26px] px-8 py-10 md:rounded-l-[26px] md:rounded-r-none md:px-12">
        <div className="mx-auto w-full max-w-md space-y-6">
          <div className="flex items-center gap-3">
            {onBack && (
              <motion.button
                type="button"
                onClick={onBack}
                whileTap={{ scale: 0.95 }}
                className="shrink-0 rounded-xl border border-border bg-background p-2 text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft size={18} />
              </motion.button>
            )}
            <div>
              <h2 className="font-heading text-lg font-semibold">{title}</h2>
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            </div>
          </div>

          <div className="flex gap-2">
            {Array.from({ length: totalSteps }, (_, index) => index + 1).map((i) => (
              <div key={i} className="relative h-1 flex-1 overflow-hidden rounded-full bg-muted">
                <motion.div
                  animate={{ width: i <= step ? "100%" : "0%" }}
                  transition={progressSpring}
                  className="absolute top-0 left-0 h-full bg-primary"
                />
              </div>
            ))}
          </div>

          <div className="max-h-[26rem] space-y-4 overflow-y-auto pr-1">{children}</div>
        </div>
      </div>

      {/* Right: live preview */}
      <div className="relative hidden flex-1 flex-col items-center justify-center rounded-[26px] border border-border bg-background p-8 md:flex md:rounded-l-none md:rounded-r-[26px]">
        {preview}
      </div>
    </motion.div>
  );
}
