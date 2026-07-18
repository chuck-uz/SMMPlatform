import { test, expect } from "@playwright/test";
import { login, seedSiteLead, deleteLead, prisma } from "./helpers";

test.afterAll(async () => {
  await prisma.$disconnect();
});

// ─────────────────────────────────────────────────────────────────────────
// РАБОТАЕТ СЕЙЧАС — нижняя половина воронки.
// Проверяет, что заявка с источником «Сайт» доходит до раздела «Заявки»
// и корректно отображается. Не зависит от публичной формы (WEB2 ещё todo).
// ─────────────────────────────────────────────────────────────────────────
test.describe("Воронка: заявка → панель", () => {
  test("заявка с источником «Сайт» видна в панели как новая", async ({ page }) => {
    const lead = await seedSiteLead("panel");

    try {
      await login(page);
      await page.goto("/panel/leads?status=new");

      // Карточка с нашим направлением присутствует...
      const card = page.getByTestId("lead-card").filter({ hasText: lead.destination });
      await expect(card).toBeVisible();

      // ...и на ней правильные источник, статус и полнота.
      await expect(card).toContainText("Сайт");
      await expect(card).toContainText("Новая");
      await expect(card).toContainText("Заявка полная");
    } finally {
      await deleteLead(lead.conversationId);
    }
  });

  test("вкладка «Закрытые» не показывает новую заявку", async ({ page }) => {
    const lead = await seedSiteLead("filter");

    try {
      await login(page);
      await page.goto("/panel/leads?status=closed");
      await expect(page.getByText(lead.destination)).toHaveCount(0);
    } finally {
      await deleteLead(lead.conversationId);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// КАРКАС ПОД WEB2 — полная воронка «направление → форма → панель».
// Помечен test.fixme: пока публичной страницы направления и лид-формы нет.
// Когда WEB1/WEB2 будут готовы:
//   1) добавьте в форму data-testid из вызовов ниже;
//   2) убедитесь, что submit создаёт Lead с source: "site";
//   3) снимите .fixme.
// ─────────────────────────────────────────────────────────────────────────
test.describe("Воронка: направление → форма → панель (WEB2)", () => {
  test.fixme(
    "полный путь клиента: страница направления → отправка формы → заявка в панели",
    async ({ page, context }) => {
      // Уникальный маркер, чтобы найти именно свою заявку в панели.
      const marker = `e2e-web2-${Date.now()}`;

      // 1. Публичная страница направления (WEB1).
      await page.goto("/napravleniya/bali");

      // 2. Лид-форма (WEB2). data-testid — рекомендуемые устойчивые селекторы.
      await page.getByRole("button", { name: /оставить заявку/i }).click();
      await page.getByTestId("lead-form-destination").fill("Бали");
      await page.getByTestId("lead-form-dates").fill("октябрь 2026");
      await page.getByTestId("lead-form-people").fill("2");
      await page.getByTestId("lead-form-contact").fill(marker);
      await page.getByTestId("lead-form-submit").click();
      await expect(page.getByText(/спасибо|заявка отправлена/i)).toBeVisible();

      // 3. Та же заявка появляется в панели с источником «Сайт».
      const admin = await context.newPage();
      await login(admin);
      await admin.goto("/panel/leads?status=new");
      const card = admin.getByTestId("lead-card").filter({ hasText: marker });
      await expect(card).toBeVisible();
      await expect(card).toContainText("Сайт");
    },
  );
});
