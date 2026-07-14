import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRightStartOnRectangleIcon } from "@heroicons/react/24/outline";
import { auth, signOut } from "@/auth";
import { PanelNav } from "@/components/PanelNav";
import { PanelHeader } from "@/components/PanelHeader";
import { prisma } from "@/lib/prisma";

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const pendingCommentCount = await prisma.instagramComment.count({
    where: { replyStatus: "draft_ready" },
  });

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="flex min-h-full flex-1">
      <aside className="hidden w-[68px] shrink-0 flex-col items-center gap-1.5 border-r border-border bg-card py-5 md:flex">
        <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-[10px] bg-accent text-lg font-extrabold text-accent-foreground">
          Т
        </div>

        <div className="flex-1">
          <PanelNav isAdmin={session.user.role === "admin"} pendingCommentCount={pendingCommentCount} />
        </div>

        <Link
          href="/panel/profile"
          title={`${session.user.email} — Профиль`}
          aria-label="Профиль"
          className="mb-1.5 h-[34px] w-[34px] shrink-0 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600"
        />
        <form action={logout}>
          <button
            type="submit"
            title="Выйти"
            aria-label="Выйти"
            className="flex h-[42px] w-[42px] cursor-pointer items-center justify-center rounded-[11px] text-subtle transition-colors duration-200 hover:bg-muted hover:text-foreground"
          >
            <ArrowRightStartOnRectangleIcon className="h-[19px] w-[19px]" aria-hidden="true" />
          </button>
        </form>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border bg-card px-4 md:hidden">
          <span className="font-semibold text-sm text-foreground">Панель турагентства</span>
          <form action={logout}>
            <button
              type="submit"
              title="Выйти"
              aria-label="Выйти"
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground"
            >
              <ArrowRightStartOnRectangleIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          </form>
        </header>

        <nav
          aria-label="Разделы панели (мобильная версия)"
          className="overflow-x-auto border-b border-border bg-card px-3 py-2 md:hidden"
        >
          <PanelNav
            direction="horizontal"
            isAdmin={session.user.role === "admin"}
            pendingCommentCount={pendingCommentCount}
          />
        </nav>

        <PanelHeader />

        <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
