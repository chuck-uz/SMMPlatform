# Rate Limits (лимиты запросов)

> **Источник:** https://developers.facebook.com/docs/graph-api/overview/rate-limiting
> **Снято:** 2026-07-17 · **Треки роадмапа:** IG3 (поллер), CM/DM/CT/AD (все API-вызовы)
> Снимок актуальных доков Meta.

Две модели: **Platform Rate Limits** (обычные Graph-вызовы) и **Business Use Case (BUC)** — под Marketing API, Pages API, **Instagram Platform**.

## Instagram Platform (BUC, кроме мессенджинга)

**`Вызовов за 24 часа = 4800 × Impressions`**, где Impressions — сколько раз контент аккаунта показался за 24ч. → чем активнее аккаунт, тем выше лимит.

## Мессенджинг (на бизнес-аккаунт)

- **Conversations API:** 2 вызова/сек
- **Send API:** текст/ссылки/реакции/стикеры — 100/сек; аудио/видео — 10/сек
- **Private Replies (комментарий → директ, для CM2):**
  - Instagram Live replies — 100/сек
  - **Post/Reel replies — 750/час** ← важно для CM2

## Content Publishing

100 публикаций / скользящие 24ч (см. `06-content-publishing.md`).

## Заголовки для мониторинга

**`X-App-Usage`** (Platform): `call_count`, `total_time`, `total_cputime` — проценты от лимита в скользящем часе. Троттлинг при достижении 100.

**`X-Business-Use-Case-Usage`** (BUC): `call_count`, `total_cputime`, `total_time`, `estimated_time_to_regain_access` (минуты до снятия троттла), `type`, `ads_api_access_tier` (`development_access` | `standard_access`).

## Коды ошибок

- Platform: `4` (лимит приложения), `17` (лимит пользователя), `32` (Pages), `613` (кастомный лимит).
- BUC: `80005` — Instagram, `80004` — Ads Management, `80000` — Ads Insights, `80001` — Pages.

## Практика для нашего поллера (IG3)

- Читать заголовки, **останавливаться при троттле** (неуспешные вызовы тоже считаются).
- Распределять запросы во времени (у нас разные интервалы: медиа 15м, комментарии 5м, метрики 2ч, сторис 1ч).
- Батчить `?ids=...` где можно.
- Meta рекомендует webhooks вместо поллинга (после Live).
