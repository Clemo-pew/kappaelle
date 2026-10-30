import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { deleteClient, renameClient } from "../actions";
import { AddClientForm } from "./add-client-form";
import { ConfirmButton } from "@/components/confirm-button";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("clients")
    .select("id, name, tasks(id, archived)")
    .order("name");
  const clients = (data ?? []) as { id: string; name: string; tasks: { id: string; archived: boolean }[] }[];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Clienti e progetti</h1>
        <p className="text-sm text-muted">Usali per raggruppare e filtrare i task.</p>
      </div>

      <AddClientForm />

      <div className="card divide-y divide-line">
        {clients.length === 0 && <p className="p-6 text-sm text-muted">Nessun cliente ancora.</p>}
        {clients.map((c) => {
          const active = c.tasks.filter((t) => !t.archived).length;
          return (
            <div key={c.id} className="flex flex-wrap items-center gap-3 p-4">
              <form action={renameClient} className="flex flex-1 items-center gap-2">
                <input type="hidden" name="id" value={c.id} />
                <input name="name" defaultValue={c.name} className="input max-w-xs" aria-label="Nome cliente" />
                <button className="btn-ghost">Rinomina</button>
              </form>
              <Link href={`/admin?cliente=${c.id}&stato=tutti`} className="text-sm text-brand hover:underline">
                {active} task
              </Link>
              <form action={deleteClient}>
                <input type="hidden" name="id" value={c.id} />
                <ConfirmButton
                  className="btn-danger"
                  message={`Eliminare "${c.name}"? I task restano, ma senza cliente.`}
                >
                  Elimina
                </ConfirmButton>
              </form>
            </div>
          );
        })}
      </div>
    </div>
  );
}
