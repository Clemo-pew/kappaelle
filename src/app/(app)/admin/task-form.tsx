"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { saveTask, type FormState } from "./actions";
import { PRIORITIES, type Client, type Profile, type Task } from "@/lib/types";

export function TaskForm({
  task,
  clients,
  employees,
}: {
  task?: Task;
  clients: Client[];
  employees: Profile[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveTask, {});
  const [selected, setSelected] = useState<Set<string>>(
    new Set(task?.task_assignees.map((a) => a.user_id) ?? []),
  );
  const progressOf = new Map(task?.task_assignees.map((a) => [a.user_id, a.progress]) ?? []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <form action={action} className="card space-y-5 p-6">
      {task && <input type="hidden" name="id" value={task.id} />}

      <div>
        <label className="label" htmlFor="title">Titolo *</label>
        <input id="title" name="title" required defaultValue={task?.title} className="input" placeholder="Es. Piano editoriale Instagram novembre" />
      </div>

      <div>
        <label className="label" htmlFor="description">Descrizione</label>
        <textarea
          id="description"
          name="description"
          rows={5}
          defaultValue={task?.description}
          className="input resize-y"
          placeholder="Dettagli, link, materiali, indicazioni…"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="client_id">Cliente / progetto</label>
          <select id="client_id" name="client_id" defaultValue={task?.client_id ?? ""} className="input">
            <option value="">— Interno / nessuno —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="priority">Priorità</label>
          <select id="priority" name="priority" defaultValue={task?.priority ?? "media"} className="input capitalize">
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="due_date">Scadenza</label>
          <input id="due_date" name="due_date" type="date" defaultValue={task?.due_date ?? ""} className="input" />
        </div>
      </div>

      <fieldset>
        <legend className="label">Assegnato a * <span className="normal-case">({selected.size} selezionati)</span></legend>
        {employees.length === 0 ? (
          <p className="text-sm text-muted">
            Nessun collaboratore. <Link href="/admin/collaboratori" className="text-brand underline">Creane uno</Link>.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {employees.map((e) => {
              const on = selected.has(e.id);
              return (
                <label
                  key={e.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition ${
                    on ? "border-brand bg-brand/10" : "border-line bg-white hover:bg-stone-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    name="assignees"
                    value={e.id}
                    checked={on}
                    onChange={() => toggle(e.id)}
                    className="accent-[var(--color-brand)]"
                  />
                  <span className="flex-1 truncate">{e.full_name || e.email}</span>
                  {progressOf.has(e.id) && <span className="text-xs text-muted">{progressOf.get(e.id)}%</span>}
                </label>
              );
            })}
          </div>
        )}
        {task && (
          <p className="mt-2 text-xs text-muted">
            Chi era già assegnato mantiene la sua percentuale. Togliendo una persona si perde il suo avanzamento.
          </p>
        )}
      </fieldset>

      {state.error && <p className="text-sm text-red-700">{state.error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Salvataggio…" : task ? "Salva modifiche" : "Crea task"}
        </button>
        <Link href="/admin" className="btn-ghost">Annulla</Link>
      </div>
    </form>
  );
}
