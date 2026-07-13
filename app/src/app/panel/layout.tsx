import { redirect } from "next/navigation";
import { ArrowRightStartOnRectangleIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { auth, signOut } from "@/auth";
import { PanelNav } from "@/components/PanelNav";

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="flex min-h-full flex-1">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className="flex h-16 items-center gap-2 border-b border-border px-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <SparklesIcon className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="font-semibold text-sm text-foreground">Панель турагентства</span>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <PanelNav isAdmin={session.user.role === "admin"} />
        </div>

        <div className="border-t border-border p-3">
          <p className="truncate px-3 text-xs text-muted-foreground">{session.user.email}</p>
          <form action={logout}>
            <button
              type="submit"
              className="mt-1 flex w-full cursor-pointer items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground"
            >
              <ArrowRightStartOnRectangleIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
              Выйти
            </button>
          </form>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border bg-card px-4 md:hidden">
          <span className="font-semibold text-sm text-foreground">Панель турагентства</span>
        </header>

        <nav
          aria-label="Разделы панели (мобильная версия)"
          className="overflow-x-auto border-b border-border bg-card px-3 py-2 md:hidden"
        >
          <PanelNav direction="horizontal" isAdmin={session.user.role === "admin"} />
        </nav>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
