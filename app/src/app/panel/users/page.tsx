import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CreateUserForm } from "@/components/CreateUserForm";
import { UserActiveToggle } from "@/components/UserActiveToggle";

const ROLE_LABELS: Record<string, string> = {
  admin: "Администратор",
  manager: "Менеджер",
};

export default async function UsersPage() {
  const session = await auth();

  if (session?.user?.role !== "admin") {
    return (
      <div className="max-w-2xl">
        <h1 className="font-semibold text-2xl text-foreground">Пользователи</h1>
        <div className="mt-6 rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          Этот раздел доступен только администратору.
        </div>
      </div>
    );
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, role: true, isActive: true },
  });

  return (
    <div className="max-w-3xl">
      <h1 className="font-semibold text-2xl text-foreground">Пользователи</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Управление доступом к панели: создание учётных записей и деактивация без удаления
        истории.
      </p>

      <div className="mt-6 overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/50 text-xs font-medium text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Роль</th>
              <th className="px-4 py-3">Статус</th>
              <th className="px-4 py-3 text-right">Действие</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-foreground">{user.email}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {ROLE_LABELS[user.role] ?? user.role}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-sm px-3 py-1 text-xs font-semibold ${
                      user.isActive
                        ? "bg-accent/10 text-accent"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {user.isActive ? "Активен" : "Деактивирован"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <UserActiveToggle
                    userId={user.id}
                    isActive={user.isActive}
                    isSelf={user.id === session.user.id}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8 max-w-sm rounded-lg border border-border bg-card p-6 shadow-card">
        <h2 className="font-semibold text-sm text-foreground">Добавить пользователя</h2>
        <div className="mt-4">
          <CreateUserForm />
        </div>
      </div>
    </div>
  );
}
