import Link from "next/link";
import { getClients, getEmployees } from "@/lib/data";
import { ImportWizard } from "./import-wizard";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const [people, clients] = await Promise.all([getEmployees(true), getClients()]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link href="/admin" className="text-sm text-muted hover:text-ink">← Tutti i task</Link>
        <h1 className="mt-2 text-2xl font-semibold">Importa task da CSV</h1>
        <p className="text-sm text-muted">
          Carica più task insieme. Prima dell&apos;import vedrai l&apos;anteprima con eventuali errori da correggere.
        </p>
      </div>
      <ImportWizard
        people={people.map((p) => ({ id: p.id, full_name: p.full_name, email: p.email }))}
        clients={clients}
      />
    </div>
  );
}
