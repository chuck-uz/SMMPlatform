import Link from "next/link";
import { ExclamationTriangleIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { prisma } from "@/lib/prisma";
import { daysUntilExpiry } from "@/lib/instagramOAuth";

const ERROR_MESSAGES: Record<string, string> = {
  oauth_state: "Не удалось подтвердить запрос авторизации — попробуйте подключить аккаунт заново.",
  not_configured: "Instagram-интеграция ещё не настроена на сервере.",
  connect_failed: "Не удалось подключить аккаунт. Попробуйте ещё раз.",
};

const EXPIRY_WARNING_THRESHOLD_DAYS = 7;

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const accounts = await prisma.instagramAccount.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, username: true, tokenExpiresAt: true },
  });
  const now = new Date();

  return (
    <div className="max-w-2xl">
      <h1 className="font-semibold text-2xl text-foreground">Подключения</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Единое окно, где подключаются каналы: Instagram — через официальный вход Meta. Здесь
        виден статус подключений и срок действия доступа.
      </p>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p>{ERROR_MESSAGES[error] ?? "Не удалось подключить аккаунт."}</p>
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-lg border border-border bg-card">
        {accounts.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">
            Пока нет подключённых аккаунтов Instagram.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {accounts.map((account) => {
              const days = daysUntilExpiry(account.tokenExpiresAt, now);
              const isExpiringSoon = days <= EXPIRY_WARNING_THRESHOLD_DAYS;

              return (
                <li
                  key={account.id}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-foreground">@{account.username}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {days >= 0 ? `Доступ действует ещё ${days} дн.` : "Срок доступа истёк"}
                    </p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-sm px-3 py-1 text-xs font-semibold ${
                      isExpiringSoon
                        ? "bg-warning/10 text-warning"
                        : "bg-accent/10 text-accent"
                    }`}
                  >
                    {isExpiringSoon ? (
                      <ExclamationTriangleIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <CheckCircleIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {isExpiringSoon ? "Скоро истекает" : "Подключено"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Link
        href="/api/instagram/authorize"
        className="mt-6 inline-flex items-center justify-center rounded-sm bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-colors duration-200 hover:bg-accent/90"
      >
        Подключить Instagram
      </Link>
    </div>
  );
}
