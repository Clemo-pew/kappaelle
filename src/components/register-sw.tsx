"use client";

import { useEffect } from "react";

/** Registra il service worker (serve per installazione, badge e notifiche push). */
export function RegisterSW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((e) => {
      console.warn("Service worker non registrato:", e);
    });
  }, []);
  return null;
}
