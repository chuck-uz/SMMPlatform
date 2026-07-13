import Link from "next/link";
import { ExclamationTriangleIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { daysUntilExpiry } from "@/lib/instagramOAuth";
import { DisconnectInstagramButton } from "@/components/DisconnectInstagramButton";
import { ClaudeApiKeyForm } from "@/components/ClaudeApiKeyForm";

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
  const session = await auth();
  const isAdmin = session?.user?.role === "admin";

  const claudeConfig = isAdmin
    ? await prisma.claudeApiKeyConfig.findUnique({ where: { singleton: "claude" } })
    : null;

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

      <h2 className="mt-8 font-semibold text-sm text-foreground">Instagram</h2>
      <div className="mt-3 overflow-hidden rounded-lg border border-border bg-card">
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
                  <div className="flex shrink-0 items-center gap-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-sm px-3 py-1 text-xs font-semibold ${
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
                    <DisconnectInstagramButton accountId={account.id} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Link
        href="/api/instagram/authorize"
        className="mt-4 inline-flex items-center justify-center rounded-sm bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-colors duration-200 hover:bg-accent/90"
      >
        Подключить Instagram
      </Link>

      {isAdmin && (
        <>
          <h2 className="mt-8 font-semibold text-sm text-foreground">Claude API</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Ключ используется для аналитики, контент-плана и автоответов. Хранится
            зашифрованным, доступен только администратору.
          </p>
          <div className="mt-3 rounded-lg border border-border bg-card p-4">
            <ClaudeApiKeyForm hasKey={!!claudeConfig} verified={claudeConfig?.verified ?? false} />
          </div>
        </>
      )}
    </div>
  );
}
