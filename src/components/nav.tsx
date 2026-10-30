"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { logout } from "@/app/login/actions";

type Item = { href: string; label: string };

function useIsActive() {
  const pathname = usePathname();
  return (href: string) =>
    href === "/admin" ? pathname === "/admin" || pathname.startsWith("/admin/task") || pathname.startsWith("/admin/importa") : pathname.startsWith(href);
}

/** Menu orizzontale: visibile da tablet/desktop in su. */
export function Nav({ items }: { items: Item[] }) {
  const isActive = useIsActive();
  return (
    <nav className="hidden gap-1 md:flex">
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition ${
            isActive(it.href) ? "bg-stone-900 text-white" : "text-muted hover:bg-stone-100 hover:text-ink"
          }`}
        >
          {it.label}
        </Link>
      ))}
    </nav>
  );
}

/** Menu hamburger: visibile solo su mobile. */
export function MobileMenu({ items, userName }: { items: Item[]; userName: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isActive = useIsActive();
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // chiude al cambio pagina
  useEffect(() => setOpen(false), [pathname]);

  // chiude con Esc o toccando fuori; blocca lo scroll della pagina sotto
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !buttonRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const all = [...items, { href: "/notifiche", label: "Notifiche" }];

  return (
    <div className="md:hidden">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "Chiudi menu" : "Apri menu"}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-ink hover:bg-stone-100"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          {open ? (
            <>
              <path d="M6 6l12 12" />
              <path d="M18 6L6 18" />
            </>
          ) : (
            <>
              <path d="M4 7h16" />
              <path d="M4 12h16" />
              <path d="M4 17h16" />
            </>
          )}
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-x-0 bottom-0 top-[var(--header-h)] z-30 bg-black/20" aria-hidden />
          <div
            ref={panelRef}
            id="mobile-menu"
            className="fixed inset-x-0 top-[var(--header-h)] z-40 max-h-[calc(100dvh-var(--header-h))] overflow-y-auto border-b border-line bg-white shadow-lg"
          >
            <nav className="flex flex-col p-2">
              {all.map((it) => (
                <Link
                  key={it.href}
                  href={it.href}
                  onClick={() => setOpen(false)}
                  className={`rounded-lg px-4 py-3 text-base transition ${
                    isActive(it.href) ? "bg-brand/10 font-semibold text-brand" : "text-ink hover:bg-stone-100"
                  }`}
                >
                  {it.label}
                </Link>
              ))}
            </nav>
            <div className="flex items-center justify-between gap-3 border-t border-line px-6 py-4">
              <span className="truncate text-sm text-muted">{userName}</span>
              <form action={logout}>
                <button className="btn-ghost">Esci</button>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
