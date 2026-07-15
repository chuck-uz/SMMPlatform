import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Политика конфиденциальности — платформа турагентства",
  description:
    "Какие данные обрабатывает платформа продвижения турагентства и как они защищены.",
};

const UPDATED_AT = "15 июля 2026 года";

export default function PrivacyPage() {
  return (
    <article className="space-y-8">
      <header>
        <h1 className="font-semibold text-2xl text-foreground">
          Политика конфиденциальности
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Обновлено: {UPDATED_AT}
        </p>
      </header>

      <section className="space-y-3 text-sm leading-6 text-foreground">
        <h2 className="font-semibold text-lg">1. Кто мы</h2>
        <p>
          Платформа по адресу{" "}
          <a href="https://smm.oresh.in/" className="underline">
            smm.oresh.in
          </a>{" "}
          — внутренний инструмент турагентства для продвижения его собственного
          Instagram-аккаунта и обработки заявок клиентов. Оператор данных —
          турагентство. Контакт по вопросам данных:{" "}
          <a href="mailto:www.dinya.ru@gmail.com" className="underline">
            www.dinya.ru@gmail.com
          </a>
          .
        </p>
      </section>

      <section className="space-y-3 text-sm leading-6 text-foreground">
        <h2 className="font-semibold text-lg">2. Какие данные мы обрабатываем</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Данные Instagram-аккаунта турагентства</strong>, полученные
            через Instagram API компании Meta с согласия владельца аккаунта:
            публикации (медиа), комментарии к ним, статистика охватов и
            вовлечённости, обезличенная агрегированная демография аудитории.
          </li>
          <li>
            <strong>Данные заявок</strong>: сведения, которые потенциальный
            клиент сам сообщает в переписке — направление поездки, даты, состав
            группы, бюджет, контакт для связи.
          </li>
          <li>
            <strong>Учётные записи сотрудников</strong>: адрес электронной
            почты, имя и хеш пароля для доступа к панели управления.
          </li>
        </ul>
      </section>

      <section className="space-y-3 text-sm leading-6 text-foreground">
        <h2 className="font-semibold text-lg">3. Зачем мы их используем</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>ответы на комментарии и сообщения подписчиков;</li>
          <li>аналитика эффективности публикаций и роста аккаунта;</li>
          <li>обработка заявок на подбор туров и связь с клиентом;</li>
          <li>уведомления сотрудников о новых заявках.</li>
        </ul>
        <p>Мы не продаём данные и не используем их для рекламы третьих лиц.</p>
      </section>

      <section className="space-y-3 text-sm leading-6 text-foreground">
        <h2 className="font-semibold text-lg">4. Кому данные передаются</h2>
        <p>
          Для работы платформы данные обрабатываются следующими поставщиками
          услуг, каждый — в минимально необходимом объёме:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Meta Platforms (Instagram API)</strong> — источник данных
            аккаунта и канал отправки ответов;
          </li>
          <li>
            <strong>Anthropic (Claude API)</strong> — обработка текста
            комментариев и сообщений для подготовки ответов и аналитики;
          </li>
          <li>
            <strong>Telegram</strong> — доставка уведомлений о заявках
            сотрудникам турагентства.
          </li>
        </ul>
      </section>

      <section className="space-y-3 text-sm leading-6 text-foreground">
        <h2 className="font-semibold text-lg">5. Как данные защищены</h2>
        <p>
          Токены доступа к Instagram API и ключи внешних сервисов хранятся в
          зашифрованном виде. Доступ к панели управления есть только у
          сотрудников турагентства по личным учётным записям. Данные хранятся в
          базе данных на защищённом сервере и не публикуются.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-6 text-foreground">
        <h2 className="font-semibold text-lg">6. Сколько данные хранятся и как их удалить</h2>
        <p>
          Данные Instagram-аккаунта хранятся, пока аккаунт подключён к
          платформе. При отключении аккаунта все связанные с ним данные
          (публикации, комментарии, метрики, отчёты) удаляются автоматически и
          безвозвратно. Порядок удаления описан на странице{" "}
          <Link href="/data-deletion" className="underline">
            «Удаление данных»
          </Link>
          .
        </p>
      </section>

      <section className="space-y-3 text-sm leading-6 text-foreground">
        <h2 className="font-semibold text-lg">7. Ваши права</h2>
        <p>
          Вы можете запросить сведения о ваших данных, их исправление или
          удаление, написав на{" "}
          <a href="mailto:www.dinya.ru@gmail.com" className="underline">
            www.dinya.ru@gmail.com
          </a>
          . Мы ответим в течение 30 дней.
        </p>
      </section>
    </article>
  );
}
