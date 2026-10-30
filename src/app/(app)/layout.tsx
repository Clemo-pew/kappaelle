import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logout } from "@/app/login/actions";
import { Nav } from "@/components/nav";
import { Bell } from "@/components/bell";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireUser();
  const isAdmin = profile.role === "admin";

  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", profile.id)
    .is("read_at", null);

  const items = isAdmin
    ? [
        { href: "/admin", label: "Tutti i task" },
        { href: "/miei-task", label: "I miei task" },
        { href: "/admin/collaboratori", label: "Collaboratori" },
        { href: "/admin/clienti", label: "Clienti" },
      ]
    : [{ href: "/miei-task", label: "I miei task" }];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Link href="/" className="shrink-0" aria-label="Kappaelle comunicazione — home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Kappaelle comunicazione" width={243} height={80} className="h-9 w-auto sm:h-10" />
          </Link>
          <div className="min-w-0 flex-1">
            <Nav items={items} />
          </div>
          <div className="flex items-center gap-3">
            <Bell initial={count ?? 0} />
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
