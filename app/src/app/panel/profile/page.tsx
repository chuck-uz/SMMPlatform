import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";

const ROLE_LABELS: Record<string, string> = {
  admin: "Администратор",
  manager: "Менеджер",
};

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="p-6 sm:p-8 sm:px-10">
      <div className="grid max-w-[1020px] grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-[14px] border border-border bg-card p-6 shadow-card">
          <h2 className="text-sm font-semibold text-foreground">Личные данные</h2>
          <div className="mt-5 flex items-center gap-4">
            <div className="h-14 w-14 shrink-0 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600" />
            <div>
              <div className="text-sm font-semibold text-foreground">
                {session.user.name ?? session.user.email}
              </div>
              <div className="mt-0.5 text-[13px] text-muted-foreground">{session.user.email}</div>
            </div>
          </div>
          <div className="mt-5 text-[13px] text-muted-foreground">
            Роль: {ROLE_LABELS[session.user.role ?? ""] ?? session.user.role}
          </div>
        </div>

        <div className="rounded-[14px] border border-border bg-card p-6 shadow-card">
          <h2 className="text-sm font-semibold text-foreground">Безопасность</h2>
          <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
            Смена пароля от учётной записи панели.
          </p>
          <div className="mt-4">
            <ChangePasswordForm />
          </div>
        </div>
      </div>
    </div>
  );
}
