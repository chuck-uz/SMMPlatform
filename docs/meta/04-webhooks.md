# Instagram Webhooks

> **Источник:** https://developers.facebook.com/docs/instagram-platform/webhooks
> **Снято:** 2026-07-17 · **Треки роадмапа:** F3 (утилита подписи готова), CM1/CM2, DM5
> Снимок актуальных доков Meta.

Сейчас мы работаем поллингом (IG3). Webhooks — целевая модель после Live (снимает нагрузку на rate limit, real-time). Утилита `verifyWebhookSignature` (HMAC/X-Hub-Signature-256) уже реализована в F3.

## Шаги настройки

1. **Endpoint** — HTTPS-сервер, обрабатывающий verification (GET) и события (POST).
2. **Field Subscription** — выбрать топики в App Dashboard.
3. **Account Enablement** — `POST /me/subscribed_apps`.
4. **Validation** — тестовое сообщение.

## Verification (GET)

| Параметр | Значение |
|---|---|
| `hub.mode` | всегда `subscribe` |
| `hub.challenge` | целое число — вернуть в ответе |
| `hub.verify_token` | строка, сверить с настройкой в дашборде |

Ответ: эхо `hub.challenge`, статус `200 OK`.

## Безопасность событий (POST)

- Заголовок `X-Hub-Signature-256` (SHA256).
- Проверка: `HMAC_SHA256(payload_body, app_secret)` сравнить с частью после `sha256=`.
- **Именно это делает наш `verifyWebhookSignature` (F3).**

## Топики (subscribed_fields)

- `comments` / `live_comments` — комментарии (**требуют Advanced Access**)
- `messages` / `message_reactions` — директ
- `mentions` — упоминания
- `messaging_handover` / `standby` — передача диалога между приложениями
- `story_insights` — метрики сторис (окно 24ч)

Подписка: `POST /me/subscribed_apps?subscribed_fields=comments,messages&access_token=TOKEN`

## Критичные требования

- Приложение должно быть в **Live Mode**.
- Валидный TLS/SSL (self-signed не принимается).
- Для `comments`/`live_comments` — **Advanced Access**.
- Аккаунт должен быть публичным для уведомлений о комментариях.
- Ответ эндпоинта — `200 OK`.
