import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logout } from "@/app/login/actions";
import { MobileMenu, Nav } from "@/components/nav";
import { Bell } from "@/components/bell";
import { PushToggle } from "@/components/push-toggle";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireUser();
  const isAdmin = profile.role === "admin";
  const userName = profile.full_name || profile.email;

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
    <div className="min-h-screen [--header-h:calc(61px+env(safe-area-inset-top))] md:[--header-h:calc(65px+env(safe-area-inset-top))]">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-[60px] max-w-6xl items-center gap-4 px-4 md:h-16">
          <Link href="/" className="shrink-0" aria-label="Kappaelle comunicazione — home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Kappaelle comunicazione" width={243} height={80} className="h-9 w-auto md:h-10" />
          </Link>
          <div className="min-w-0 flex-1">
            <Nav items={items} />
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <Bell initial={count ?? 0} />
            <span className="hidden max-w-40 truncate text-sm text-muted lg:inline">{userName}</span>
            <form action={logout} className="hidden md:block">
              <button className="text-sm text-muted hover:text-ink">Esci</button>
            </form>
            <MobileMenu items={items} userName={userName} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 md:py-8">
        <PushToggle variant="banner" />
        {children}
      </main>
    </div>
  );
}
