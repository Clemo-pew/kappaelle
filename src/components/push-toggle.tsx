"use client";

import { useEffect, useState } from "react";
import { removePushSubscription, savePushSubscription, sendTestPush } from "@/app/(app)/notifiche/push-actions";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const DISMISS_KEY = "kpl-push-banner-dismissed";

type Status = "loading" | "unconfigured" | "ios-install" | "unsupported" | "denied" | "off" | "on";

function b64ToBytes(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

async function detect(): Promise<Status> {
  if (!PUBLIC_KEY) return "unconfigured";
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!supported) return isIOS() && !isStandalone() ? "ios-install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "on" : "off";
}

export function PushToggle({ variant = "card" }: { variant?: "card" | "banner" }) {
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    detect().then(setStatus).catch(() => setStatus("unsupported"));
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  async function enable() {
    setBusy(true);
    setMsg("");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setStatus(perm === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(PUBLIC_KEY) }));
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const res = await savePushSubscription(json, navigator.userAgent);
      if (res.error) throw new Error(res.error);
      setStatus("on");
      await sendTestPush();
      setMsg("Fatto! Ti ho inviato una notifica di prova.");
    } catch (e) {
      setMsg("Non è stato possibile attivare le notifiche: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMsg("");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      if ("clearAppBadge" in navigator) await navigator.clearAppBadge().catch(() => {});
      setStatus("off");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    await sendTestPush();
    setMsg("Notifica di prova inviata.");
    setBusy(false);
  }

  // Banner in cima alle pagine: compare solo quando ha senso proporre l'attivazione
  if (variant === "banner") {
    if (dismissed || !(status === "off" || status === "ios-install")) return null;
    const close = () => {
      setDismissed(true);
      try {
        localStorage.setItem(DISMISS_KEY, "1");
      } catch {}
    };
    return (
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-brand/20 bg-brand/5 px-4 py-3 text-sm">
        <span className="text-lg" aria-hidden>🔔</span>
        <span className="min-w-0 flex-1">
          {status === "ios-install" ? (
            <>
              Per ricevere le notifiche su iPhone: tocca <b>Condividi</b> → <b>Aggiungi alla schermata Home</b>, poi apri
              Kappaelle dall&apos;icona.
            </>
          ) : (
            <>Attiva le notifiche per sapere subito quando ti assegnano un task o ti menzionano.</>
          )}
        </span>
        {status === "off" && (
          <button onClick={enable} disabled={busy} className="btn-primary py-1.5">
            {busy ? "Attivazione…" : "Attiva"}
          </button>
        )}
        <button onClick={close} className="text-muted hover:text-ink" aria-label="Chiudi">✕</button>
        {msg && <p className="w-full text-xs text-muted">{msg}</p>}
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">Notifiche su questo dispositivo</h2>
          <p className="mt-0.5 text-sm text-muted">
            {status === "loading" && "Verifica in corso…"}
            {status === "on" && "Attive. Riceverai nuovi task e menzioni anche ad app chiusa, con il numero sull'icona."}
            {status === "off" && "Ricevi un avviso per i nuovi task e le menzioni, anche ad app chiusa."}
            {status === "denied" &&
              "Le notifiche sono bloccate per questo sito. Riattivale dalle impostazioni del browser o del telefono, poi ricarica la pagina."}
            {status === "ios-install" &&
              "Su iPhone le notifiche funzionano solo dall'app installata: tocca Condividi → Aggiungi alla schermata Home, poi apri Kappaelle dall'icona e torna qui."}
            {status === "unsupported" && "Questo browser non supporta le notifiche push."}
            {status === "unconfigured" && "Le notifiche push non sono ancora configurate sul server (chiavi VAPID mancanti)."}
          </p>
        </div>
        <div className="flex gap-2">
          {status === "off" && (
            <button onClick={enable} disabled={busy} className="btn-primary">
              {busy ? "Attivazione…" : "Attiva notifiche"}
            </button>
          )}
          {status === "on" && (
            <>
              <button onClick={test} disabled={busy} className="btn-ghost">Prova</button>
              <button onClick={disable} disabled={busy} className="btn-ghost">Disattiva</button>
            </>
          )}
        </div>
      </div>
      {msg && <p className="mt-2 text-sm text-ok">{msg}</p>}
    </div>
  );
}
