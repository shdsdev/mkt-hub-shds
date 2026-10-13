"use client";

import { useEffect } from "react";

const MIN_HEIGHT = 320;
const MAX_HEIGHT = 10000;

export function ResizeBridge() {
  useEffect(() => {
    const parentOrigin = document.referrer ? new URL(document.referrer).origin : "*";
    const sendHeight = () => {
      const height = Math.ceil(Math.max(document.body.scrollHeight, document.documentElement.scrollHeight));
      if (height < MIN_HEIGHT || height > MAX_HEIGHT) return;
      window.parent.postMessage({ type: "event-registration:resize", height }, parentOrigin);
    };

    const observer = new ResizeObserver(sendHeight);
    observer.observe(document.body);
    sendHeight();
    return () => observer.disconnect();
  }, []);

  return null;
}
