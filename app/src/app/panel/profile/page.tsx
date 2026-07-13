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
    <div className="max-w-sm">
      <h1 className="font-semibold text-2xl text-foreground">Профиль</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {session.user.email} · {ROLE_LABELS[session.user.role ?? ""] ?? session.user.role}
      </p>

      <div className="mt-6 rounded-lg border border-border bg-card p-6 shadow-card">
        <h2 className="font-semibold text-sm text-foreground">Сменить пароль</h2>
        <div className="mt-4">
          <ChangePasswordForm />
        </div>
      </div>
    </div>
  );
}
