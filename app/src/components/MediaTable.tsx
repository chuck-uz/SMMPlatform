"use client";

import { useState } from "react";
import type { MediaTableRow } from "@/lib/analyticsDashboard";

type SortKey = "postedAt" | "likeCount" | "commentsCount" | "reach";

const COLUMNS: Array<{ key: SortKey; label: string }> = [
  { key: "postedAt", label: "Дата" },
  { key: "likeCount", label: "Лайки" },
  { key: "commentsCount", label: "Комментарии" },
  { key: "reach", label: "Охват" },
];

const TYPE_LABELS: Record<string, string> = {
  FEED: "Пост",
  REELS: "Reels",
  STORY: "Сторис",
};

function sortValue(row: MediaTableRow, key: SortKey): number {
  if (key === "postedAt") return row.postedAt.getTime();
  if (key === "reach") return row.reach ?? -1;
  return row[key];
}

export function MediaTable({ rows }: { rows: MediaTableRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("postedAt");
  const [sortDesc, setSortDesc] = useState(true);

  if (rows.length === 0) {
    return (
      <div className="rounded-[14px] border border-dashed border-border bg-card p-6 text-sm text-subtle">
        Пока нет публикаций.
      </div>
    );
  }

  const sorted = [...rows].sort((a, b) => {
    const diff = sortValue(a, sortKey) - sortValue(b, sortKey);
    return sortDesc ? -diff : diff;
  });

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDesc((prev) => !prev);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  }

  return (
    <div className="overflow-x-auto rounded-[14px] border border-border bg-card shadow-card">
      <div className="min-w-[640px]">
        <div className="grid grid-cols-[minmax(0,1fr)_110px_90px_130px_90px] items-center gap-4 border-b border-border bg-muted/60 px-[22px] py-[11px] text-[11.5px] font-semibold uppercase tracking-wide text-subtle">
          <span>Публикация</span>
          {COLUMNS.map((column) => (
            <button
              key={column.key}
              type="button"
              onClick={() => handleSort(column.key)}
              className="flex cursor-pointer items-center gap-1 text-left uppercase tracking-wide text-subtle hover:text-foreground"
            >
              {column.label}
              {sortKey === column.key && <span>{sortDesc ? "↓" : "↑"}</span>}
            </button>
          ))}
        </div>
        {sorted.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-[minmax(0,1fr)_110px_90px_130px_90px] items-center gap-4 border-t border-border px-[22px] py-3 text-[13px] text-foreground first:border-t-0"
          >
            <div className="min-w-0">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                  {TYPE_LABELS[row.mediaProductType ?? ""] ?? row.mediaType}
                </span>
                {row.permalink ? (
                  <a
                    href={row.permalink}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 truncate text-accent-hover hover:underline"
                  >
                    {row.caption || "Без подписи"}
                  </a>
                ) : (
                  <span className="min-w-0 truncate text-muted-foreground">{row.caption || "Без подписи"}</span>
                )}
              </span>
            </div>
            <span className="text-muted-foreground">
              {row.postedAt.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", timeZone: "UTC" })}
            </span>
            <span>{row.likeCount}</span>
            <span>{row.commentsCount}</span>
            <span>{row.reach ?? "—"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
