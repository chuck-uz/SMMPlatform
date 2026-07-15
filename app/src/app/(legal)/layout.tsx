import Link from "next/link";

export default function LegalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="font-semibold text-sm text-foreground">
            Платформа продвижения турагентства
          </Link>
          <Link
            href="/login"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Вход
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        {children}
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-2xl flex-wrap gap-x-6 gap-y-2 px-4 py-6 text-sm text-muted-foreground sm:px-6">
          <Link href="/privacy" className="hover:text-foreground">
            Политика конфиденциальности
          </Link>
          <Link href="/data-deletion" className="hover:text-foreground">
            Удаление данных
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            Пользовательское соглашение
          </Link>
          <a
            href="mailto:www.dinya.ru@gmail.com"
            className="hover:text-foreground"
          >
            www.dinya.ru@gmail.com
          </a>
        </div>
      </footer>
    </div>
  );
}
