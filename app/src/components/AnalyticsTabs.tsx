import Link from "next/link";

export const ANALYTICS_TABS: Array<{ value: string; label: string }> = [
  { value: "overview", label: "Обзор" },
  { value: "posts", label: "Публикации" },
  { value: "summary", label: "Сводка" },
  { value: "ai", label: "AI и стратегия" },
];

export function AnalyticsTabs({
  activeTab,
  accountId,
  preset,
  from,
  to,
}: {
  activeTab: string;
  accountId: string;
  preset: string;
  from?: string;
  to?: string;
}) {
  function buildHref(tab: string) {
    const params = new URLSearchParams();
    params.set("account", accountId);
    params.set("period", preset);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (tab !== "overview") params.set("tab", tab);
    return `/panel/analytics?${params.toString()}`;
  }

  return (
    <div className="mt-5 flex gap-1">
      {ANALYTICS_TABS.map((tab) => (
        <Link
          key={tab.value}
          href={buildHref(tab.value)}
          className={`rounded-sm px-3 py-1.5 text-sm font-medium transition-colors duration-200 ${
            activeTab === tab.value
              ? "bg-accent/10 text-accent"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
