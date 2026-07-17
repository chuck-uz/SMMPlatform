# База Meta-документации под роадмап

Локальный срез документации Meta по всем разделам, которые затрагивает наш роадмап
(`roadmap.json`). Собран, чтобы не зависеть от доступности сайта Meta и держать в одном
месте эндпоинты, scopes, лимиты и требования верификации.

> **Снято:** 2026-07-17 из developers.facebook.com и Meta Business Help.
> Это **снимок**, а не живой источник — Meta регулярно меняет доки. Перед реализацией
> задачи и особенно перед подачей на ревью сверять с оригиналом (ссылка есть в шапке
> каждого файла). Числовые лимиты (напр. 100 публикаций/24ч) перепроверять.

## Файлы

| # | Файл | О чём | Задачи роадмапа |
|---|---|---|---|
| 01 | [Уровни доступа и режимы](01-access-levels-and-modes.md) | Standard vs Advanced, Dev vs Live | сквозная |
| 02 | [Instagram Login и токены](02-instagram-login-and-tokens.md) | OAuth, обмен/продление токенов | IG1, IG2 |
| 03 | [Permissions / Scopes](03-permissions-scopes.md) | все Instagram scopes и что требуют | все IG |
| 04 | [Webhooks](04-webhooks.md) | верификация, подпись, топики | F3, CM, DM5 |
| 05 | [Comment Moderation](05-comment-moderation.md) | чтение/ответ/скрытие комментариев | **CM1, CM2** |
| 06 | [Content Publishing](06-content-publishing.md) | контейнер → публикация, лимиты | CT1, CT2, CT3, CT4 |
| 07 | [Insights / метрики](07-insights-metrics.md) | account/media insights, демография | IG3, AN1–AN4, GROW1 |
| 08 | [Messaging](08-messaging.md) | директ, окно 24ч, типы сообщений | DM1, DM2, DM5 |
| 09 | [Rate Limits](09-rate-limits.md) | формулы лимитов, заголовки, коды | IG3 + все API |
| 10 | [App Review](10-app-review.md) | процесс ревью, что подавать | BV6, DM3/DM5, CT6, AD8 |
| 11 | [Business Verification](11-business-verification.md) | KYC компании, документы | **BV1–BV6** |
| 12 | [Marketing API (реклама)](12-marketing-api-ads.md) | кампании, тиры, права | AD1–AD8 |

## Главный вывод (почему всё упирается в верификацию)

Почти каждая «боевая» функция требует **Advanced Access**, а Advanced Access требует
**Business Verification**. Единственное, что полноценно работает сейчас (Standard Access,
свой аккаунт) — **инсайты/аналитика** (файл 07) и связанное с ней.

**Цепочка разблокировки:** Business Verification → Access verification → App Review по
сценарию → **Live** → Advanced Access. Это и есть трек «Верификация» (BV1–BV6).

Заблокированы до прохождения: **CM1, CM2, DM2, DM5, CT1, CT2, CT6, AD1, AD8**.

## Смежные материалы в репозитории

- `../../meta-business-verification-uz.pdf` — практический чек-лист документов под ООО (Узбекистан).
- `vault/SMM Platform/decisions/cm1-comment-autoreply.md` — доказательство, что комментарии в Dev-режиме недоступны (нужен Live).
- `roadmap.json` → трек «Верификация», milestone «Верификация Meta».

## Как обновлять

При изменении подхода Meta или перед подачей на ревью:
1. Перефетчить страницу по ссылке из шапки файла.
2. Обновить соответствующий файл + дату «Снято».
3. Если поменялись требования по задаче — отразить в `roadmap.json` (`note`) и `decisions/`.
