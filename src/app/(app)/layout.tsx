import { requireUser } from "@/lib/auth";
import { logout } from "@/app/login/actions";
import { Nav } from "@/components/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireUser();
  const isAdmin = profile.role === "admin";

  const items = isAdmin
    ? [
        { href: "/admin", label: "Tutti i task" },
        { href: "/miei-task", label: "I miei task" },
        { href: "/admin/dipendenti", label: "Dipendenti" },
        { href: "/admin/clienti", label: "Clienti" },
      ]
    : [{ href: "/miei-task", label: "I miei task" }];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white">K</div>
            <span className="hidden font-semibold sm:inline">Kappaelle</span>
          </div>
          <div className="min-w-0 flex-1">
            <Nav items={items} />
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted md:inline">{profile.full_name || profile.email}</span>
            <form action={logout}>
              <button className="text-sm text-muted hover:text-ink">Esci</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
