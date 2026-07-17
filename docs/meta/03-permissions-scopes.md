# Permissions / Scopes Instagram

> **Источник:** https://developers.facebook.com/docs/permissions
> **Снято:** 2026-07-17 · **Треки роадмапа:** все Instagram-задачи
> Снимок актуальных доков Meta.

Для каждого scope: что даёт, нужен ли App Review, нужна ли Business Verification.
**Общее правило:** App Review — да почти для всех; Business Verification — не нужна для Standard Access, **обязательна при запросе Advanced Access** (см. `01-access-levels-and-modes.md`).

| Scope | Что даёт | App Review | Business Verification |
|---|---|---|---|
| `instagram_business_basic` | Базовый профиль и медиа бизнес-аккаунта (username, ID) | Да | Нет (нужна для Advanced) |
| `instagram_business_content_publish` | Публикация фото/видео постов от имени бизнеса | Да | Нет (нужна для Advanced) |
| `instagram_business_manage_comments` | Управление комментариями (создать/обновить/удалить) | Да | Нет (нужна для Advanced) |
| `instagram_business_manage_messages` | Доступ и управление директом; интеграция с CRM | Да | Нет (нужна для Advanced) |
| `instagram_business_manage_insights` | Статистика аккаунта, медиа и сторис | Да | Нет (нужна для Advanced) |

**Зависимости:** все перечисленные business-scopes зависят от `instagram_business_basic`.

## Мэппинг на задачи

- `instagram_business_basic` + `instagram_business_manage_insights` → IG2/IG3/AN* (**работает на Standard, свой аккаунт**).
- `instagram_business_manage_comments` → CM1/CM2 (**нужен Advanced → блокер**).
- `instagram_business_manage_messages` → DM2/DM5 (**нужен Advanced → блокер**).
- `instagram_business_content_publish` → CT1/CT2/CT6 (**нужен Advanced → блокер**).

> Примечание: старые Facebook-Login scopes (`instagram_basic`, `instagram_manage_comments`, `pages_read_engagement`, `ads_management`) — это другой путь (Instagram API with Facebook Login), мы его не используем.
