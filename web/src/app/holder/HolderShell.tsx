"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  FileText,
  Film,
  FolderUp,
  Handshake,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Menu,
  UserCircle,
  Wallet,
  X,
} from "lucide-react";

const NAV = [
  { href: "/holder", label: "Главная", icon: LayoutDashboard },
  { href: "/holder/titles", label: "Мои тайтлы", icon: Film },
  { href: "/holder/materials", label: "Материалы", icon: FolderUp },
  { href: "/holder/deals", label: "Сделки", icon: Handshake },
  { href: "/holder/payouts", label: "Выплаты", icon: Wallet },
  { href: "/holder/contracts", label: "Договоры", icon: FileText },
  { href: "/holder/propose", label: "Предложить тайтл", icon: Lightbulb },
  { href: "/holder/profile", label: "Профиль", icon: UserCircle },
] as const;

const PUBLIC_PATHS = new Set([
  "/holder/login",
  "/holder/accept",
  "/holder/auth/verify",
]);

export function HolderShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // На публичных страницах (логин, приём инвайта) шапка/меню не нужны.
  const isPublic = PUBLIC_PATHS.has(pathname ?? "");

  // Закрывать мобильное меню при переходе.
  useEffect(() => setOpen(false), [pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/holder/login");
  }

  if (isPublic) {
    return <div className="min-h-screen bg-background">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/40 bg-card/95 px-4 py-3 backdrop-blur md:hidden">
        <Link href="/holder" className="flex items-center gap-2">
          <Image
            src="/brand/growix-logo.png"
            alt="GROWIX"
            width={120}
            height={32}
            className="h-7 w-auto object-contain"
          />
        </Link>
        <button
          type="button"
          aria-label="Меню"
          onClick={() => setOpen((v) => !v)}
          className="rounded-md p-2 hover:bg-muted"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </header>

      <div className="flex">
        {/* Sidebar — desktop */}
        <aside className="hidden w-64 shrink-0 border-r border-border/40 bg-card/40 md:flex md:min-h-screen md:flex-col">
          <div className="flex items-center gap-3 border-b border-border/40 px-5 py-4">
            <Image
              src="/brand/growix-logo.png"
              alt="GROWIX"
              width={140}
              height={36}
              className="h-8 w-auto object-contain"
              priority
            />
          </div>
          <nav className="flex-1 px-3 py-4">
            <ul className="space-y-1">
              {NAV.map((item) => {
                const active =
                  item.href === "/holder"
                    ? pathname === "/holder"
                    : pathname?.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                        active
                          ? "bg-primary/10 font-medium text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <Icon className="size-4" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="border-t border-border/40 p-3">
            <button
              type="button"
              onClick={logout}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LogOut className="size-4" />
              Выйти
            </button>
          </div>
        </aside>

        {/* Sidebar — mobile drawer */}
        {open ? (
          <div className="fixed inset-0 z-40 md:hidden">
            <button
              aria-label="Закрыть меню"
              type="button"
              className="absolute inset-0 bg-black/30"
              onClick={() => setOpen(false)}
            />
            <aside className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-border/40 bg-card">
              <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
                <Image
                  src="/brand/growix-logo.png"
                  alt="GROWIX"
                  width={120}
                  height={32}
                  className="h-7 w-auto object-contain"
                />
                <button
                  type="button"
                  aria-label="Закрыть"
                  onClick={() => setOpen(false)}
                  className="rounded-md p-2 hover:bg-muted"
                >
                  <X className="size-5" />
                </button>
              </div>
              <nav className="flex-1 px-3 py-4">
                <ul className="space-y-1">
                  {NAV.map((item) => {
                    const active =
                      item.href === "/holder"
                        ? pathname === "/holder"
                        : pathname?.startsWith(item.href);
                    const Icon = item.icon;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                            active
                              ? "bg-primary/10 font-medium text-primary"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          }`}
                        >
                          <Icon className="size-4" />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
              <div className="border-t border-border/40 p-3">
                <button
                  type="button"
                  onClick={logout}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <LogOut className="size-4" />
                  Выйти
                </button>
              </div>
            </aside>
          </div>
        ) : null}

        <main className="flex-1 px-4 py-6 md:px-8 md:py-10">{children}</main>
      </div>
    </div>
  );
}
