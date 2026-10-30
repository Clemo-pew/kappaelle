import { LoginForm } from "./login-form";
import { logout } from "./actions";

const ERRORS: Record<string, string> = {
  schema:
    "Accesso riuscito, ma il database non risponde come previsto. Verifica di aver eseguito supabase/schema.sql nell'SQL Editor di Supabase.",
  profilo:
    "Accesso riuscito, ma per questo utente non esiste un profilo. Riesegui supabase/schema.sql nell'SQL Editor: crea i profili mancanti.",
  disattivato: "Il tuo account è stato disattivato. Contatta l'amministratore.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ errore?: string }> }) {
  const { errore } = await searchParams;
  const message = errore ? ERRORS[errore] : undefined;

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-xl font-bold text-white">
            K
          </div>
          <h1 className="text-xl font-semibold">Kappaelle Task</h1>
          <p className="text-sm text-muted">Accedi con le tue credenziali</p>
        </div>

        {message ? (
          <div className="card space-y-4 p-6">
            <p className="text-sm text-red-700">{message}</p>
            <form action={logout}>
              <button className="btn-ghost w-full">Esci e riprova</button>
            </form>
          </div>
        ) : (
          <LoginForm />
        )}
      </div>
    </main>
  );
}
