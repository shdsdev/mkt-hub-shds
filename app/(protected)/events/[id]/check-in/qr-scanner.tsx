"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { decodeQrFrame } from "./qr-frame-decoder";

type ScannerOwner = "check-in" | "benefit";
type ScannerCoordinator = { activeOwner: ScannerOwner | null; claim: (owner: ScannerOwner) => void; release: (owner: ScannerOwner) => void };

export function canOwnScanner(activeOwner: ScannerOwner | null, owner: ScannerOwner) {
  return activeOwner === null || activeOwner === owner;
}

const ScannerCoordinatorContext = createContext<ScannerCoordinator>({
  activeOwner: null,
  claim: () => undefined,
  release: () => undefined,
});

export function ScannerCoordinatorProvider({ children }: { children: ReactNode }) {
  const [activeOwner, setActiveOwner] = useState<ScannerOwner | null>(null);
  const value = {
    activeOwner,
    claim: (owner: ScannerOwner) => setActiveOwner(owner),
    release: (owner: ScannerOwner) => setActiveOwner((current) => current === owner ? null : current),
  };
  return <ScannerCoordinatorContext.Provider value={value}>{children}</ScannerCoordinatorContext.Provider>;
}

export function useScannerCoordinator() {
  return useContext(ScannerCoordinatorContext);
}

export function QrScanner({ active, onDetected, onError }: { active: boolean; onDetected: (code: string) => void; onError: (message: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDetectedRef = useRef(onDetected);
  const onErrorRef = useRef(onError);
  onDetectedRef.current = onDetected;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!active || !videoRef.current) return;
    const videoElement = videoRef.current;
    const canvas = document.createElement("canvas");
    const frameContext = canvas.getContext("2d", { willReadFrequently: true });
    if (!frameContext) {
      onErrorRef.current("El navegador no puede preparar la lectura de la cámara.");
      return;
    }
    const context = frameContext;
    let stopped = false;
    let animationFrame = 0;
    let stream: MediaStream | undefined;
    let lastScanAt = 0;

    function stop() {
      stopped = true;
      cancelAnimationFrame(animationFrame);
      stream?.getTracks().forEach((track) => track.stop());
      videoElement.srcObject = null;
    }

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("camera_unavailable");
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            height: { ideal: 720 },
            width: { ideal: 1280 },
          },
        });
        if (stopped) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        videoElement.srcObject = stream;
        videoElement.muted = true;
        videoElement.playsInline = true;
        await videoElement.play();

        function scan(timestamp: number) {
          if (stopped) return;
          if (timestamp - lastScanAt >= 100 && videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
            lastScanAt = timestamp;
            if (canvas.width !== videoElement.videoWidth || canvas.height !== videoElement.videoHeight) {
              canvas.width = videoElement.videoWidth;
              canvas.height = videoElement.videoHeight;
            }
            context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
            const result = decodeQrFrame(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
            if (result) {
              stop();
              onDetectedRef.current(result);
              return;
            }
          }
          animationFrame = requestAnimationFrame(scan);
        }

        animationFrame = requestAnimationFrame(scan);
      } catch {
        if (!stopped) onErrorRef.current("No se pudo acceder a la cámara. Revisa los permisos del navegador.");
      }
    }

    void start();

    return () => {
      stop();
    };
  }, [active]);

  return (
    <div className="w-full">
      <video ref={videoRef} autoPlay muted playsInline className="aspect-[4/3] w-full rounded-lg bg-black object-cover" aria-label="Vista previa de la cámara" />
      <p className="mt-3 text-center text-sm font-medium text-muted-foreground" role="status" aria-live="polite">
        {active ? "Escaneando QR…" : "Procesando QR…"}
      </p>
    </div>
  );
}
