import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TASK_SELECT, type Task } from "@/lib/types";
import { TaskForm } from "../../task-form";
import { getClients, getEmployees } from "@/lib/data";
import { deleteTask, setArchived } from "../../actions";
import { ConfirmButton } from "@/components/confirm-button";

export default async function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("tasks").select(TASK_SELECT).eq("id", id).maybeSingle();
  if (!data) notFound();
  const task = data as unknown as Task;

  const [clients, allEmployees] = await Promise.all([getClients(), getEmployees(false)]);
  // mostra i collaboratori attivi + eventuali disattivati ancora assegnati a questo task
  const assignedIds = new Set(task.task_assignees.map((a) => a.user_id));
  const employees = allEmployees.filter((e) => e.active || assignedIds.has(e.id));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Modifica task</h1>
        <div className="flex gap-2">
          <form action={setArchived}>
            <input type="hidden" name="id" value={task.id} />
            <input type="hidden" name="archived" value={String(!task.archived)} />
            <button className="btn-ghost">{task.archived ? "Ripristina" : "Archivia"}</button>
          </form>
          <form action={deleteTask}>
            <input type="hidden" name="id" value={task.id} />
            <ConfirmButton className="btn-danger" message="Eliminare definitivamente questo task?">
              Elimina
            </ConfirmButton>
          </form>
        </div>
      </div>
      {task.archived && (
        <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Task archiviato: non compare ai collaboratori.
        </p>
      )}
      <TaskForm task={task} clients={clients} employees={employees} />
    </div>
  );
}
