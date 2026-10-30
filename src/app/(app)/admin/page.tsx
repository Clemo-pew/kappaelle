import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TASK_SELECT, commentCount, taskProgress, type Task } from "@/lib/types";
import { LinkList } from "@/components/links";
import { DueDate, PriorityBadge, ProgressBar, formatDateTime } from "@/components/ui";
import { getClients, getEmployees } from "@/lib/data";
import { BulkForm } from "./bulk-form";

export const dynamic = "force-dynamic";

type SP = Promise<{ cliente?: string; collaboratore?: string; stato?: string; q?: string; mese?: string }>;

/** Mese di riferimento del task: scadenza, oppure (se manca) data di creazione. Formato "YYYY-MM". */
function taskMonth(t: { due_date: string | null; created_at: string }) {
  if (t.due_date) return t.due_date.slice(0, 7);
  return new Date(t.created_at).toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" }).slice(0, 7);
}

function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const s = new Date(y, m - 1, 1).toLocaleDateString("it-IT", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default async function AdminTasksPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const stato = sp.stato ?? "aperti";
  const supabase = await createClient();

  const [clients, employees] = await Promise.all([getClients(), getEmployees(false)]);

  let query = supabase
    .from("tasks")
    .select(TASK_SELECT)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  query = query.eq("archived", stato === "archiviati");
  if (sp.cliente) query = query.eq("client_id", sp.cliente);
  if (sp.q) query = query.ilike("title", `%${sp.q}%`);

  const { data } = await query;
  let tasks = (data ?? []) as unknown as Task[];

  if (sp.collaboratore) tasks = tasks.filter((t) => t.task_assignees.some((a) => a.user_id === sp.collaboratore));
  if (sp.mese) tasks = tasks.filter((t) => taskMonth(t) === sp.mese);

  // Mesi disponibili nel filtro: quelli che hanno almeno un task, più il mese corrente
  const { data: monthRows } = await supabase.from("tasks").select("due_date, created_at");
  const currentMonth = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" }).slice(0, 7);
  const months = [...new Set([currentMonth, ...(monthRows ?? []).map(taskMonth)])].sort().reverse();
  if (stato === "aperti") tasks = tasks.filter((t) => taskProgress(t) < 100);
  if (stato === "completati") tasks = tasks.filter((t) => t.task_assignees.length > 0 && taskProgress(t) === 100);

  // Statistiche (su tutti i task non archiviati)
  const { data: allData } = await supabase.from("tasks").select(TASK_SELECT).eq("archived", false);
  const all = (allData ?? []) as unknown as Task[];
  const today = new Date().toISOString().slice(0, 10);
  const openAll = all.filter((t) => taskProgress(t) < 100);
  const overdue = openAll.filter((t) => t.due_date && t.due_date < today).length;
  const almost = openAll.filter((t) => t.task_assignees.some((a) => a.progress >= 75 && a.progress < 100)).length;
  const doneAll = all.length - openAll.length;

  const filterLink = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { ...sp, ...patch };
    Object.entries(merged).forEach(([k, v]) => v && p.set(k, v));
    const s = p.toString();
    return s ? `/admin?${s}` : "/admin";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Tutti i task</h1>
          <p className="text-sm text-muted">Panoramica dell&apos;avanzamento del team</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/importa" className="btn-ghost">⬆ Importa CSV</Link>
          <Link href="/admin/task/nuovo" className="btn-primary">+ Nuovo task</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Aperti" value={openAll.length} />
        <Stat label="Scaduti" value={overdue} tone={overdue ? "text-red-700" : undefined} />
        <Stat label="Quasi finiti (≥75%)" value={almost} />
        <Stat label="Completati" value={doneAll} tone="text-ok" />
      </div>

      <form className="card flex flex-wrap items-end gap-3 p-4" action="/admin">
        <div className="min-w-40 flex-1">
          <label className="label" htmlFor="q">Cerca</label>
          <input id="q" name="q" defaultValue={sp.q} placeholder="Titolo…" className="input" />
        </div>
        <div className="min-w-40">
          <label className="label" htmlFor="cliente">Cliente</label>
          <select id="cliente" name="cliente" defaultValue={sp.cliente ?? ""} className="input">
            <option value="">Tutti</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="min-w-40">
          <label className="label" htmlFor="collaboratore">Collaboratore</label>
          <select id="collaboratore" name="collaboratore" defaultValue={sp.collaboratore ?? ""} className="input">
            <option value="">Tutti</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name || e.email}</option>)}
          </select>
        </div>
        <div className="min-w-40">
          <label className="label" htmlFor="mese">Mese</label>
          <select id="mese" name="mese" defaultValue={sp.mese ?? ""} className="input">
            <option value="">Tutti i mesi</option>
            {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
        </div>
        <div className="min-w-36">
          <label className="label" htmlFor="stato">Stato</label>
          <select id="stato" name="stato" defaultValue={stato} className="input">
            <option value="aperti">Aperti</option>
            <option value="completati">Completati</option>
            <option value="tutti">Tutti</option>
            <option value="archiviati">Archiviati</option>
          </select>
        </div>
        <button className="btn-ghost">Filtra</button>
        {(sp.q || sp.cliente || sp.collaboratore || sp.stato || sp.mese) && (
          <Link href="/admin" className="text-sm text-muted underline">Azzera</Link>
        )}
      </form>

      <BulkForm archivedView={stato === "archiviati"} total={tasks.length}>
        {tasks.length === 0 && <div className="card p-8 text-center text-sm text-muted">Nessun task con questi filtri.</div>}
        {tasks.map((t) => {
          const pct = taskProgress(t);
          return (
            <article key={t.id} className="card p-5 has-[input[name=ids]:checked]:border-brand has-[input[name=ids]:checked]:bg-brand/5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <input
                  type="checkbox"
                  name="ids"
                  value={t.id}
                  aria-label={`Seleziona ${t.title}`}
                  className="mt-1.5 h-4 w-4 shrink-0 accent-[var(--color-brand)]"
                />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    {t.clients && (
                      <Link
                        href={filterLink({ cliente: t.clients.id })}
                        className="text-xs font-medium uppercase tracking-wide text-brand hover:underline"
                      >
                        {t.clients.name}
                      </Link>
                    )}
                    <PriorityBadge priority={t.priority} />
                  </div>
                  <Link href={`/task/${t.id}`} className="text-lg font-semibold leading-snug hover:underline">
                    {t.title}
                  </Link>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <DueDate date={t.due_date} done={pct === 100} />
                    <Link href={`/task/${t.id}#commenti`} className="text-xs text-muted hover:text-brand">
                      💬 {commentCount(t)}
                    </Link>
                    <Link href={`/admin/task/${t.id}`} className="text-xs text-muted hover:text-brand">
                      ✎ Modifica
                    </Link>
                  </div>
                  {t.links?.length > 0 && (
                    <div className="mt-2"><LinkList links={t.links} compact /></div>
                  )}
                </div>
                <div className="w-40">
                  <div className="mb-1 flex items-baseline justify-between">
                    <span className="text-xs text-muted">Totale</span>
                    <span className="text-xl font-semibold tabular-nums">{pct}%</span>
                  </div>
                  <ProgressBar value={pct} />
                </div>
              </div>

              <ul className="mt-4 divide-y divide-line border-t border-line">
                {t.task_assignees.map((a) => (
                  <li key={a.user_id} className="py-2.5 text-sm">
                    <div className="flex items-center gap-3">
                      <Link
                        href={filterLink({ collaboratore: a.user_id })}
                        className="w-40 truncate font-medium hover:underline"
                      >
                        {a.profiles?.full_name || a.profiles?.email}
                      </Link>
                      <div className="flex-1"><ProgressBar value={a.progress} size="sm" /></div>
                      <span className="w-10 text-right tabular-nums">{a.progress}%</span>
                      <span className="hidden w-28 text-right text-xs text-muted md:inline">
                        {a.progress > 0 ? formatDateTime(a.updated_at) : "—"}
                      </span>
                    </div>
                    {a.note && (
                      <p className="mt-1 ml-0 rounded-md bg-stone-50 px-3 py-1.5 text-xs text-stone-700 md:ml-43">
                        💬 {a.note}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </BulkForm>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums ${tone ?? ""}`}>{value}</div>
    </div>
  );
}
