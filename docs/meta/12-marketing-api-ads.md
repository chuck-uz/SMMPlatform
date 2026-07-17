# Marketing API (реклама)

> **Источники:**
> - https://developers.facebook.com/docs/marketing-apis/get-started
> - https://developers.facebook.com/docs/marketing-api/overview/authorization
> **Снято:** 2026-07-17 · **Треки роадмапа:** AD1–AD8 (поздняя фаза; AD1/AD8 BLOCKED)
> Снимок актуальных доков Meta.

Реклама идёт **не** через Instagram Login, а через **Marketing API** (Business Manager + рекламный аккаунт + Facebook-страница). Instagram — как placement.

## Предпосылки

- Активный **рекламный аккаунт** (ad account) в Meta Ads Manager.
- **Business Manager**, связанная Facebook-страница.
- Регистрация Meta Developer + приложение в App Dashboard.

## Права

- `ads_read` — чтение отчётов (Standard для своих аккаунтов).
- `ads_management` — чтение + управление (Standard для своих).
- `business_management`, `read_insights` — по необходимости.
- **Для управления ЧУЖИМИ рекламными аккаунтами** — `ads_read`/`ads_management` на **Advanced Access** + App Review + **Business Verification**.

## Структура объектов

Кампания → группа объявлений → объявление:
- `POST /act_<AD_ACCOUNT_ID>/campaigns`
- `POST /act_<AD_ACCOUNT_ID>/adsets`
- `POST /act_<AD_ACCOUNT_ID>/ads`

## Уровни доступа (тиры)

- **Limited/Development (по умолчанию):** сильно ограничен по rate limit, только для разработки; 1 system user + 1 admin system user.
- **Full/Standard (после App Review):** слабее лимиты, полный Business Manager/Catalog доступ; 10 system users + 1 admin.
- Переход Limited → Full: ≥ **500 вызовов Marketing API за 15 дней** и error rate < **15%** на последних 500.
- Rate-limit формулы Ads Management/Insights (Standard vs Advanced) — см. `09-rate-limits.md`.

## Токены

- **User tokens** — через OAuth (`scope=ads_management`).
- **System users** — токены под операции Business Manager.

## Наш план (AD-трек)

- **AD1** (доступ к рекламе) и **AD8** (ревью + Business Verification) — **BLOCKED**, зависят от верификации.
- AD2–AD7 (кампании, таргетинг, защиты от слива бюджета, статусы модерации, монитор расходов, AI-разбор) — проектируются после AD1.
- Ключевое требование продукта: **ни одно действие с бюджетом без подтверждения человеком** (AD4).
