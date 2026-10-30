"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import {
  MAX_ROWS,
  checkRows,
  decodeCsv,
  parseCsv,
  templateCsv,
  toRecords,
  type ClientRef,
  type Person,
  type RawRow,
} from "@/lib/csv-import";
import { importTasks, type ImportResult } from "./actions";

const PRIORITY_STYLE: Record<string, string> = {
  bassa: "bg-stone-100 text-stone-600",
  media: "bg-sky-50 text-sky-700",
  alta: "bg-amber-50 text-amber-700",
  urgente: "bg-red-50 text-red-700",
};

function formatDate(d: string | null) {
  if (!d) return "—";
  const [y, m, g] = d.split("-");
  return `${g}/${m}/${y}`;
}

export function ImportWizard({ people, clients }: { people: Person[]; clients: ClientRef[] }) {
  const [fileName, setFileName] = useState("");
  const [records, setRecords] = useState<RawRow[]>([]);
  const [headerIssue, setHeaderIssue] = useState<{ missing: string[]; unknown: string[] } | null>(null);
  const [tooMany, setTooMany] = useState(false);
  const [createClients, setCreateClients] = useState(true);
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const rows = useMemo(
    () => checkRows(records, people, clients, { createClients }),
    [records, people, clients, createClients],
  );
  const valid = rows.filter((r) => !r.errors.length);
  const invalid = rows.length - valid.length;
  const shown = onlyProblems ? rows.filter((r) => r.errors.length || r.warnings.length) : rows;

  async function load(file: File) {
    setResult(null);
    setFileName(file.name);
    const text = decodeCsv(await file.arrayBuffer());
    const { records: recs, missing, unknown } = toRecords(parseCsv(text));
    setHeaderIssue(missing.length ? { missing, unknown } : unknown.length ? { missing: [], unknown } : null);
    setTooMany(recs.length > MAX_ROWS);
    setRecords(missing.length ? [] : recs.slice(0, MAX_ROWS));
    setOnlyProblems(false);
  }

  function reset() {
    setFileName("");
    setRecords([]);
    setHeaderIssue(null);
    setTooMany(false);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function downloadTemplate() {
    const blob = new Blob([templateCsv(people)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "modello-import-task.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function doImport() {
    start(async () => {
      const res = await importTasks(records, createClients);
      setResult(res);
      if (res.ok) {
        setRecords([]);
        setFileName("");
        if (inputRef.current) inputRef.current.value = "";
      }
    });
  }

  // ---------- Esito ----------
  if (result?.ok) {
    return (
      <div className="card p-8 text-center">
        <div className="mb-2 text-4xl">✓</div>
        <h2 className="text-lg font-semibold">
          {result.created} task importati
        </h2>
        <p className="mt-1 text-sm text-muted">
          {result.newClients ? `${result.newClients} nuovi clienti creati. ` : ""}
          {result.skipped ? `${result.skipped} righe con errori saltate. ` : ""}
          I collaboratori hanno ricevuto la notifica.
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <Link href="/admin" className="btn-primary">Vai ai task</Link>
          <button onClick={reset} className="btn-ghost">Importa un altro file</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Caricamento */}
      {!fileName && (
        <>
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
            <span className="mt-1 text-sm text-muted">Massimo {MAX_ROWS} righe · salvato da Excel, Numbers o Google Fogli</span>
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
              Una riga per task. La prima riga contiene i nomi delle colonne. Da Excel: <b>File → Salva con nome → CSV</b>.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-muted">
                  <tr><th className="py-1 pr-4">Colonna</th><th className="py-1">Cosa scrivere</th></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  <tr><td className="py-1.5 pr-4 font-mono">titolo *</td><td>Il nome del task</td></tr>
                  <tr><td className="py-1.5 pr-4 font-mono">assegnati *</td><td>Email, nome e cognome o handle (es. @mariorossi); più persone separate da virgola; <b>tutti</b> = tutto il team</td></tr>
                  <tr><td className="py-1.5 pr-4 font-mono">descrizione</td><td>Dettagli del lavoro</td></tr>
                  <tr><td className="py-1.5 pr-4 font-mono">cliente</td><td>Nome del cliente; se non esiste viene creato</td></tr>
                  <tr><td className="py-1.5 pr-4 font-mono">priorita</td><td>bassa, media, alta, urgente (vuoto = media)</td></tr>
                  <tr><td className="py-1.5 pr-4 font-mono">scadenza</td><td>gg/mm/aaaa, es. 15/11/2026</td></tr>
                  <tr><td className="py-1.5 pr-4 font-mono">link</td><td>Uno o più link (Drive, Dropbox…) separati da spazio</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* File caricato */}
      {fileName && (
        <div className="card flex flex-wrap items-center gap-3 p-4">
          <span className="text-xl" aria-hidden>📄</span>
          <span className="min-w-0 flex-1 truncate font-medium">{fileName}</span>
          <button onClick={reset} className="btn-ghost">Cambia file</button>
        </div>
      )}

      {headerIssue?.missing.length ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Mancano le colonne obbligatorie: <b>{headerIssue.missing.join(", ")}</b>. Controlla la prima riga del file o
          parti dal modello.
          {headerIssue.unknown.length > 0 && (
            <> Colonne trovate e non riconosciute: {headerIssue.unknown.join(", ")}.</>
          )}
        </div>
      ) : null}

      {fileName && !headerIssue?.missing.length && rows.length === 0 && (
        <div className="card p-6 text-sm text-muted">Il file non contiene righe di task.</div>
      )}

      {rows.length > 0 && (
        <>
          {tooMany && (
            <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">
              Il file ha più di {MAX_ROWS} righe: verranno considerate solo le prime {MAX_ROWS}.
            </p>
          )}
          {headerIssue?.unknown.length ? (
            <p className="text-xs text-muted">Colonne ignorate: {headerIssue.unknown.join(", ")}</p>
          ) : null}

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span><b className="text-ok">{valid.length}</b> pronte</span>
            {invalid > 0 && <span><b className="text-red-700">{invalid}</b> con errori (verranno saltate)</span>}
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={createClients} onChange={(e) => setCreateClients(e.target.checked)} className="accent-[var(--color-brand)]" />
              Crea i clienti che non esistono
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={onlyProblems} onChange={(e) => setOnlyProblems(e.target.checked)} className="accent-[var(--color-brand)]" />
              Mostra solo righe da controllare
            </label>
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-line bg-stone-50 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2">Riga</th>
                  <th className="px-3 py-2">Titolo</th>
                  <th className="px-3 py-2">Cliente</th>
                  <th className="px-3 py-2">Priorità</th>
                  <th className="px-3 py-2">Scadenza</th>
                  <th className="px-3 py-2">Assegnati</th>
                  <th className="px-3 py-2">Esito</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shown.map((r) => (
                  <tr key={r.line} className={r.errors.length ? "bg-red-50/60" : ""}>
                    <td className="px-3 py-2 tabular-nums text-muted">{r.line}</td>
                    <td className="max-w-56 px-3 py-2">
                      <div className="truncate font-medium">{r.title || <span className="text-red-700">—</span>}</div>
                      {r.links.length > 0 && <div className="text-xs text-muted">🔗 {r.links.length} link</div>}
                    </td>
                    <td className="px-3 py-2">
                      {r.clientName || <span className="text-muted">—</span>}
                      {r.newClient && <span className="ml-1 rounded bg-brand/10 px-1 text-[11px] text-brand">nuovo</span>}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${PRIORITY_STYLE[r.priority]}`}>{r.priority}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">{formatDate(r.dueDate)}</td>
                    <td className="max-w-48 px-3 py-2">{r.assigneeNames.join(", ") || <span className="text-muted">—</span>}</td>
                    <td className="max-w-72 px-3 py-2 text-xs">
                      {r.errors.length === 0 && r.warnings.length === 0 && <span className="text-ok">✓ Pronta</span>}
                      {r.errors.map((e, i) => <div key={`e${i}`} className="text-red-700">✕ {e}</div>)}
                      {r.warnings.map((w, i) => <div key={`w${i}`} className="text-amber-700">! {w}</div>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {result?.error && <p className="text-sm text-red-700">{result.error}</p>}

          <div className="flex flex-wrap items-center gap-3">
            <button onClick={doImport} disabled={pending || valid.length === 0} className="btn-primary">
              {pending ? "Importazione…" : `Importa ${valid.length} task`}
            </button>
            {invalid > 0 && valid.length > 0 && (
              <span className="text-sm text-muted">Le {invalid} righe con errori non verranno importate: correggile nel file e ricaricalo.</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
