import { requireAdmin } from "@/lib/auth";
import { getEmployees } from "../data";
import { setEmployeeActive, updateEmployee } from "../actions";
import { NewEmployeeForm, ResetPasswordForm } from "./forms";

export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  const me = await requireAdmin();
  const employees = await getEmployees(false);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Dipendenti</h1>
        <p className="text-sm text-muted">Crea gli account e gestisci gli accessi del team.</p>
      </div>

      <NewEmployeeForm />

      <div className="card divide-y divide-line">
        {employees.map((e) => (
          <div key={e.id} className={`flex flex-wrap items-center gap-3 p-4 ${e.active ? "" : "opacity-60"}`}>
            <form action={updateEmployee} className="flex flex-1 flex-wrap items-center gap-3">
              <input type="hidden" name="id" value={e.id} />
              <input name="full_name" defaultValue={e.full_name} className="input w-48" aria-label="Nome" />
              <span className="w-56 truncate text-sm text-muted">{e.email}</span>
              <select
                name="role"
                defaultValue={e.role}
                disabled={e.id === me.id}
                className="input w-36"
                aria-label="Ruolo"
              >
                <option value="employee">Dipendente</option>
                <option value="admin">Admin</option>
              </select>
              <button className="btn-ghost">Salva</button>
            </form>

            <ResetPasswordForm id={e.id} />

            {e.id !== me.id && (
              <form action={setEmployeeActive}>
                <input type="hidden" name="id" value={e.id} />
                <input type="hidden" name="active" value={String(!e.active)} />
                <button className={e.active ? "btn-danger" : "btn-ghost"}>
                  {e.active ? "Disattiva" : "Riattiva"}
                </button>
              </form>
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted">
        Un dipendente disattivato non può più accedere, ma i suoi task e il suo storico restano.
      </p>
    </div>
  );
}
