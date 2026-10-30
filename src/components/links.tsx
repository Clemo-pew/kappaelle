import type { TaskLink } from "@/lib/types";

function kind(url: string) {
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return { icon: "🔗", host: url };
  }
  if (host.includes("drive.google") || host.includes("docs.google")) return { icon: "📁", host: "Google Drive" };
  if (host.includes("dropbox")) return { icon: "📦", host: "Dropbox" };
  if (host.includes("wetransfer") || host.includes("we.tl")) return { icon: "📨", host: "WeTransfer" };
  if (host.includes("figma")) return { icon: "🎨", host: "Figma" };
  if (host.includes("canva")) return { icon: "🎨", host: "Canva" };
  if (host.includes("onedrive") || host.includes("sharepoint") || host.includes("1drv")) return { icon: "📁", host: "OneDrive" };
  return { icon: "🔗", host };
}

export function LinkList({ links, compact = false }: { links: TaskLink[]; compact?: boolean }) {
  if (!links?.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((l, i) => {
        const k = kind(l.url);
        return (
          <a
            key={i}
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex max-w-full items-center gap-2 rounded-lg border border-line bg-white transition hover:border-brand hover:bg-brand/5 ${
              compact ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm"
            }`}
            title={l.url}
          >
            <span aria-hidden>{k.icon}</span>
            <span className="truncate font-medium">{l.label || k.host}</span>
            {!compact && l.label && <span className="hidden truncate text-xs text-muted sm:inline">{k.host}</span>}
          </a>
        );
      })}
    </div>
  );
}
