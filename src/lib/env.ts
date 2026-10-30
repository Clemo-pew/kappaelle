// Accetta sia i nomi "classici" sia quelli creati dall'integrazione Supabase ↔ Vercel.
// NB: i riferimenti a process.env.NEXT_PUBLIC_* devono restare letterali (Next li incorpora in build).

const clean = (v: string | undefined) => (v ?? "").trim().replace(/^["']|["']$/g, "") || undefined;

export function supabaseUrl() {
  return clean(process.env.NEXT_PUBLIC_SUPABASE_URL) ?? clean(process.env.SUPABASE_URL);
}

export function supabaseAnonKey() {
  return (
    clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ??
    clean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ??
    clean(process.env.SUPABASE_ANON_KEY) ??
    clean(process.env.SUPABASE_PUBLISHABLE_KEY)
  );
}

export function supabaseServiceKey() {
  return clean(process.env.SUPABASE_SERVICE_ROLE_KEY) ?? clean(process.env.SUPABASE_SECRET_KEY);
}

/** Nomi (mai valori) delle variabili che contengono "SUPABASE", per la diagnosi. */
export function supabaseEnvNames() {
  return Object.keys(process.env)
    .filter((k) => k.toUpperCase().includes("SUPABASE"))
    .sort();
}
