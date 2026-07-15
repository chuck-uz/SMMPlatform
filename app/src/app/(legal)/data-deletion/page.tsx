import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Удаление данных — платформа турагентства",
  description:
    "Как удалить данные, обрабатываемые платформой продвижения турагентства.",
};

const UPDATED_AT = "15 июля 2026 года";

export default function DataDeletionPage() {
  return (
    <article className="space-y-8">
      <header>
        <h1 className="font-semibold text-2xl text-foreground">
          Удаление данных
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Обновлено: {UPDATED_AT}
        </p>
      </header>

      <section className="space-y-3 text-sm leading-6 text-foreground">
        <h2 className="font-semibold text-lg">
          Владельцу подключённого Instagram-аккаунта
        </h2>
        <p>Удалить все данные аккаунта можно двумя способами:</p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            <strong>В панели управления:</strong> раздел «Подключения» →
            «Отключить аккаунт». Все связанные данные — публикации,
            комментарии, метрики и отчёты — удаляются из базы платформы
            немедленно и безвозвратно.
          </li>
          <li>
            <strong>По письму:</strong> отправьте запрос с темой «Удаление
            данных» на{" "}
            <a href="mailto:www.dinya.ru@gmail.com" className="underline">
              www.dinya.ru@gmail.com
            </a>
            . Мы удалим данные в течение 30 дней и подтвердим удаление ответным
            письмом.
          </li>
        </ol>
        <p>
          Отзыв доступа также возможен на стороне Instagram: Настройки → Сайты
          и приложения → SMMPLATFORM → «Удалить». После отзыва платформа
          теряет доступ к API аккаунта.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-6 text-foreground">
        <h2 className="font-semibold text-lg">
          Авторам комментариев и обращений
        </h2>
        <p>
          Если вы оставляли комментарий под публикацией турагентства или
          обращались в переписку и хотите удалить эти данные с платформы,
          напишите на{" "}
          <a href="mailto:www.dinya.ru@gmail.com" className="underline">
            www.dinya.ru@gmail.com
          </a>{" "}
          с указанием вашего имени пользователя Instagram. Мы удалим записи в
          течение 30 дней.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-6 text-foreground">
        <h2 className="font-semibold text-lg">Что именно удаляется</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>сохранённые публикации и их статистика;</li>
          <li>комментарии и подготовленные ответы на них;</li>
          <li>метрики и аналитические отчёты аккаунта;</li>
          <li>токены доступа к Instagram API.</li>
        </ul>
        <p>
          Подробнее об обработке данных — в{" "}
          <Link href="/privacy" className="underline">
            Политике конфиденциальности
          </Link>
          .
        </p>
      </section>
    </article>
  );
}
