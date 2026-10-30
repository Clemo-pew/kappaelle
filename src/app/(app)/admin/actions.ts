"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { sendPush } from "@/lib/push";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { PRIORITIES, type Priority, type TaskLink } from "@/lib/types";

export type FormState = { ok?: boolean; error?: string; message?: string };

function refresh() {
  revalidatePath("/", "layout");
}

// ------------------------------------------------------------------ TASK

function readTaskForm(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const clientId = String(formData.get("client_id") ?? "") || null;
  const priority = String(formData.get("priority") ?? "media") as Priority;
  const dueDate = String(formData.get("due_date") ?? "") || null;
  const assignees = formData.getAll("assignees").map(String).filter(Boolean);
  return { title, description, clientId, priority, dueDate, assignees, links: parseLinks(formData.get("links")) };
}

function parseLinks(raw: FormDataEntryValue | null): TaskLink[] | { error: string } {
  let arr: unknown;
  try {
    arr = JSON.parse(String(raw ?? "[]"));
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  const out: TaskLink[] = [];
  for (const item of arr.slice(0, 20)) {
    let url = String((item as TaskLink)?.url ?? "").trim();
    const label = String((item as TaskLink)?.label ?? "").trim().slice(0, 80);
    if (!url) continue;
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    try {
      const u = new URL(url);
      if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error();
    } catch {
      return { error: `Link non valido: ${url}` };
    }
    out.push({ label, url });
  }
  return out;
}

export async function saveTask(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "") || null;
  const f = readTaskForm(formData);

  if (!f.title) return { error: "Il titolo è obbligatorio." };
  if (!PRIORITIES.includes(f.priority)) return { error: "Priorità non valida." };
  if (f.assignees.length === 0) return { error: "Assegna il task ad almeno un collaboratore." };
  if (!Array.isArray(f.links)) return { error: f.links.error };

  const payload = {
    title: f.title,
    description: f.description,
    client_id: f.clientId,
    priority: f.priority,
    due_date: f.dueDate,
    links: f.links,
  };

  let taskId = id;
  if (id) {
    const { error } = await supabase.from("tasks").update(payload).eq("id", id);
    if (error) return { error: error.message };
  } else {
    const { data, error } = await supabase
      .from("tasks")
      .insert({ ...payload, created_by: admin.id })
      .select("id")
      .single();
    if (error) return { error: error.message };
    taskId = data.id;
  }

  // Sincronizza gli assegnatari mantenendo la % di chi era già assegnato
  const { data: current } = await supabase.from("task_assignees").select("user_id").eq("task_id", taskId!);
  const currentIds = new Set((current ?? []).map((r) => r.user_id as string));
  const wanted = new Set(f.assignees);

  const toAdd = [...wanted].filter((u) => !currentIds.has(u));
  const toRemove = [...currentIds].filter((u) => !wanted.has(u));

  if (toAdd.length) {
    const { error } = await supabase
      .from("task_assignees")
      .insert(toAdd.map((user_id) => ({ task_id: taskId!, user_id })));
    if (error) return { error: error.message };

    // Notifica push ai nuovi assegnatari (dopo la risposta, senza rallentare il salvataggio)
    const recipients = toAdd.filter((u) => u !== admin.id);
    const who = admin.full_name || "L'admin";
    const due = f.dueDate
      ? ` · scadenza ${new Date(f.dueDate + "T00:00:00").toLocaleDateString("it-IT", { day: "numeric", month: "short" })}`
      : "";
    after(() =>
      sendPush(recipients, {
        title: "Nuovo task assegnato",
        body: `${who} ti ha assegnato: ${f.title}${due}`,
        url: `/task/${taskId}`,
        tag: `task-${taskId}`,
      }),
    );
  }
  if (toRemove.length) {
    const { error } = await supabase
      .from("task_assignees")
      .delete()
      .eq("task_id", taskId!)
      .in("user_id", toRemove);
    if (error) return { error: error.message };
  }

  refresh();
  redirect("/admin");
}

export async function setArchived(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const archived = formData.get("archived") === "true";
  await supabase.from("tasks").update({ archived }).eq("id", id);
  refresh();
  redirect("/admin");
}

export async function deleteTask(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("tasks").delete().eq("id", String(formData.get("id")));
  refresh();
  redirect("/admin");
}

// --------------------------------------------------------------- CLIENTI

export async function addClient(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Inserisci un nome." };
  const supabase = await createClient();
  const { error } = await supabase.from("clients").insert({ name });
  if (error) return { error: error.code === "23505" ? "Esiste già un cliente con questo nome." : error.message };
  refresh();
  return { ok: true };
}

export async function renameClient(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const supabase = await createClient();
  await supabase.from("clients").update({ name }).eq("id", String(formData.get("id")));
  refresh();
}

export async function deleteClient(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("clients").delete().eq("id", String(formData.get("id")));
  refresh();
}

// ------------------------------------------------------------ DIPENDENTI

export async function createEmployee(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = formData.get("role") === "admin" ? "admin" : "employee";

  if (!fullName || !email) return { error: "Nome ed email sono obbligatori." };
  if (password.length < 8) return { error: "La password deve avere almeno 8 caratteri." };

  const sb = createAdminClient();
  const { data, error } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) {
    return {
      error: /already|registered|exists/i.test(error.message)
        ? "Esiste già un account con questa email."
        : error.message,
    };
  }
  // Il profilo nasce 'employee' dal trigger: qui imposto nome e ruolo scelti
  await sb.from("profiles").update({ full_name: fullName, role }).eq("id", data.user.id);

  refresh();
  return { ok: true, message: `Account creato per ${fullName}. Comunica a ${email} la password iniziale.` };
}

export async function updateEmployee(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const fullName = String(formData.get("full_name") ?? "").trim();
  const role = formData.get("role") === "admin" ? "admin" : "employee";
  // Evita che l'admin si tolga da solo i permessi
  const safeRole = id === admin.id ? "admin" : role;

  const supabase = await createClient();
  await supabase.from("profiles").update({ full_name: fullName, role: safeRole }).eq("id", id);
  refresh();
}

export async function setEmployeeActive(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const active = formData.get("active") === "true";
  if (id === admin.id) return;

  const sb = createAdminClient();
  // Disattivato = non può più accedere (ban), ma storico e task restano
  await sb.auth.admin.updateUserById(id, { ban_duration: active ? "none" : "876000h" });
  await sb.from("profiles").update({ active }).eq("id", id);
  refresh();
}

export async function resetPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const id = String(formData.get("id"));
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: "Almeno 8 caratteri." };

  const sb = createAdminClient();
  const { error } = await sb.auth.admin.updateUserById(id, { password });
  if (error) return { error: error.message };
  return { ok: true, message: "Password aggiornata." };
}
