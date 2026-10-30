"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import {
  MAX_ROWS,
  PRIORITIES,
  decodeCsv,
  norm,
  parseCsv,
  rowProblems,
  templateCsv,
  toEditRows,
  toRecords,
  type ClientRef,
  type EditRow,
  type Person,
  type Priority,
} from "@/lib/csv-import";
import { importTasks, type ImportResult } from "./actions";
import { BulkAssign, PeoplePicker } from "./people-picker";

type View = "tutte" | "da-assegnare" | "pronte";

export function ImportWizard({ people, clients }: { people: Person[]; clients: ClientRef[] }) {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<EditRow[]>([]);
  const [missingCols, setMissingCols] = useState<string[]>([]);
  const [ignoredCols, setIgnoredCols] = useState<string[]>([]);
  const [tooMany, setTooMany] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [view, setView] = useState<View>("tutte");
  const [clientFilter, setClientFilter] = useState("");
  const [openDesc, setOpenDesc] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const existingClients = useMemo(() => new Set(clients.map((c) => norm(c.name))), [clients]);
  const clientOptions = useMemo(() => {
    const names = new Map<string, string>();
    clients.forEach((c) => names.set(norm(c.name), c.name));
    rows.forEach((r) => r.clientName && !names.has(norm(r.clientName)) && names.set(norm(r.clientName), r.clientName));
    return [...names.values()].sort((a, b) => a.localeCompare(b, "it"));
  }, [clients, rows]);
  const fileClients = useMemo(
    () => [...new Set(rows.map((r) => r.clientName).filter(Boolean))].sort((a, b) => a.localeCompare(b, "it")),
    [rows],
  );

  const ready = rows.filter((r) => rowProblems(r).length === 0);
  const unassigned = rows.filter((r) => !r.assigneeIds.length).length;
  // Le righe mostrate vengono "fissate" quando si sceglie il filtro: così una riga appena
  // assegnata non sparisce mentre la si sta modificando.
  const [pinned, setPinned] = useState<Set<string> | null>(null);
  const matches = (r: EditRow, v: View, c: string) => {
    if (c && (c === "__none" ? r.clientName : r.clientName !== c)) return false;
    if (v === "da-assegnare") return rowProblems(r).length > 0;
    if (v === "pronte") return rowProblems(r).length === 0;
    return true;
  };
  const applyFilter = (v: View, c: string) => {
    setView(v);
    setClientFilter(c);
    setPinned(v === "tutte" && !c ? null : new Set(rows.filter((r) => matches(r, v, c)).map((r) => r.key)));
  };
  const visible = pinned ? rows.filter((r) => pinned.has(r.key)) : rows;
  const selectedVisible = visible.filter((r) => selected.has(r.key));
  const allVisibleSelected = visible.length > 0 && selectedVisible.length === visible.length;

  // ---------- caricamento ----------
  async function load(file: File) {
    setResult(null);
    setFileName(file.name);
    const { records, missing, unknown } = toRecords(parseCsv(decodeCsv(await file.arrayBuffer())));
    setMissingCols(missing);
    setIgnoredCols(unknown);
    setTooMany(records.length > MAX_ROWS);
    setRows(missing.length ? [] : toEditRows(records, people, clients));
    setSelected(new Set());
    setView("tutte");
    setClientFilter("");
    setPinned(null);
  }

  function reset() {
    setFileName("");
    setRows([]);
    setMissingCols([]);
    setIgnoredCols([]);
    setSelected(new Set());
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function downloadTemplate() {
    const blob = new Blob([templateCsv()], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "modello-import-task.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------- modifiche ----------
  const update = (key: string, patch: Partial<EditRow>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const updateSelected = (fn: (r: EditRow) => Partial<EditRow>) =>
    setRows((rs) => rs.map((r) => (selected.has(r.key) ? { ...r, ...fn(r) } : r)));

  const toggleRow = (key: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  const toggleAllVisible = () =>
    setSelected((s) => {
      const n = new Set(s);
      if (allVisibleSelected) visible.forEach((r) => n.delete(r.key));
      else visible.forEach((r) => n.add(r.key));
      return n;
    });

  function removeSelected() {
    if (!confirm(`Togliere ${selected.size} righe dall'import?`)) return;
    setRows((rs) => rs.filter((r) => !selected.has(r.key)));
    setSelected(new Set());
  }

  function doImport() {
    start(async () => {
      const res = await importTasks(ready);
      setResult(res);
      if (res.ok) {
        setRows([]);
        setFileName("");
        setSelected(new Set());
        if (inputRef.current) inputRef.current.value = "";
      }
    });
  }

  // ---------- esito ----------
  if (result?.ok) {
    return (
      <div className="card p-8 text-center">
        <div className="mb-2 text-4xl">✓</div>
        <h2 className="text-lg font-semibold">{result.created} task importati</h2>
        <p className="mt-1 text-sm text-muted">
          {result.newClients ? `${result.newClients} nuovi clienti creati. ` : ""}I collaboratori hanno ricevuto la notifica.
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <Link href="/admin" className="btn-primary">Vai ai task</Link>
          <button onClick={reset} className="btn-ghost">Importa un altro file</button>
        </div>
      </div>
    );
  }

  // ---------- step 1: file ----------
  if (!fileName || missingCols.length) {
    return (
      <div className="space-y-5">
        {missingCols.length > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            Nel file <b>{fileName}</b> manca la colonna <b>titolo</b>. Controlla che la prima riga contenga i nomi delle
            colonne, oppure parti dal modello.
            {ignoredCols.length > 0 && <> Colonne trovate: {ignoredCols.join(", ")}.</>}
          </div>
        )}
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) load(f);
          }}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition ${
            dragging ? "border-brand bg-brand/5" : "border-line bg-white hover:border-brand/50"
          }`}
        >
          <span className="mb-2 text-3xl" aria-hidden>📄</span>
          <span className="font-medium">Trascina qui il file CSV o tocca per sceglierlo</span>
          <span className="mt-1 text-sm text-muted">Dopo il caricamento assegni i collaboratori, prima di confermare</span>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) load(f);
            }}
          />
        </label>

        <div className="card space-y-3 p-5 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">Come preparare il file</h2>
            <button onClick={downloadTemplate} className="btn-ghost">⬇ Scarica il modello</button>
          </div>
          <p className="text-muted">
            Bastano due colonne: <b>titolo</b> e <b>descrizione</b>, una riga per task. Da Excel: <b>File → Salva con nome → CSV</b>.
          </p>
          <p className="text-muted">
            Facoltative, se vuoi precompilarle: <span className="font-mono">cliente</span>,{" "}
            <span className="font-mono">scadenza</span> (gg/mm/aaaa), <span className="font-mono">priorita</span>,{" "}
            <span className="font-mono">link</span>, <span className="font-mono">assegnati</span>. Tutto si può modificare
            nel passo successivo.
          </p>
        </div>
      </div>
    );
  }

  // ---------- step 2: anteprima modificabile ----------
  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <span className="text-xl" aria-hidden>📄</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{fileName}</span>
          <span className="text-xs text-muted">
            {rows.length} task · <b className="text-ok">{ready.length} pronti</b>
            {unassigned > 0 && <> · <b className="text-amber-700">{unassigned} da assegnare</b></>}
          </span>
        </span>
        <button onClick={reset} className="btn-ghost">Cambia file</button>
      </div>

      {tooMany && (
        <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Il file ha più di {MAX_ROWS} righe: sono state caricate solo le prime {MAX_ROWS}.
        </p>
      )}
      {ignoredCols.length > 0 && <p className="text-xs text-muted">Colonne ignorate: {ignoredCols.join(", ")}</p>}

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="f-view">Mostra</label>
          <select id="f-view" value={view} onChange={(e) => applyFilter(e.target.value as View, clientFilter)} className="input py-1.5">
            <option value="tutte">Tutte ({rows.length})</option>
            <option value="da-assegnare">Da completare ({rows.length - ready.length})</option>
            <option value="pronte">Pronte ({ready.length})</option>
          </select>
        </div>
        {fileClients.length > 0 && (
          <div>
            <label className="label" htmlFor="f-client">Cliente</label>
            <select id="f-client" value={clientFilter} onChange={(e) => applyFilter(view, e.target.value)} className="input py-1.5">
              <option value="">Tutti i clienti</option>
              {fileClients.map((c) => (
                <option key={c} value={c}>{c} ({rows.filter((r) => r.clientName === c).length})</option>
              ))}
              {rows.some((r) => !r.clientName) && <option value="__none">Senza cliente</option>}
            </select>
          </div>
        )}
        <p className="pb-2 text-xs text-muted">
          Suggerimento: filtra un cliente, spunta “seleziona tutte” e usa <b>Assegna a…</b>
        </p>
      </div>

      <datalist id="client-options">
        {clientOptions.map((c) => <option key={c} value={c} />)}
      </datalist>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="border-b border-line bg-stone-50 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = selectedVisible.length > 0 && !allVisibleSelected;
                  }}
                  onChange={toggleAllVisible}
                  aria-label="Seleziona tutte le righe visibili"
                  className="h-4 w-4 accent-[var(--color-brand)]"
                />
              </th>
              <th className="w-12 px-1 py-2">Riga</th>
              <th className="px-2 py-2">Task</th>
              <th className="w-48 px-2 py-2">Cliente</th>
              <th className="w-28 px-2 py-2">Priorità</th>
              <th className="w-40 px-2 py-2">Scadenza</th>
              <th className="w-48 px-2 py-2">Assegnati</th>
              <th className="w-10 px-2 py-2" aria-label="Stato"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {visible.map((r) => {
              const problems = rowProblems(r);
              const isSel = selected.has(r.key);
              return (
                <tr key={r.key} className={`align-top ${isSel ? "bg-brand/5" : problems.length ? "bg-amber-50/40" : ""}`}>
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={isSel}
                      onChange={() => toggleRow(r.key)}
                      aria-label={`Seleziona riga ${r.line}`}
                      className="h-4 w-4 accent-[var(--color-brand)]"
                    />
                  </td>
                  <td className="px-1 py-2.5 tabular-nums text-muted">{r.line}</td>
                  <td className="px-2 py-1.5">
                    <input
                      value={r.title}
                      onChange={(e) => update(r.key, { title: e.target.value })}
                      placeholder="Titolo obbligatorio"
                      className={`input py-1.5 font-medium ${!r.title.trim() ? "border-red-300 bg-red-50" : ""}`}
                      aria-label={`Titolo riga ${r.line}`}
                    />
                    {openDesc === r.key ? (
                      <textarea
                        autoFocus
                        value={r.description}
                        onChange={(e) => update(r.key, { description: e.target.value })}
                        onBlur={() => setOpenDesc(null)}
                        rows={3}
                        className="input mt-1 resize-y text-xs"
                        aria-label={`Descrizione riga ${r.line}`}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setOpenDesc(r.key)}
                        className="mt-1 block w-full truncate text-left text-xs text-muted hover:text-ink"
                      >
                        {r.description || "+ descrizione"}
                      </button>
                    )}
                    {r.warnings.length > 0 && (
                      <p className="mt-1 text-xs text-amber-700">! {r.warnings.join(" · ")}</p>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      value={r.clientName}
                      onChange={(e) => update(r.key, { clientName: e.target.value })}
                      list="client-options"
                      placeholder="—"
                      className="input py-1.5"
                      aria-label={`Cliente riga ${r.line}`}
                    />
                    {r.clientName && !existingClients.has(norm(r.clientName)) && (
                      <span className="mt-0.5 inline-block rounded bg-brand/10 px-1 text-[11px] text-brand">nuovo cliente</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    <select
                      value={r.priority}
                      onChange={(e) => update(r.key, { priority: e.target.value as Priority })}
                      className="input py-1.5 capitalize"
                      aria-label={`Priorità riga ${r.line}`}
                    >
                      {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="date"
                      value={r.dueDate}
                      onChange={(e) => update(r.key, { dueDate: e.target.value })}
                      className="input py-1.5"
                      aria-label={`Scadenza riga ${r.line}`}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <PeoplePicker people={people} value={r.assigneeIds} onChange={(ids) => update(r.key, { assigneeIds: ids })} />
                  </td>
                  <td className="px-2 py-2.5 text-center">
                    {problems.length === 0 ? (
                      <span className="text-ok" title="Pronta">✓</span>
                    ) : (
                      <span className="text-amber-600" title={problems.join(", ")}>•</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-muted">Nessuna riga con questi filtri.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {result?.error && <p className="text-sm text-red-700">{result.error}</p>}

      {/* barra in basso: azioni in blocco oppure conferma import */}
      <div className="sticky bottom-4 z-20">
        {selected.size > 0 ? (
          <div className="mx-auto flex w-fit max-w-full flex-wrap items-center gap-2 rounded-xl border border-line bg-white px-4 py-3 shadow-lg">
            <span className="mr-1 text-sm font-medium">{selected.size} selezionate</span>
            <BulkAssign
              people={people}
              onApply={(ids, mode) =>
                updateSelected((r) => ({
                  assigneeIds: mode === "replace" ? ids : [...new Set([...r.assigneeIds, ...ids])],
                }))
              }
            />
            <input
              list="client-options"
              placeholder="Cliente…"
              className="input w-40 py-1.5"
              aria-label="Imposta cliente per le righe selezionate"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const v = e.currentTarget.value.trim();
                  updateSelected(() => ({ clientName: v }));
                  e.currentTarget.value = "";
                }
              }}
              onBlur={(e) => {
                const v = e.currentTarget.value.trim();
                if (v) {
                  updateSelected(() => ({ clientName: v }));
                  e.currentTarget.value = "";
                }
              }}
            />
            <input
              type="date"
              className="input w-40 py-1.5"
              aria-label="Imposta scadenza per le righe selezionate"
              onChange={(e) => {
                const v = e.target.value;
                if (v) updateSelected(() => ({ dueDate: v }));
              }}
            />
            <select
              defaultValue=""
              className="input w-32 py-1.5"
              aria-label="Imposta priorità per le righe selezionate"
              onChange={(e) => {
                const v = e.target.value as Priority;
                if (v) updateSelected(() => ({ priority: v }));
                e.target.value = "";
              }}
            >
              <option value="" disabled>Priorità…</option>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <button type="button" onClick={removeSelected} className="btn-danger py-1.5">Togli</button>
            <button type="button" onClick={() => setSelected(new Set())} className="px-2 text-sm text-muted hover:text-ink">
              Annulla
            </button>
          </div>
        ) : (
          <div className="mx-auto flex w-fit max-w-full flex-wrap items-center gap-3 rounded-xl border border-line bg-white px-4 py-3 shadow-lg">
            <span className="text-sm">
              {ready.length === rows.length
                ? "Tutto pronto."
                : `${rows.length - ready.length} righe senza collaboratori o titolo: non verranno importate.`}
            </span>
            <button onClick={doImport} disabled={pending || ready.length === 0} className="btn-primary">
              {pending ? "Importazione…" : `Conferma e importa ${ready.length} task`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
