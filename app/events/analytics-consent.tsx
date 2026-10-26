"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

const CONSENT_STORAGE_KEY = "marketing-hub-analytics-consent";
const MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]+$/;
type AnalyticsConsentState = "granted" | "denied";

export function AnalyticsConsent({ gaId }: { gaId: string }) {
  const [hydrated, setHydrated] = useState(false);
  const [consent, setConsent] = useState<AnalyticsConsentState>();
  const [serverReady, setServerReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const measurementId = MEASUREMENT_ID_PATTERN.test(gaId) ? gaId : "";

  useEffect(() => {
    const stored = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    void fetch("/api/analytics/consent")
      .then((response) => response.json() as Promise<{ state?: AnalyticsConsentState }>)
      .then(({ state }) => {
        if (state === "granted" || state === "denied") setConsent(state);
        else if (stored === "denied") setConsent("denied");
      })
      .catch(() => {
        if (stored === "denied") setConsent("denied");
      })
      .finally(() => {
        setHydrated(true);
        setServerReady(true);
      });
  }, []);

  async function updateConsent(nextConsent: AnalyticsConsentState) {
    setSaving(true);
    setSaveError(false);
    try {
      const response = await fetch("/api/analytics/consent", {
        method: nextConsent === "denied" ? "DELETE" : "POST",
        headers: nextConsent === "granted" ? { "Content-Type": "application/json" } : undefined,
        body: nextConsent === "granted" ? JSON.stringify({ state: nextConsent }) : undefined,
      });
      if (!response.ok) {
        setSaveError(true);
        return;
      }
      window.localStorage.setItem(CONSENT_STORAGE_KEY, nextConsent);
      setConsent(nextConsent);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  if (!measurementId || !hydrated || !serverReady || consent === "denied") return null;

  if (consent === "granted") {
    return (
      <>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics-init" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){window.dataLayer.push(arguments);}
gtag('consent', 'default', {
  analytics_storage: 'granted',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied'
});
gtag('js', new Date());
	gtag('config', '${measurementId}');`}
        </Script>
        <button
          type="button"
          className="fixed bottom-3 left-3 z-50 rounded-full border border-[#202020]/20 bg-white/95 px-3 py-2 text-xs text-[#202020] shadow-sm"
          onClick={() => void updateConsent("denied")}
        >
          Cambiar privacidad
        </button>
      </>
    );
  }

  return (
    <aside
      aria-label="Consentimiento de analíticas"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-xl flex-col gap-3 rounded-2xl border border-[#202020]/15 bg-white/95 p-4 text-[#202020] shadow-[0_18px_50px_-20px_rgba(0,0,0,0.45)] backdrop-blur sm:inset-x-auto sm:right-6 sm:bottom-6"
      data-analytics-consent-banner
    >
      <div>
        <p className="text-sm font-semibold">Ayúdanos a mejorar este sitio</p>
        <p className="mt-1 text-xs leading-5 text-[#5a5752]">
          ¿Nos permites recopilar información sobre cómo usas el sitio para mejorar tu experiencia? Es opcional y puedes cambiar de opinión cuando quieras.
        </p>
      </div>
      {saveError ? <p className="text-xs font-medium text-[#A33B5D]" role="alert">No pudimos guardar tu elección. Inténtalo de nuevo.</p> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          disabled={saving}
          className="rounded-full border border-[#202020]/20 px-3 py-2 text-xs font-medium transition-colors hover:bg-[#202020]/5"
          onClick={() => updateConsent("denied")}
        >
          No, gracias
        </button>
        <button
          type="button"
          disabled={saving}
          className="rounded-full bg-[#202020] px-3 py-2 text-xs font-medium text-white transition-opacity hover:opacity-85"
          onClick={() => updateConsent("granted")}
        >
          {saving ? "Guardando..." : "Sí, acepto"}
        </button>
      </div>
    </aside>
  );
}
