import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "@/components/LoginForm";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/panel");
  }

  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-4 py-12 sm:px-6">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-8 shadow-card">
        <h1 className="font-semibold text-xl text-foreground">Вход в панель</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Платформа продвижения турагентства
        </p>

        <div className="mt-6">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
