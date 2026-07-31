import { useEffect, useState } from "react";
import { EXPLORER_URL } from "../../config";
import { trackReceipt } from "../../chain/tx";
import {
  getLocal,
  type ActivityItem,
  type Settings,
} from "../../keyring/storage";
import { shortAddress, timeAgo } from "../../lib/format";
import { MicroLabel, Spinner } from "../../shared/ui";

export function Activity({ settings }: { settings: Settings }) {
  const [items, setItems] = useState<ActivityItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = (await getLocal("activity")) ?? [];
      if (cancelled) return;
      setItems(list);
      // Settle anything still pending, then re-read.
      const pending = list.filter((a) => a.status === "pending");
      if (pending.length) {
        await Promise.all(
          pending.map((a) => trackReceipt(a.hash, settings.rpcUrl)),
        );
        const updated = (await getLocal("activity")) ?? [];
        if (!cancelled) setItems(updated);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [settings.rpcUrl]);

  const groups = groupByDay(items ?? []);

  return (
    <div className="flex flex-col gap-3 px-3 pb-4 pt-4">
      <MicroLabel className="px-1">activity</MicroLabel>
      {!items && (
        <div className="glass flex items-center justify-center gap-2 rounded-2xl border border-border/60 p-6 text-sm text-muted-foreground">
          <Spinner /> Loading…
        </div>
      )}
      {items?.length === 0 && (
        <div className="glass rounded-2xl border border-border/60 px-4 py-8 text-center text-sm text-muted-foreground">
          Nothing yet. Transactions you send from this wallet show up here.
        </div>
      )}
      {groups.map((group) => (
        <div key={group.label} className="space-y-1.5">
          <div className="px-1 font-mono-num text-[10px] uppercase tracking-wider text-muted-foreground/70">
            {group.label}
          </div>
          <div className="glass divide-y divide-border/40 overflow-hidden rounded-2xl border border-border/60">
            {group.items.map((item) => (
          <a
            key={item.hash}
            href={`${EXPLORER_URL}/tx/${item.hash}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 px-3.5 py-3 transition-colors hover:bg-foreground/5"
          >
            <StatusIcon status={item.status} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">
                {item.summary}
              </span>
              <span className="font-mono-num text-[11px] text-muted-foreground">
                <span className="uppercase text-primary/80">{item.kind}</span> ·{" "}
                {shortAddress(item.hash)} · {timeAgo(item.ts)}
              </span>
            </span>
                <span
                  className={`font-mono-num text-[10px] uppercase tracking-wider ${
                    item.status === "confirmed"
                      ? "text-mint"
                      : item.status === "failed"
                        ? "text-danger"
                        : "text-warning"
                  }`}
                >
                  {item.status}
                </span>
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function groupByDay(items: ActivityItem[]): { label: string; items: ActivityItem[] }[] {
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86_400_000).toDateString();
  const groups: { label: string; items: ActivityItem[] }[] = [];
  for (const item of items) {
    const day = new Date(item.ts).toDateString();
    const label =
      day === today
        ? "today"
        : day === yesterday
          ? "yesterday"
          : new Date(item.ts).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            });
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}

function StatusIcon({ status }: { status: ActivityItem["status"] }) {
  if (status === "pending") {
    return (
      <span className="text-warning">
        <Spinner className="h-4 w-4" />
      </span>
    );
  }
  const confirmed = status === "confirmed";
  return (
    <span
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
        confirmed
          ? "border-mint/40 bg-mint/10 text-mint"
          : "border-danger/40 bg-danger/10 text-danger"
      }`}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {confirmed ? <path d="M4 12.5 9.5 18 20 6.5" /> : <path d="M6 6l12 12M18 6 6 18" />}
      </svg>
    </span>
  );
}
