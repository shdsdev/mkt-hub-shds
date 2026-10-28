"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";
import { startThemeReveal } from "./theme-transition";

type ThemeAction = (formData: FormData) => Promise<void>;

function ThemeSwitchButton({ targetThemeMode }: { targetThemeMode: "light" | "dark" }) {
  const { pending } = useFormStatus();
  const targetIsDark = targetThemeMode === "dark";

  return (
    <button
      type="submit"
      role="switch"
      aria-checked={targetIsDark}
      aria-label={targetIsDark ? "Cambiar a Lark Orange" : "Cambiar a Carbon"}
      disabled={pending}
      className={cn(
        "relative flex h-7 w-14 items-center justify-between rounded-full border border-border/70 bg-input/50 px-1.5 outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-wait disabled:opacity-60 motion-reduce:transition-none",
      )}
    >
      <SunIcon aria-hidden="true" className={cn("absolute left-1.5 size-3.5 transition-all duration-200", targetIsDark ? "text-muted-foreground/70" : "scale-110 text-foreground", "motion-reduce:transition-none")} />
      <MoonIcon aria-hidden="true" className={cn("absolute right-1.5 size-3.5 transition-all duration-200", targetIsDark ? "scale-110 text-foreground" : "text-muted-foreground/70", "motion-reduce:transition-none")} />
      <span
        aria-hidden="true"
        className={cn(
          "absolute left-1 top-1 size-5 rounded-full border border-border/60 bg-background shadow-sm transition-transform duration-300 ease-out",
          targetIsDark ? "translate-x-7" : "translate-x-0",
          "motion-reduce:transition-none",
        )}
      />
    </button>
  );
}

export default function ThemeSwitch({ action, targetThemeId, targetThemeMode }: { action: ThemeAction; targetThemeId: string; targetThemeMode: "light" | "dark" }) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        const trigger = event.currentTarget.querySelector("button");
        if (trigger) startThemeReveal(targetThemeId, trigger);
      }}
      className="flex justify-center"
    >
      <input type="hidden" name="themeId" value={targetThemeId} />
      <ThemeSwitchButton targetThemeMode={targetThemeMode} />
    </form>
  );
}
