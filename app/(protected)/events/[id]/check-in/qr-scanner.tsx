"use client";

import { useEffect, useRef } from "react";
import { BrowserQRCodeReader } from "@zxing/browser";

export function QrScanner({ active, onDetected, onError }: { active: boolean; onDetected: (code: string) => void; onError: (message: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDetectedRef = useRef(onDetected);
  const onErrorRef = useRef(onError);
  onDetectedRef.current = onDetected;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!active || !videoRef.current) return;
    const videoElement = videoRef.current;
    const reader = new BrowserQRCodeReader();
    let stopped = false;
    let controls: { stop: () => void } | undefined;

    void reader
      .decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } } },
        videoElement,
        (result) => {
          if (!result || stopped) return;
          stopped = true;
          controls?.stop();
          onDetectedRef.current(result.getText());
        },
      )
      .then((nextControls) => {
        controls = nextControls;
        if (stopped) controls.stop();
      })
      .catch(() => onErrorRef.current("No se pudo acceder a la cámara. Revisa los permisos del navegador."));

    return () => {
      stopped = true;
      controls?.stop();
      const stream = videoElement.srcObject;
      if (stream instanceof MediaStream) stream.getTracks().forEach((track) => track.stop());
      videoElement.srcObject = null;
    };
  }, [active]);

  return <video ref={videoRef} autoPlay muted playsInline className="aspect-[4/3] w-full rounded-lg bg-black object-cover" aria-label="Vista previa de la cámara" />;
}
