// Parser e validazione per l'import massivo dei task da CSV.
// Modulo "isomorfo": usato sia nel browser (anteprima) sia sul server (import vero, rivalidato).

export type Priority = "bassa" | "media" | "alta" | "urgente";

export type RawRow = Record<string, string>;

export type Person = { id: string; full_name: string; email: string };
export type ClientRef = { id: string; name: string };

export type ImportLink = { label: string; url: string };


export const MAX_ROWS = 500;

export const COLUMNS = ["titolo", "descrizione", "cliente", "priorita", "scadenza", "assegnati", "link"] as const;
type Column = (typeof COLUMNS)[number];

const ALIASES: Record<Column, string[]> = {
  titolo: ["titolo", "title", "task", "attivita", "nome task"],
  descrizione: ["descrizione", "description", "dettagli", "note", "brief"],
  cliente: ["cliente", "progetto", "cliente/progetto", "cliente progetto", "client", "project"],
  priorita: ["priorita", "priority", "urgenza"],
  scadenza: ["scadenza", "data scadenza", "data", "deadline", "due", "due date", "entro"],
  assegnati: ["assegnati", "assegnato", "assegnato a", "assegnatari", "collaboratori", "collaboratore", "assignees", "responsabile"],
  link: ["link", "links", "allegati", "link allegati", "url", "drive"],
};

export const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** Decodifica il file: UTF-8 se valido, altrimenti Windows-1252 (CSV salvati da Excel italiano). */
export function decodeCsv(buf: ArrayBuffer): string {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    text = new TextDecoder("windows-1252").decode(buf);
  }
  return text.replace(/^﻿/, "");
}

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim()) ?? "";
  const counts = [";", ",", "\t"].map((d) => {
    let n = 0;
    let inQ = false;
    for (const ch of firstLine) {
      if (ch === '"') inQ = !inQ;
      else if (ch === d && !inQ) n++;
    }
    return [d, n] as const;
  });
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ";";
}

/** Parser CSV (RFC 4180): virgolette, a capo dentro i campi, "" come virgoletta. */
export function parseCsv(text: string): string[][] {
  const d = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQ = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQ = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') inQ = true;
    else if (ch === d) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  // le righe vuote restano, così i numeri di riga coincidono con quelli di Excel
  while (rows.length && rows[0].every((c) => c.trim() === "")) rows.shift();
  return rows;
}

/** Converte le righe in oggetti con chiavi normalizzate. Restituisce anche le colonne non riconosciute. */
export function toRecords(rows: string[][]): { records: (RawRow & { __line: string })[]; missing: Column[]; unknown: string[] } {
  if (!rows.length) return { records: [], missing: ["titolo"], unknown: [] };
  const header = rows[0].map((h) => norm(h));
  const map: (Column | null)[] = header.map((h) => {
    for (const col of COLUMNS) if (ALIASES[col].includes(h)) return col;
    return null;
  });
  const unknown = rows[0].filter((_, i) => !map[i] && rows[0][i].trim());
  const missing = (["titolo"] as Column[]).filter((c) => !map.includes(c));

  const records = rows
    .slice(1)
    .map((r, idx) => {
      const rec: RawRow & { __line: string } = { __line: String(idx + 2) };
      map.forEach((col, i) => {
        if (col) rec[col] = (r[i] ?? "").trim();
      });
      return rec;
    })
    .filter((rec) => COLUMNS.some((c) => rec[c]));
  return { records, missing, unknown };
}

/** Accetta 15/11/2026, 15-11-26, 15.11.2026, 2026-11-15. */
export function parseDate(s: string): string | null | "invalid" {
  const v = s.trim();
  if (!v) return null;
  let y: number, m: number, d: number;
  let mt = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (mt) {
    y = +mt[1];
    m = +mt[2];
    d = +mt[3];
  } else if ((mt = v.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})$/))) {
    d = +mt[1];
    m = +mt[2];
    y = +mt[3];
    if (y < 100) y += 2000;
  } else return "invalid";
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return "invalid";
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const PRIORITY_ALIASES: Record<string, Priority> = {
  bassa: "bassa", low: "bassa", "1": "bassa",
  media: "media", medio: "media", normale: "media", medium: "media", "2": "media",
  alta: "alta", alto: "alta", high: "alta", "3": "alta",
  urgente: "urgente", urgent: "urgente", critica: "urgente", "4": "urgente",
};

function parseLinks(s: string): ImportLink[] | "invalid" {
  const parts = s.split(/[\s|]+/).map((p) => p.trim()).filter(Boolean);
  const out: ImportLink[] = [];
  for (let p of parts) {
    if (!/^https?:\/\//i.test(p)) {
      if (/^[\w-]+(\.[\w-]+)+(\/|$)/.test(p)) p = "https://" + p;
      else return "invalid";
    }
    try {
      new URL(p);
    } catch {
      return "invalid";
    }
    out.push({ label: "", url: p });
  }
  return out.slice(0, 20);
}

/** Riga modificabile nell'anteprima (step 2). */
export type EditRow = {
  key: string;
  line: number;
  title: string;
  description: string;
  clientName: string;
  priority: Priority;
  dueDate: string; // YYYY-MM-DD o ""
  assigneeIds: string[];
  links: ImportLink[];
  warnings: string[];
};

export const PRIORITIES: Priority[] = ["bassa", "media", "alta", "urgente"];

/** Problemi che impediscono l'import di una riga. */
export function rowProblems(r: Pick<EditRow, "title" | "assigneeIds">): string[] {
  const p: string[] = [];
  if (!r.title.trim()) p.push("Titolo mancante");
  if (!r.assigneeIds.length) p.push("Nessun collaboratore");
  return p;
}

/** Interpreta i record del CSV e li abbina a collaboratori e clienti. Gli imprevisti diventano avvisi. */
export function toEditRows(records: RawRow[], people: Person[], clients: ClientRef[]): EditRow[] {
  const byEmail = new Map(people.map((p) => [norm(p.email), p]));
  const group = (keyOf: (p: Person) => string[]) => {
    const m = new Map<string, Person[]>();
    for (const p of people)
      for (const k of new Set(keyOf(p).filter(Boolean))) m.set(k, [...(m.get(k) ?? []), p]);
    return m;
  };
  const compact = (s: string) => norm(s).replace(/[^a-z0-9]/g, "");
  const byName = group((p) => [norm(p.full_name)]);
  const byFirst = group((p) => [norm(p.full_name).split(" ")[0]]);
  // handle tipo "@mirydimartino" o "FabioPirajno": nome senza spazi oppure parte dell'email prima della @
  const byHandle = group((p) => [compact(p.full_name), compact(p.email.split("@")[0])]);
  const clientByName = new Map(clients.map((c) => [norm(c.name), c]));

  return records.slice(0, MAX_ROWS).map((r, i) => {
    const warnings: string[] = [];
    const line = Number((r as RawRow & { __line?: string }).__line ?? i + 2);

    // cliente: se esiste uso il nome registrato, altrimenti verrà creato
    let clientName = (r.cliente ?? "").trim().slice(0, 120);
    if (clientName) {
      const c = clientByName.get(norm(clientName));
      if (c) clientName = c.name;
    }

    let priority: Priority = "media";
    const pr = norm(r.priorita ?? "");
    if (pr) {
      if (PRIORITY_ALIASES[pr]) priority = PRIORITY_ALIASES[pr];
      else warnings.push(`Priorità "${r.priorita}" non riconosciuta`);
    }

    const due = parseDate(r.scadenza ?? "");
    let dueDate = "";
    if (due === "invalid") warnings.push(`Data "${r.scadenza}" non valida`);
    else dueDate = due ?? "";

    const assigneeIds: string[] = [];
    const add = (p: Person) => !assigneeIds.includes(p.id) && assigneeIds.push(p.id);
    const tokens = (r.assegnati ?? "")
      .split(/[,;|+\n]/)
      .map((t) => t.trim().replace(/^@/, "").trim())
      .filter(Boolean);
    for (const t of tokens) {
      const k = norm(t);
      if (k === "tutti" || k === "tutto il team" || k === "team") {
        people.forEach(add);
        continue;
      }
      const candidates =
        (byEmail.get(k) && [byEmail.get(k)!]) ||
        byName.get(k) ||
        (!k.includes(" ") && !k.includes("@") ? byFirst.get(k) : undefined) ||
        byHandle.get(compact(t));
      if (candidates?.length === 1) add(candidates[0]);
      else if (candidates && candidates.length > 1) warnings.push(`"${t}" corrisponde a più persone`);
      else warnings.push(`"${t}" non trovato`);
    }

    let links: ImportLink[] = [];
    if (r.link?.trim()) {
      const l = parseLinks(r.link);
      if (l === "invalid") warnings.push("Link non valido, ignorato");
      else links = l;
    }

    return {
      key: `r${line}`,
      line,
      title: (r.titolo ?? "").trim().slice(0, 300),
      description: (r.descrizione ?? "").trim().slice(0, 5000),
      clientName,
      priority,
      dueDate,
      assigneeIds,
      links,
      warnings,
    };
  });
}

export type CleanRow = Omit<EditRow, "key" | "line" | "warnings">;

/** Validazione lato server delle righe modificate nell'anteprima: non si fida del browser. */
export function cleanForImport(input: unknown, people: Person[]): { rows: CleanRow[]; skipped: number } {
  const valid = new Set(people.map((p) => p.id));
  const arr = Array.isArray(input) ? input.slice(0, MAX_ROWS) : [];
  const rows: CleanRow[] = [];
  for (const raw of arr) {
    const r = raw as Partial<EditRow>;
    const title = String(r.title ?? "").trim().slice(0, 300);
    const assigneeIds = [...new Set((Array.isArray(r.assigneeIds) ? r.assigneeIds : []).map(String))].filter((id) =>
      valid.has(id),
    );
    if (!title || !assigneeIds.length) continue;
    const priority = PRIORITIES.includes(r.priority as Priority) ? (r.priority as Priority) : "media";
    const d = String(r.dueDate ?? "");
    const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(d) && parseDate(d) === d ? d : "";
    const links = (Array.isArray(r.links) ? r.links : [])
      .map((l) => ({ label: String(l?.label ?? "").slice(0, 80), url: String(l?.url ?? "") }))
      .filter((l) => /^https?:\/\//i.test(l.url))
      .slice(0, 20);
    rows.push({
      title,
      description: String(r.description ?? "").trim().slice(0, 5000),
      clientName: String(r.clientName ?? "").trim().slice(0, 120),
      priority,
      dueDate,
      assigneeIds,
      links,
    });
  }
  return { rows, skipped: arr.length - rows.length };
}

/** Modello CSV da scaricare (separatore ";" per Excel in italiano). Solo titolo e descrizione sono necessari. */
export function templateCsv() {
  const rows = [
    ["titolo", "descrizione", "cliente", "scadenza"],
    ["Piano editoriale novembre", "12 post + 4 reel", "Pasticceria Rossi", "15/11/2026"],
    ["Shooting prodotti", "Scatti per il nuovo catalogo", "Pasticceria Rossi", ""],
    ["Report mensile social", "Numeri di ottobre e confronto con settembre", "", ""],
  ];
  const esc = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return "﻿" + rows.map((r) => r.map(esc).join(";")).join("\r\n") + "\r\n";
}
