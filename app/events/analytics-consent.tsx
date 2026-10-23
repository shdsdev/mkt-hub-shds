"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

const CONSENT_STORAGE_KEY = "marketing-hub-analytics-consent";
const MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]+$/;
type AnalyticsConsentState = "granted" | "denied";

export function AnalyticsConsent({ gaId }: { gaId: string }) {
  const [hydrated, setHydrated] = useState(false);
  const [consent, setConsent] = useState<AnalyticsConsentState>();
  const measurementId = MEASUREMENT_ID_PATTERN.test(gaId) ? gaId : "";

  useEffect(() => {
    const stored = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (stored === "granted" || stored === "denied") setConsent(stored);
    setHydrated(true);
  }, []);

  function updateConsent(nextConsent: AnalyticsConsentState) {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, nextConsent);
    setConsent(nextConsent);
  }

  if (!measurementId || !hydrated || consent === "denied") return null;

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
        <p className="text-sm font-semibold">Privacidad y analíticas</p>
        <p className="mt-1 text-xs leading-5 text-[#5a5752]">
          Usamos Google Analytics para entender cómo se utiliza este formulario y mejorar la experiencia. No es necesario para registrarte.
        </p>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          className="rounded-full border border-[#202020]/20 px-3 py-2 text-xs font-medium transition-colors hover:bg-[#202020]/5"
          onClick={() => updateConsent("denied")}
        >
          No, gracias
        </button>
        <button
          type="button"
          className="rounded-full bg-[#202020] px-3 py-2 text-xs font-medium text-white transition-opacity hover:opacity-85"
          onClick={() => updateConsent("granted")}
        >
          Aceptar analíticas
        </button>
      </div>
    </aside>
  );
}
