import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CreateUserForm } from "@/components/CreateUserForm";
import { UserActiveToggle } from "@/components/UserActiveToggle";

const ROLE_LABELS: Record<string, string> = {
  admin: "Администратор",
  manager: "Менеджер",
};

const AVATAR_GRADIENTS = [
  "from-emerald-400 to-teal-600",
  "from-sky-400 to-indigo-500",
  "from-pink-400 to-purple-500",
  "from-amber-400 to-orange-500",
];

export default async function UsersPage() {
  const session = await auth();

  if (session?.user?.role !== "admin") {
    return (
      <div className="p-6 sm:p-8 sm:px-10">
        <div className="max-w-[1020px] rounded-[14px] border border-border bg-card p-6 text-sm text-muted-foreground shadow-card">
          Этот раздел доступен только администратору.
        </div>
      </div>
    );
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  });

  return (
    <div className="p-6 sm:p-8 sm:px-10">
      <p className="max-w-[640px] text-[14.5px] leading-relaxed text-muted-foreground">
        Команда с доступом к панели и её роли.
      </p>

      <div className="mt-6 max-w-[1020px] overflow-x-auto rounded-[14px] border border-border bg-card shadow-card">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[1.3fr_130px_1fr_130px_110px] items-center gap-4 border-b border-border bg-muted/60 px-[22px] py-[11px] text-[11.5px] font-semibold uppercase tracking-wide text-subtle">
            <span>Пользователь</span>
            <span>Роль</span>
            <span>Email</span>
            <span>Статус</span>
            <span></span>
          </div>
          {users.map((user, i) => (
            <div
              key={user.id}
              className="grid grid-cols-[1.3fr_130px_1fr_130px_110px] items-center gap-4 border-t border-border px-[22px] py-3.5 first:border-t-0"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[13px] font-bold text-white ${AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length]}`}
                >
                  {(user.name ?? user.email).charAt(0).toUpperCase()}
                </div>
                <span className="truncate text-[13.5px] font-semibold text-foreground">
                  {user.name ?? user.email}
                </span>
              </div>
              <span className="text-[13px] text-muted-foreground">
                {ROLE_LABELS[user.role] ?? user.role}
              </span>
              <span className="truncate text-[13px] text-muted-foreground">{user.email}</span>
              <span
                className={`inline-flex w-fit items-center rounded-full px-[10px] py-1 text-xs font-semibold ${
                  user.isActive ? "bg-accent/10 text-accent-hover" : "bg-warning/10 text-warning"
                }`}
              >
                {user.isActive ? "Активен" : "Деактивирован"}
              </span>
              <div className="flex justify-end">
                <UserActiveToggle
                  userId={user.id}
                  isActive={user.isActive}
                  isSelf={user.id === session.user.id}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 max-w-sm rounded-[14px] border border-border bg-card p-6 shadow-card">
        <h2 className="text-sm font-semibold text-foreground">Добавить пользователя</h2>
        <div className="mt-4">
          <CreateUserForm />
        </div>
      </div>
    </div>
  );
}
