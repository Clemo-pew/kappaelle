"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const POLL_MS = 30_000;

export function Bell({ initial }: { initial: number }) {
  const [unread, setUnread] = useState(initial);
  const pathname = usePathname();

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/notifiche", { cache: "no-store" });
      if (res.ok) setUnread((await res.json()).unread ?? 0);
    } catch {
      // rete assente: riprova al prossimo giro
    }
  }, []);

  // aggiorna a ogni cambio pagina, ogni 30s e quando si torna sulla scheda
  useEffect(() => {
    refresh();
  }, [pathname, refresh]);

  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_MS);
    const onVis = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refresh]);

  // Numero sull'icona dell'app installata (iPhone dalla schermata Home, Chrome/Edge desktop)
  useEffect(() => {
    const nav = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (!nav.setAppBadge) return;
    (unread > 0 ? nav.setAppBadge(unread) : nav.clearAppBadge?.())?.catch(() => {});
  }, [unread]);

  const active = pathname.startsWith("/notifiche");

  return (
    <Link
      href="/notifiche"
      aria-label={unread ? `Notifiche: ${unread} non lette` : "Notifiche"}
      className={`relative flex h-9 w-9 items-center justify-center rounded-lg transition ${
        active ? "bg-stone-900 text-white" : "text-muted hover:bg-stone-100 hover:text-ink"
      }`}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {unread > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-semibold text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
