"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getClients, getEmployees } from "@/lib/data";
import { checkRows, MAX_ROWS, norm, type RawRow } from "@/lib/csv-import";
import { sendPush } from "@/lib/push";

export type ImportResult = { ok?: boolean; error?: string; created?: number; skipped?: number; newClients?: number };

export async function importTasks(records: RawRow[], createClients: boolean): Promise<ImportResult> {
  const admin = await requireAdmin();
  if (!Array.isArray(records) || !records.length) return { error: "Nessuna riga da importare." };
  if (records.length > MAX_ROWS) return { error: `Massimo ${MAX_ROWS} righe per import.` };

  // Rivalido tutto sul server con i dati aggiornati
  const [people, clients] = await Promise.all([getEmployees(true), getClients()]);
  const rows = checkRows(records, people, clients, { createClients });
  const valid = rows.filter((r) => r.errors.length === 0);
  if (!valid.length) return { error: "Nessuna riga valida da importare." };

  const supabase = await createClient();

  // 1. Clienti nuovi
  const clientIds = new Map(clients.map((c) => [norm(c.name), c.id]));
  const toCreate = [
    ...new Map(valid.filter((r) => r.newClient).map((r) => [norm(r.clientName), r.clientName.trim()])).values(),
  ];
  if (toCreate.length) {
    const { data, error } = await supabase.from("clients").insert(toCreate.map((name) => ({ name }))).select("id, name");
    if (error) return { error: "Errore creando i clienti: " + error.message };
    for (const c of data ?? []) clientIds.set(norm(c.name as string), c.id as string);
  }

  // 2. Task (id generati qui, così le assegnazioni puntano sempre al task giusto)
  const ids = valid.map(() => crypto.randomUUID());
  const { data: inserted, error: tErr } = await supabase
    .from("tasks")
    .insert(
      valid.map((r, i) => ({
        id: ids[i],
        title: r.title,
        description: r.description,
        client_id: r.clientName ? clientIds.get(norm(r.clientName)) ?? null : null,
        priority: r.priority,
        due_date: r.dueDate,
        links: r.links,
        created_by: admin.id,
      })),
    )
    .select("id");
  if (tErr || !inserted || inserted.length !== valid.length) {
    return { error: "Errore creando i task: " + (tErr?.message ?? "risposta incompleta") };
  }

  // 3. Assegnazioni (i trigger creano le notifiche interne)
  const assignments = valid.flatMap((r, i) =>
    r.assigneeIds.map((user_id) => ({ task_id: ids[i], user_id })),
  );
  const { error: aErr } = await supabase.from("task_assignees").insert(assignments);
  if (aErr) {
    // annullo i task appena creati per non lasciare task senza assegnatari
    await supabase.from("tasks").delete().in("id", ids);
    return { error: "Errore nelle assegnazioni, import annullato: " + aErr.message };
  }

  // 4. Una sola notifica push riassuntiva per collaboratore
  const perUser = new Map<string, { count: number; first: string; taskId: string }>();
  valid.forEach((r, i) => {
    for (const uid of r.assigneeIds) {
      if (uid === admin.id) continue;
      const cur = perUser.get(uid);
      if (cur) cur.count++;
      else perUser.set(uid, { count: 1, first: r.title, taskId: ids[i] });
    }
  });
  const who = admin.full_name || "L'admin";
  after(async () => {
    for (const [uid, info] of perUser) {
      await sendPush([uid], {
        title: info.count === 1 ? "Nuovo task assegnato" : `${info.count} nuovi task assegnati`,
        body:
          info.count === 1
            ? `${who} ti ha assegnato: ${info.first}`
            : `${who} ti ha assegnato ${info.count} task, tra cui: ${info.first}`,
        url: info.count === 1 ? `/task/${info.taskId}` : "/miei-task",
        tag: "import",
      });
    }
  });

  revalidatePath("/", "layout");
  return { ok: true, created: valid.length, skipped: rows.length - valid.length, newClients: toCreate.length };
}
