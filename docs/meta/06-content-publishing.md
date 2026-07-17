# Content Publishing (публикация)

> **Источник:** https://developers.facebook.com/docs/instagram-platform/content-publishing
> **Снято:** 2026-07-17 · **Треки роадмапа:** CT1, CT2 (BLOCKED), CT3/CT4 (планировщик на этой базе)
> Снимок актуальных доков Meta.

## Двухшаговый flow (контейнер → публикация)

1. `POST /<IG_ID>/media` — создать медиа-контейнер (загрузить контент), получить `container-id`.
2. `POST /<IG_ID>/media_publish` — опубликовать по `creation_id=<container-id>`.

## Параметры контейнера

**Одиночное медиа:**
- `image_url` **или** `video_url` (публично доступный URL)
- `media_type`: `VIDEO` | `REELS` | `STORIES` (для фото не указывается)
- `access_token`

**Карусель:**
- `media_type=CAROUSEL`
- `children`: до **10** container-id через запятую
- дочерние контейнеры: `is_carousel_item=true`

**Опциональные:** `caption`, `user_tags`, `location_id`, `cover_url` (обложка видео), `thumb_offset`, `is_ai_generated`, `is_paid_partnership`, `branded_content_sponsor_ids` (макс. 2).

## Статус контейнера (перед публикацией)

`GET /<IG_CONTAINER_ID>?fields=status_code` →
`EXPIRED` (не опубликован за 24ч) · `ERROR` · `FINISHED` (готов) · `IN_PROGRESS` · `PUBLISHED`.
Опрос: раз в минуту, максимум ~5 минут.

## Лимиты и форматы

- **Публикаций: 100 за скользящие 24 часа** (по текущему доку; исторически было 25 — сверять перед реализацией). Карусель = 1 публикация.
- Карусель: до 10 фото/видео; кроп по aspect ratio первого элемента (default 1:1).
- Изображения: **только JPEG**. Видео: MP4/MOV и др.
- Reels: `media_type=REELS`; в ответе вернётся `media_type: VIDEO`, отличать по `media_product_type`.
- Stories: `media_type=STORIES`. Интерактивные стикеры через API недоступны — только «плоские» сторис (учтено в CT2).

## Права

`instagram_business_content_publish` (+ `instagram_business_basic`).

## Блокер

Нужен **Advanced Access + App Review** (сценарий публикации) + Live. CT1/CT2/CT6 — BLOCKED. Планировщик/календарь (CT3/CT4) можно строить на этой базе заранее, но реальная публикация — только после Live.
