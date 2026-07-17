# Instagram API with Instagram Login — вход и токены

> **Источники:**
> - https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login
> - https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login
> **Снято:** 2026-07-17 · **Треки роадмапа:** IG1, IG2 (сделано), база для всего Instagram
> Снимок актуальных доков Meta.

Наш путь — **Instagram API with Instagram Login** (без привязки Facebook-страницы). Не даёт доступ к рекламе/тегам — реклама идёт через Marketing API (см. `12-marketing-api-ads.md`).

## Возможности API

- Comment moderation — модерация и ответы на комментарии
- Content publishing — получение и публикация медиа
- Media Insights — инсайты по медиа
- Mentions — упоминания
- Messaging — приём/отправка сообщений

## Scopes (новые значения; старые устарели с 27.01.2025)

- `instagram_business_basic`
- `instagram_business_content_publish`
- `instagram_business_manage_messages`
- `instagram_business_manage_comments`
- `instagram_business_manage_insights`

## OAuth-эндпоинты

| Эндпоинт | Назначение | Метод |
|---|---|---|
| `https://www.instagram.com/oauth/authorize` | Получить authorization code | GET |
| `https://api.instagram.com/oauth/access_token` | Обмен на short-lived токен | POST |
| `https://graph.instagram.com/access_token` | Обмен на long-lived токен | GET |
| `https://graph.instagram.com/refresh_access_token` | Продление токена | GET |

### Шаг 1. Authorization (`GET /oauth/authorize`)

| Параметр | Обяз. | Описание |
|---|---|---|
| `client_id` | ✓ | Instagram App ID |
| `redirect_uri` | ✓ | Должен совпадать с настройкой в App Dashboard |
| `response_type` | ✓ | `code` |
| `scope` | ✓ | Список permissions (через запятую/пробел) |
| `state` | — | CSRF-защита |
| `enable_fb_login` | — | Показать вход через Facebook (по умолчанию true) |
| `force_reauth` | — | Принудительный повторный ввод логина |

Код действует **1 час**, одноразовый.

### Шаг 2. Short-lived токен (`POST /oauth/access_token`)

Параметры: `client_id`, `client_secret`, `grant_type=authorization_code`, `redirect_uri`, `code`.
Ответ: `access_token` (short-lived), `user_id` (IG-scoped ID), `permissions`.

### Шаг 3. Long-lived токен (`GET /access_token`)

Параметры: `grant_type=ig_exchange_token`, `client_secret`, `access_token`.
Ответ: токен на **60 дней**.

### Продление (`GET /refresh_access_token`)

Параметры: `grant_type=ig_refresh_token`, `access_token`.
Условия: токену **≥ 24 часов**, он валиден, дан scope `instagram_business_basic`. Токен, неактивный **60+ дней**, продлить нельзя.

## Важно для нас

- **Хост API — `graph.instagram.com`.** Эндпоинты используют `/me`, а не собственный ID аккаунта (баг, который мы уже ловили в IG3).
- Токен шифруется (AES-256-GCM, F3), авто-продление — in-process таймер (IG2).
- Standard Access — для своих/добавленных аккаунтов; Advanced Access — для чужих (см. `01-access-levels-and-modes.md`).
