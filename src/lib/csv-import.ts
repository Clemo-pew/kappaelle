// Parser e validazione per l'import massivo dei task da CSV.
// Modulo "isomorfo": usato sia nel browser (anteprima) sia sul server (import vero, rivalidato).

export type Priority = "bassa" | "media" | "alta" | "urgente";

export type RawRow = Record<string, string>;

export type Person = { id: string; full_name: string; email: string };
export type ClientRef = { id: string; name: string };

export type ImportLink = { label: string; url: string };

export type CheckedRow = {
  line: number; // riga nel file (1 = intestazione)
  title: string;
  description: string;
  clientName: string;
  clientId: string | null;
  newClient: boolean;
  priority: Priority;
  dueDate: string | null; // YYYY-MM-DD
  assigneeIds: string[];
  assigneeNames: string[];
  links: ImportLink[];
  errors: string[];
  warnings: string[];
};

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
  if (!rows.length) return { records: [], missing: ["titolo", "assegnati"], unknown: [] };
  const header = rows[0].map((h) => norm(h));
  const map: (Column | null)[] = header.map((h) => {
    for (const col of COLUMNS) if (ALIASES[col].includes(h)) return col;
    return null;
  });
  const unknown = rows[0].filter((_, i) => !map[i] && rows[0][i].trim());
  const missing = (["titolo", "assegnati"] as Column[]).filter((c) => !map.includes(c));

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

/** Valida le righe e le abbina a collaboratori e clienti esistenti. */
export function checkRows(
  records: RawRow[],
  people: Person[],
  clients: ClientRef[],
  opts: { createClients: boolean },
): CheckedRow[] {
  const byEmail = new Map(people.map((p) => [norm(p.email), p]));
  const byName = new Map<string, Person[]>();
  for (const p of people) {
    const k = norm(p.full_name);
    if (k) byName.set(k, [...(byName.get(k) ?? []), p]);
  }
  // anche solo il nome di battesimo, se è univoco
  const byFirst = new Map<string, Person[]>();
  for (const p of people) {
    const k = norm(p.full_name).split(" ")[0];
    if (k) byFirst.set(k, [...(byFirst.get(k) ?? []), p]);
  }
  const clientByName = new Map(clients.map((c) => [norm(c.name), c]));

  return records.slice(0, MAX_ROWS).map((r, i) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const line = Number((r as RawRow & { __line?: string }).__line ?? i + 2);

    const title = (r.titolo ?? "").trim().slice(0, 300);
    if (!title) errors.push("Titolo mancante");

    // cliente
    const clientName = (r.cliente ?? "").trim();
    let clientId: string | null = null;
    let newClient = false;
    if (clientName) {
      const c = clientByName.get(norm(clientName));
      if (c) clientId = c.id;
      else if (opts.createClients) {
        newClient = true;
        warnings.push(`Nuovo cliente "${clientName}" verrà creato`);
      } else errors.push(`Cliente "${clientName}" non esiste`);
    }

    // priorità
    let priority: Priority = "media";
    const pr = norm(r.priorita ?? "");
    if (pr) {
      if (PRIORITY_ALIASES[pr]) priority = PRIORITY_ALIASES[pr];
      else warnings.push(`Priorità "${r.priorita}" non riconosciuta: uso "media"`);
    }

    // scadenza
    const due = parseDate(r.scadenza ?? "");
    let dueDate: string | null = null;
    if (due === "invalid") errors.push(`Data "${r.scadenza}" non valida (usa gg/mm/aaaa)`);
    else dueDate = due;

    // assegnati
    const assigneeIds: string[] = [];
    const assigneeNames: string[] = [];
    const tokens = (r.assegnati ?? "").split(/[,;|+\n]/).map((t) => t.trim()).filter(Boolean);
    if (!tokens.length) errors.push("Nessun collaboratore assegnato");
    for (const t of tokens) {
      const k = norm(t);
      let match: Person | undefined = byEmail.get(k);
      if (!match) {
        const full = byName.get(k);
        if (full?.length === 1) match = full[0];
        else if (full && full.length > 1) {
          errors.push(`"${t}" è ambiguo: usa l'email`);
          continue;
        }
      }
      if (!match && !k.includes(" ") && !k.includes("@")) {
        const first = byFirst.get(k);
        if (first?.length === 1) match = first[0];
        else if (first && first.length > 1) {
          errors.push(`"${t}" corrisponde a più persone: usa nome e cognome o l'email`);
          continue;
        }
      }
      if (!match) {
        errors.push(`Collaboratore "${t}" non trovato`);
        continue;
      }
      if (!assigneeIds.includes(match.id)) {
        assigneeIds.push(match.id);
        assigneeNames.push(match.full_name || match.email);
      }
    }

    // link
    let links: ImportLink[] = [];
    if (r.link?.trim()) {
      const l = parseLinks(r.link);
      if (l === "invalid") errors.push("Link non valido");
      else links = l;
    }

    return {
      line,
      title,
      description: (r.descrizione ?? "").trim().slice(0, 5000),
      clientName,
      clientId,
      newClient,
      priority,
      dueDate,
      assigneeIds,
      assigneeNames,
      links,
      errors,
      warnings,
    };
  });
}

/** Modello CSV da scaricare (separatore ";" per Excel in italiano). */
export function templateCsv(examplePeople: Person[]) {
  const a = examplePeople[0]?.email ?? "nome@azienda.it";
  const b = examplePeople[1]?.email ?? examplePeople[0]?.email ?? "altro@azienda.it";
  const rows = [
    ["titolo", "descrizione", "cliente", "priorita", "scadenza", "assegnati", "link"],
    ["Piano editoriale novembre", "12 post + 4 reel", "Pasticceria Rossi", "alta", "15/11/2026", a, "https://drive.google.com/..."],
    ["Shooting prodotti", "Scatti per il nuovo catalogo", "Pasticceria Rossi", "media", "20/11/2026", `${a}, ${b}`, ""],
    ["Report mensile social", "", "", "bassa", "", b, ""],
  ];
  const esc = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return "﻿" + rows.map((r) => r.map(esc).join(";")).join("\r\n") + "\r\n";
}
