import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAnonKey, supabaseEnvNames, supabaseUrl } from "@/lib/env";

function setupErrorPage(missing: string[]) {
  const found = supabaseEnvNames();
  const env = process.env.VERCEL_ENV ?? "locale";
  const html = `<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Configurazione mancante</title>
<body style="font-family:system-ui,sans-serif;max-width:640px;margin:60px auto;padding:0 16px;color:#1c1917;line-height:1.5">
<h1 style="font-size:20px">Configurazione mancante</h1>
<p>Non trovo queste variabili d'ambiente:</p>
<ul>${missing.map((m) => `<li><code>${m}</code></li>`).join("")}</ul>
<p><b>Ambiente di questo deploy:</b> <code>${env}</code></p>
<p><b>Variabili Supabase che vedo</b> (solo i nomi):
${found.length ? `<ul>${found.map((m) => `<li><code>${m}</code></li>`).join("")}</ul>` : " <i>nessuna</i></p>"}
<p>Controlla in <b>Settings → Environment Variables</b> che i nomi siano identici e che sia spuntato l'ambiente <code>${env}</code>, poi fai <b>Redeploy</b>.</p>
</body></html>`;
  return new NextResponse(html, { status: 500, headers: { "content-type": "text/html; charset=utf-8" } });
}

export async function proxy(request: NextRequest) {
  const url = supabaseUrl();
  const key = supabaseAnonKey();
  const missing = [
    !url && "NEXT_PUBLIC_SUPABASE_URL",
    !key && "NEXT_PUBLIC_SUPABASE_ANON_KEY (o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)",
  ].filter(Boolean) as string[];
  if (missing.length) return setupErrorPage(missing);

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url!, key!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Aggiorna la sessione (non rimuovere: mantiene vivo il login)
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (e) {
    console.error("[proxy] Supabase non raggiungibile:", e);
  }

  const isLogin = request.nextUrl.pathname.startsWith("/login");

  if (!user && !isLogin) {
    const to = request.nextUrl.clone();
    to.pathname = "/login";
    to.search = "";
    return NextResponse.redirect(to);
  }

  // Utente loggato sulla pagina di login → home (tranne quando c'è un errore da mostrare)
  if (user && isLogin && !request.nextUrl.searchParams.has("errore")) {
    const to = request.nextUrl.clone();
    to.pathname = "/";
    return NextResponse.redirect(to);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
