# Insights / метрики

> **Источник:** https://developers.facebook.com/docs/instagram-platform/insights
> **Снято:** 2026-07-17 · **Треки роадмапа:** IG3, AN1–AN4, GROW1 (всё сделано, работает на Standard)
> Снимок актуальных доков Meta.

Это **единственный крупный блок, полностью работающий на Standard Access для своего аккаунта** — на нём стоит вся аналитика.

## Account-level

`GET /<INSTAGRAM_ACCOUNT_ID>/insights` (хост `graph.instagram.com`, у нас через `/me/insights`)

- **Права:** `instagram_business_manage_insights`
- **Метрики (базовые):** `impressions`, `reach`, `profile_views`; также `follower_count`, `website_clicks`, `accounts_engaged` и др.
- **Параметры:** `metric` (через запятую), `period` (напр. `day`), для части метрик `metric_type`/`breakdown`.

Пример:
```
GET graph.instagram.com/<IG_ID>/insights?metric=reach,profile_views&period=day
```

## Media-level

`GET /<INSTAGRAM_MEDIA_ID>/insights`

- Метрики по типу медиа (feed/reels/stories): `reach`, `likes`, `comments`, `saves`, `shares`, `views` и др.
- Параметр `metric` (через запятую).

> **Наш пойманный баг Meta API:** метрика Reels `plays` переименована в `views` (зафиксировано в AN1).

## Демография

- `follower_demographics` с разбивкой `age` / `gender` / `city` / `country`.
- **Доступна только при ≥ 100 подписчиков** (у аккаунтов < 100 часть метрик недоступна).
- Наш парсер вложенной breakdown-структуры подтверждён на живых данных (AN2).

## Ограничения

- Данные User Metrics хранятся **до 90 дней** (поэтому копим срезы — `dailyHistory`).
- Только professional/business/creator аккаунты.
