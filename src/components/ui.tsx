import type { Priority } from "@/lib/types";

export function ProgressBar({ value, size = "md" }: { value: number; size?: "sm" | "md" }) {
  const done = value >= 100;
  return (
    <div className={`w-full overflow-hidden rounded-full bg-stone-100 ${size === "sm" ? "h-1.5" : "h-2.5"}`}>
      <div
        className={`h-full rounded-full transition-all ${done ? "bg-ok" : "bg-accent"}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

const PRIORITY_STYLE: Record<Priority, string> = {
  bassa: "bg-stone-100 text-stone-600",
  media: "bg-sky-50 text-sky-700",
  alta: "bg-amber-50 text-amber-700",
  urgente: "bg-red-50 text-red-700",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${PRIORITY_STYLE[priority]}`}>
      {priority}
    </span>
  );
}

export function DueDate({ date, done }: { date: string | null; done?: boolean }) {
  if (!date) return <span className="text-xs text-muted">Nessuna scadenza</span>;
  const d = new Date(date + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((d.getTime() - today.getTime()) / 86400000);
  const label = d.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });

  let tone = "text-muted";
  let extra = "";
  if (!done) {
    if (days < 0) {
      tone = "text-red-700 font-medium";
      extra = " · scaduto";
    } else if (days === 0) {
      tone = "text-amber-700 font-medium";
      extra = " · oggi";
    } else if (days <= 2) {
      tone = "text-amber-700";
      extra = ` · tra ${days} gg`;
    }
  }
  return <span className={`text-xs ${tone}`}>Scadenza {label}{extra}</span>;
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("it-IT", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome",
  });
}
