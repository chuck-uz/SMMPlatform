import Link from "next/link";
import { ExclamationTriangleIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { daysUntilExpiry } from "@/lib/instagramOAuth";
import { DisconnectInstagramButton } from "@/components/DisconnectInstagramButton";
import { ClaudeApiKeyForm } from "@/components/ClaudeApiKeyForm";
import { TelegramBotForm } from "@/components/TelegramBotForm";
import { TelegramRecipientsList } from "@/components/TelegramRecipientsList";

const ERROR_MESSAGES: Record<string, string> = {
  oauth_state: "Не удалось подтвердить запрос авторизации — попробуйте подключить аккаунт заново.",
  not_configured: "Instagram-интеграция ещё не настроена на сервере.",
  connect_failed: "Не удалось подключить аккаунт. Попробуйте ещё раз.",
};

const EXPIRY_WARNING_THRESHOLD_DAYS = 7;

function formatRelativeTime(date: Date | null, now: Date): string {
  if (!date) return "ещё не было";
  const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000);
  if (diffMin < 1) return "только что";
  if (diffMin < 60) return `${diffMin} мин назад`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} ч назад`;
  return `${Math.floor(diffHours / 24)} дн назад`;
}

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
  const telegramConfig = isAdmin
    ? await prisma.telegramBotConfig.findUnique({ where: { singleton: "telegram" } })
    : null;
  const telegramRecipients = isAdmin
    ? await prisma.telegramNotificationRecipient.findMany({ orderBy: { createdAt: "asc" } })
    : [];

  const accounts = await prisma.instagramAccount.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, username: true, tokenExpiresAt: true },
  });
  const now = new Date();

  const pollerStatsByAccount = new Map(
    await Promise.all(
      accounts.map(async (account) => {
        const [mediaAgg, commentAgg, metricAgg, demographicsAgg, latestAccountSnapshot] = await Promise.all([
          prisma.instagramMedia.aggregate({
            where: { accountId: account.id },
            _count: true,
            _max: { updatedAt: true },
          }),
          prisma.instagramComment.aggregate({
            where: { media: { accountId: account.id } },
            _count: true,
            _max: { createdAt: true },
          }),
          prisma.instagramMetricSnapshot.aggregate({
            where: { accountId: account.id, scope: { not: "demographics" } },
            _count: true,
            _max: { capturedAt: true },
          }),
          prisma.instagramMetricSnapshot.aggregate({
            where: { accountId: account.id, scope: "demographics" },
            _count: true,
            _max: { capturedAt: true },
          }),
          prisma.instagramMetricSnapshot.findFirst({
            where: { accountId: account.id, scope: "account" },
            orderBy: { capturedAt: "desc" },
            select: { metrics: true },
          }),
        ]);
        const followerCount =
          (latestAccountSnapshot?.metrics as Record<string, number> | undefined)?.followerCount ?? null;
        return [
          account.id,
          {
            mediaCount: mediaAgg._count,
            mediaLast: mediaAgg._max.updatedAt,
            commentCount: commentAgg._count,
            commentLast: commentAgg._max.createdAt,
            metricCount: metricAgg._count,
            metricLast: metricAgg._max.capturedAt,
            demographicsCount: demographicsAgg._count,
            demographicsLast: demographicsAgg._max.capturedAt,
            followerCount,
          },
        ] as const;
      }),
    ),
  );

  return (
    <div className="p-6 sm:p-8 sm:px-10">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:flex-wrap sm:justify-between">
        <p className="min-w-0 max-w-[640px] text-[14.5px] leading-relaxed text-muted-foreground">
          Единое окно, где подключаются каналы: Instagram — через официальный вход Meta. Здесь
          виден статус подключений и срок действия доступа.
        </p>
        <Link
          href="/api/instagram/authorize"
          className="inline-flex shrink-0 items-center gap-2 rounded-[10px] bg-accent px-5 py-[11px] text-sm font-semibold text-accent-foreground shadow-card transition-colors duration-200 hover:bg-accent-hover"
        >
          Подключить Instagram
        </Link>
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p>{ERROR_MESSAGES[error] ?? "Не удалось подключить аккаунт."}</p>
        </div>
      )}

      <div className="mt-6 max-w-[1020px] overflow-x-auto rounded-[14px] border border-border bg-card shadow-card">
        <div className="min-w-[620px]">
          <div className="grid grid-cols-[1fr_230px_150px_110px] items-center gap-4 border-b border-border bg-muted/60 px-[22px] py-[11px] text-[11.5px] font-semibold uppercase tracking-wide text-subtle">
            <span>Аккаунт</span>
            <span>Доступ</span>
            <span>Статус</span>
            <span></span>
          </div>
          {accounts.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">
              Пока нет подключённых аккаунтов Instagram.
            </div>
          ) : (
            accounts.map((account) => {
              const days = daysUntilExpiry(account.tokenExpiresAt, now);
              const isExpiringSoon = days <= EXPIRY_WARNING_THRESHOLD_DAYS;
              const pct = Math.max(0, Math.min(100, Math.round((days / 60) * 100)));
              const stats = pollerStatsByAccount.get(account.id);

              return (
                <div key={account.id} className="border-t border-border first:border-t-0">
                  <div className="grid grid-cols-[1fr_230px_150px_110px] items-center gap-4 px-[22px] py-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-400 via-purple-500 to-indigo-500 text-[15px] font-bold text-white">
                        @
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-foreground">@{account.username}</div>
                        <div className="mt-0.5 text-[12.5px] text-subtle">Instagram · Meta OAuth</div>
                      </div>
                    </div>
                    <div>
                      <div className="mb-1.5 text-[12.5px] text-muted-foreground">
                        {days >= 0 ? `Доступ действует ещё ${days} дн.` : "Срок доступа истёк"}
                      </div>
                      <div className="h-[5px] overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full ${isExpiringSoon ? "bg-warning" : "bg-accent"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <span
                      className={`inline-flex w-fit items-center gap-1.5 rounded-full px-[11px] py-[5px] text-[12.5px] font-semibold ${
                        isExpiringSoon ? "bg-warning/10 text-warning" : "bg-accent/10 text-accent-hover"
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
                  {stats && (
                    <div className="px-[22px] pb-3 text-[11.5px] text-subtle">
                      Сбор данных: медиа — {stats.mediaCount} ({formatRelativeTime(stats.mediaLast, now)}) ·
                      комментарии — {stats.commentCount} ({formatRelativeTime(stats.commentLast, now)}) ·
                      метрики — {stats.metricCount} ({formatRelativeTime(stats.metricLast, now)}) · демография —{" "}
                      {stats.followerCount !== null && stats.followerCount < 100
                        ? `недоступна (${stats.followerCount} подписчиков, нужно 100+)`
                        : stats.demographicsCount > 0
                          ? `собрана (${formatRelativeTime(stats.demographicsLast, now)})`
                          : "ещё не собрана"}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {isAdmin && (
        <>
          <h2 className="mt-9 text-[13.5px] font-semibold text-foreground">Claude API</h2>
          <p className="mt-1 max-w-[640px] text-[12.5px] leading-relaxed text-muted-foreground">
            Ключ используется для аналитики, контент-плана и автоответов. Хранится
            зашифрованным, доступен только администратору.
          </p>
          <div className="mt-3 max-w-[1020px] rounded-[14px] border border-border bg-card p-5 shadow-card">
            <ClaudeApiKeyForm hasKey={!!claudeConfig} verified={claudeConfig?.verified ?? false} />
          </div>

          <h2 className="mt-9 text-[13.5px] font-semibold text-foreground">Telegram-бот</h2>
          <p className="mt-1 max-w-[640px] text-[12.5px] leading-relaxed text-muted-foreground">
            Уведомления о новых заявках рассылаются получателям из white list ниже. Chat_id
            получателя можно узнать, например, у @userinfobot в Telegram.
          </p>
          <div className="mt-3 max-w-[1020px] rounded-[14px] border border-border bg-card p-5 shadow-card">
            <TelegramBotForm hasToken={!!telegramConfig} verified={telegramConfig?.verified ?? false} />
            <TelegramRecipientsList recipients={telegramRecipients} />
          </div>
        </>
      )}
    </div>
  );
}
