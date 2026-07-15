import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Пользовательское соглашение — платформа турагентства",
  description:
    "Условия использования платформы продвижения турагентства.",
};

const UPDATED_AT = "15 июля 2026 года";

export default function TermsPage() {
  return (
    <article className="space-y-8">
      <header>
        <h1 className="font-semibold text-2xl text-foreground">
          Пользовательское соглашение
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Обновлено: {UPDATED_AT}
        </p>
      </header>

      <section className="space-y-3 text-sm leading-6 text-foreground">
        <h2 className="font-semibold text-lg">1. О сервисе</h2>
        <p>
          Платформа по адресу{" "}
          <a href="https://smm.oresh.in/" className="underline">
            smm.oresh.in
          </a>{" "}
          — внутренний инструмент турагентства для продвижения его
          Instagram-аккаунта, аналитики и обработки заявок. Сервис не является
          публичным продуктом: доступ к панели управления предоставляется
          только сотрудникам турагентства.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-6 text-foreground">
        <h2 className="font-semibold text-lg">2. Условия доступа</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            учётные записи выдаются администратором и не подлежат передаче
            третьим лицам;
          </li>
          <li>
            пользователь отвечает за сохранность своих учётных данных;
          </li>
          <li>
            сервис используется только для рабочих задач турагентства в
            соответствии с правилами платформ Meta, Anthropic и Telegram.
          </li>
        </ul>
      </section>

      <section className="space-y-3 text-sm leading-6 text-foreground">
        <h2 className="font-semibold text-lg">3. Ограничение ответственности</h2>
        <p>
          Сервис предоставляется «как есть». Оператор прилагает разумные усилия
          для его стабильной работы, но не гарантирует непрерывную доступность
          и не несёт ответственности за перебои в работе внешних сервисов
          (Instagram API, Claude API, Telegram).
        </p>
      </section>

      <section className="space-y-3 text-sm leading-6 text-foreground">
        <h2 className="font-semibold text-lg">4. Данные</h2>
        <p>
          Обработка данных описана в{" "}
          <Link href="/privacy" className="underline">
            Политике конфиденциальности
          </Link>
          , порядок их удаления — на странице{" "}
          <Link href="/data-deletion" className="underline">
            «Удаление данных»
          </Link>
          .
        </p>
      </section>

      <section className="space-y-3 text-sm leading-6 text-foreground">
        <h2 className="font-semibold text-lg">5. Контакты</h2>
        <p>
          Вопросы по работе сервиса и настоящему соглашению:{" "}
          <a href="mailto:www.dinya.ru@gmail.com" className="underline">
            www.dinya.ru@gmail.com
          </a>
          .
        </p>
      </section>
    </article>
  );
}
