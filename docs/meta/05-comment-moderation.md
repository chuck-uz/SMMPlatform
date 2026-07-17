# Comment Moderation (комментарии)

> **Источник:** https://developers.facebook.com/docs/instagram-platform/comment-moderation
> **Снято:** 2026-07-17 · **Треки роадмапа:** CM1, CM2 (оба BLOCKED — нужен Advanced/Live)
> Снимок актуальных доков Meta.

## Эндпоинты

**Чтение:**
- `GET /<IG_MEDIA_ID>/comments` — комментарии под медиа
- `GET /<IG_COMMENT_ID>/replies` — ответы на комментарий

**Управление:**
- `POST /<IG_COMMENT_ID>/replies` — ответить на комментарий
- `POST /<IG_COMMENT_ID>` — скрыть/показать комментарий (`hide`)
- `DELETE /<IG_COMMENT_ID>` — удалить
- `POST /<IG_MEDIA_ID>` — включить/выключить комментарии под медиа

## Права (Instagram Login)

- `instagram_business_basic`
- `instagram_business_manage_comments`

## Приватный ответ в директ (для CM2)

Комментарий → директ реализуется через messaging/private replies (см. `08-messaging.md`, топик private replies) — лимит **750 вызовов/час** на post/reel replies (см. `09-rate-limits.md`).

## Webhooks

Подписка на `comments` и `live_comments` (см. `04-webhooks.md`) — уведомления о новых комментариях. Meta рекомендует webhooks вместо поллинга ради rate limit.

## ⚠️ Ключевой блокер проекта

- **Advanced Access** — для аккаунтов не во владении разработчика.
- **Standard Access** — для своих/добавленных аккаунтов.
- **ПОДТВЕРЖДЕНО на проде (2026-07-17):** в **Dev-режиме Instagram не отдаёт комментарии** даже принятому тестеру (0 raw comments по всем медиа, 539 DIAG-строк). Это **не** баг токена/scope/кода.
- Разблокировка: **Business Verification → App Review (сценарий «Управление комментариями») → Advanced Access на `instagram_business_manage_comments` → Live** (задача BV6).
- Детали расследования: `vault/SMM Platform/decisions/cm1-comment-autoreply.md`.
