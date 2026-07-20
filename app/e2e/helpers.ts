import { PrismaPg } from "@prisma/adapter-pg";
import type { Page } from "@playwright/test";
import { PrismaClient } from "../src/generated/prisma/client";

// Отдельный клиент для тестов — пишет в ту же БД, что и приложение под тестом.
// Prisma 7: клиент генерируется в src/generated и работает через pg-адаптер
// (как в src/lib/prisma.ts), а не импортируется из "@prisma/client".
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
export const prisma = new PrismaClient({ adapter });

const EMAIL = process.env.E2E_EMAIL ?? "admin@example.com";
const PASSWORD = process.env.E2E_PASSWORD ?? "";

/** Логин в панель через реальную форму NextAuth. */
export async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Пароль").fill(PASSWORD);
  await page.getByRole("button", { name: "Войти" }).click();
  // Успешный вход редиректит в панель.
  await page.waitForURL("**/panel/**");
}

export interface SeededLead {
  conversationId: string;
  destination: string;
}

/**
 * Вставляет заявку ровно так, как её создаст будущая веб-форма (source: "site"),
 * чтобы проверка панели была детерминированной и не зависела от AI-агента.
 */
export async function seedSiteLead(tag: string): Promise<SeededLead> {
  const conversationId = `e2e-${tag}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const destination = `E2E Бали ${tag}`;
  await prisma.lead.create({
    data: {
      conversationId,
      destination,
      people: "2 взрослых",
      dates: "октябрь 2026",
      budget: "300000",
      contact: "@e2e_test",
      wishes: "вилла у моря",
      completeness: "complete",
      status: "new",
      source: "site",
    },
  });
  return { conversationId, destination };
}

/** Убирает тестовую заявку, чтобы прогоны не копили мусор в БД. */
export async function deleteLead(conversationId: string): Promise<void> {
  await prisma.lead.deleteMany({ where: { conversationId } });
}
