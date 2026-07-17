# Уровни доступа и режимы приложения (Standard/Advanced, Dev/Live)

> **Источник:** https://developers.facebook.com/docs/graph-api/overview/access-levels
> **Снято:** 2026-07-17 · **Треки роадмапа:** сквозная тема для A, B, Контент, Реклама, Верификация
> Снимок актуальных доков Meta. Meta меняет формулировки — при подаче на ревью сверять с оригиналом.

Это ключевая ось всего проекта: **почти всё, что требует ревью, упирается в переход Standard → Advanced, а Advanced требует Business Verification.**

## Standard Access (по умолчанию)

- Приложение может запрашивать permission/feature **только у пользователей, у которых есть роль в приложении** (админ/разработчик/тестер) или роль в связанном Business.
- Consumer/gaming/business-приложения получают Standard Access на все доступные их типу permissions/features **автоматически** при создании.
- Назначение: разработка и тестирование эндпоинтов до одобрения, приложения «только для своей команды».
- **Именно на этом уровне мы сейчас.** Поэтому Instagram в Dev-режиме не отдаёт комментарии даже принятому тестеру (см. `05-comment-moderation.md`, `decisions/cm1-comment-autoreply.md`).

## Advanced Access

- Приложение может запрашивать permission/feature **у любого пользователя** (не только у тех, у кого роль). Features активны для всех пользователей.
- **Два обязательных условия:**
  1. **Business Verification** — обязательна.
  2. Отдельные permissions/features дополнительно требуют **одобрения App Review**.
- Чтобы запрашивать advanced-permissions у пользователей без роли, приложение должно быть переведено в **Live Mode**.
- Приложения с одобренным Advanced Access ежегодно проходят **Data Use Checkup** (подтверждение соответствия политикам).

## Управление

- Админ может менять уровень доступа по каждому permission/feature отдельно.
- Снятие Advanced Access → пользователи без роли теряют доступ; при повторном включении ранее одобренного Advanced **повторное ревью не требуется**.

## Как это ложится на наш роадмап

| Что хотим | Нужный уровень | Что разблокирует |
|---|---|---|
| Свои метрики/медиа своего аккаунта | Standard (есть) | IG3, AN1–AN4, GROW1 (сделано) |
| Комментарии (чтение+ответ) | **Advanced** на `instagram_business_manage_comments` | CM1, CM2 |
| Директ | **Advanced** на `instagram_business_manage_messages` | DM2, DM5 |
| Публикация постов/сторис | **Advanced** на `instagram_business_content_publish` | CT1, CT2, CT6 |
| Управление чужой рекламой | **Advanced** на `ads_management` | AD1, AD8 |

Цепочка для всего Advanced: **Business Verification → (Access verification) → App Review по сценарию → Live**.
