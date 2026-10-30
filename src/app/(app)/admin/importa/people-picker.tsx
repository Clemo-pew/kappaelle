"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Person } from "@/lib/csv-import";

const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

function usePopover() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);

  const place = () => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const w = 288;
    const h = pop.current?.offsetHeight ?? 320;
    const below = r.bottom + 4 + h < window.innerHeight;
    setPos({
      top: below ? r.bottom + 4 : Math.max(8, r.top - h - 4),
      left: Math.max(8, Math.min(r.left, window.innerWidth - w - 8)),
    });
  };

  useLayoutEffect(() => {
    if (open) place();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!pop.current?.contains(t) && !btn.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onMove = () => place();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open]);

  return { open, setOpen, pos, btn, pop };
}

function PeopleList({
  people,
  selected,
  toggle,
  setAll,
}: {
  people: Person[];
  selected: string[];
  toggle: (id: string) => void;
  setAll: (ids: string[]) => void;
}) {
  const [q, setQ] = useState("");
  const shown = useMemo(
    () => people.filter((p) => !q || norm(`${p.full_name} ${p.email}`).includes(norm(q))),
    [people, q],
  );
  return (
    <>
      <div className="flex items-center gap-2 border-b border-line p-2">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cerca…"
          className="input py-1.5"
          aria-label="Cerca collaboratore"
        />
      </div>
      <div className="flex justify-between px-3 py-1.5 text-xs">
        <button type="button" onClick={() => setAll(people.map((p) => p.id))} className="text-brand hover:underline">
          Tutto il team
        </button>
        <button type="button" onClick={() => setAll([])} className="text-muted hover:underline">
          Nessuno
        </button>
      </div>
      <ul className="max-h-64 overflow-y-auto pb-1">
        {shown.map((p) => {
          const on = selected.includes(p.id);
          return (
            <li key={p.id}>
              <label className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-stone-50 ${on ? "font-medium" : ""}`}>
                <input type="checkbox" checked={on} onChange={() => toggle(p.id)} className="accent-[var(--color-brand)]" />
                <span className="truncate">{p.full_name || p.email}</span>
              </label>
            </li>
          );
        })}
        {shown.length === 0 && <li className="px-3 py-2 text-sm text-muted">Nessun risultato</li>}
      </ul>
    </>
  );
}

const initials = (p: Person) =>
  (p.full_name || p.email)
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

/** Selettore collaboratori di una riga. */
export function PeoplePicker({
  people,
  value,
  onChange,
}: {
  people: Person[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const { open, setOpen, pos, btn, pop } = usePopover();
  const chosen = people.filter((p) => value.includes(p.id));
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <>
      <button
        ref={btn}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex min-h-9 w-full items-center gap-1 rounded-lg border px-2 py-1 text-left text-sm transition ${
          chosen.length ? "border-line bg-white hover:border-brand" : "border-dashed border-amber-400 bg-amber-50 text-amber-800 hover:border-amber-500"
        }`}
        title={chosen.map((p) => p.full_name || p.email).join(", ")}
      >
        {chosen.length === 0 ? (
          <span>+ Assegna</span>
        ) : chosen.length <= 2 ? (
          <span className="truncate">{chosen.map((p) => (p.full_name || p.email).split(" ")[0]).join(", ")}</span>
        ) : (
          <span className="flex items-center gap-1">
            {chosen.slice(0, 3).map((p) => (
              <span key={p.id} className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/15 text-[10px] font-semibold text-brand">
                {initials(p)}
              </span>
            ))}
            {chosen.length > 3 && <span className="text-xs text-muted">+{chosen.length - 3}</span>}
          </span>
        )}
      </button>
      {open && (
        <div
          ref={pop}
          style={{ position: "fixed", top: pos.top, left: pos.left, width: 288 }}
          className="z-50 rounded-xl border border-line bg-white shadow-xl"
        >
          <PeopleList people={people} selected={value} toggle={toggle} setAll={onChange} />
        </div>
      )}
    </>
  );
}

/** Assegnazione in blocco alle righe selezionate: aggiungi o sostituisci. */
export function BulkAssign({
  people,
  onApply,
}: {
  people: Person[];
  onApply: (ids: string[], mode: "add" | "replace") => void;
}) {
  const { open, setOpen, pos, btn, pop } = usePopover();
  const [sel, setSel] = useState<string[]>([]);
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const apply = (mode: "add" | "replace") => {
    onApply(sel, mode);
    setSel([]);
    setOpen(false);
  };

  return (
    <>
      <button ref={btn} type="button" onClick={() => setOpen((o) => !o)} className="btn-primary py-1.5">
        👤 Assegna a…
      </button>
      {open && (
        <div
          ref={pop}
          style={{ position: "fixed", top: pos.top, left: pos.left, width: 288 }}
          className="z-50 rounded-xl border border-line bg-white shadow-xl"
        >
          <PeopleList people={people} selected={sel} toggle={toggle} setAll={setSel} />
          <div className="flex gap-2 border-t border-line p-2">
            <button type="button" disabled={!sel.length} onClick={() => apply("add")} className="btn-primary flex-1 py-1.5">
              Aggiungi
            </button>
            <button type="button" disabled={!sel.length} onClick={() => apply("replace")} className="btn-ghost flex-1 py-1.5">
              Sostituisci
            </button>
          </div>
        </div>
      )}
    </>
  );
}
