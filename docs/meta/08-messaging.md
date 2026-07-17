# Messaging (директ)

> **Источник:** https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api
> **Снято:** 2026-07-17 · **Треки роадмапа:** DM1 (движок, todo), DM2/DM5 (BLOCKED)
> Снимок актуальных доков Meta.

## Эндпоинт отправки

`POST /me/messages` (или `POST /<IG_ID>/messages`), хост `graph.instagram.com`

```json
{
  "recipient": { "id": "<IGSID>" },
  "message": { "text": "<TEXT_OR_LINK>" }
}
```

Также: `attachments` (медиа), `sender_action` (реакции/typing).

## Права и доступ

- **Scope:** `instagram_business_manage_messages` (+ `instagram_business_basic`)
- **Standard Access** — свои/управляемые аккаунты; **Advanced Access** — чужие.

## Окно 24 часа

- Ответить можно **в течение 24 часов** после сообщения пользователя.
- Тег `HUMAN_AGENT` расширяет окно для ответов живого оператора.
- **Первым писать нельзя:** отправка возможна только после того, как пользователь написал бизнес-аккаунту.

## Входящие

Через webhook-топик `messages` (payload: IGSID отправителя + контент). См. `04-webhooks.md`.

## Типы сообщений

Текст (UTF-8, до 1000 байт), ссылки, изображения (PNG/JPEG, до 10/запрос, 8MB), аудио/видео (25MB), PDF (25MB), реакции, стикеры, `MEDIA_SHARE` (свой пост).

## Ограничения

- Групповые чаты не поддерживаются.
- Сообщения в папке Requests, неактивные 30+ дней, недоступны через API.

## Наш план

DM1 (движок диалогов: маршрутизация, учёт 24ч-окна, лимиты, роутер моделей) можно строить **на тестовых данных без Live**. Реальный директ (DM2) и go-live с webhook (DM5) — только после **Advanced Access + App Review** → BLOCKED.
Rate limits директа — см. `09-rate-limits.md`.
