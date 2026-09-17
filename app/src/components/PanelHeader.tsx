"use client";

import { usePathname } from "next/navigation";

const TITLES: Record<string, string> = {
  connections: "Подключения",
  scenarios: "Агент",
  inbox: "Инбокс",
  leads: "Заявки",
  analytics: "Аналитика",
  content: "Контент",
  users: "Пользователи",
  profile: "Профиль",
};

export function PanelHeader({ host }: { host?: string | null }) {
  const pathname = usePathname();
  const segment = pathname.split("/")[2] ?? "connections";
  const title = TITLES[segment] ?? segment;

  return (
    <div className="border-b border-border bg-card px-6 py-5 sm:px-10">
      <div className="mb-1.5 flex items-center gap-1.5 text-[12.5px] text-subtle">
        {host ? (
          <>
            <span>{host}</span>
            <span>/</span>
          </>
        ) : null}
        <span>panel</span>
        <span>/</span>
        <span className="text-muted-foreground">{segment}</span>
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
    </div>
  );
}
