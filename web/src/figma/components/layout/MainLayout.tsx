"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { v1Fetch } from "@/lib/v1-client";
import {
  LayoutDashboard,
  Film,
  Handshake,
  FileText,
  FileStack,
  DollarSign,
  BarChart3,
  BadgePercent,
  CheckSquare,
  BookMarked,
  Bell,
  Settings,
} from "lucide-react";
import { BackgroundEffects } from "../BackgroundEffects";

const navItems = [
  { path: "/", label: "Панель", icon: LayoutDashboard },
  { path: "/content", label: "Контент", icon: Film },
  { path: "/platform-forecast", label: "Прогноз", icon: BarChart3 },
  { path: "/grades", label: "Грейды", icon: BadgePercent },
  { path: "/deals", label: "Сделки", icon: Handshake },
  { path: "/offers", label: "Офферы", icon: FileStack },
  { path: "/contracts", label: "Контракты", icon: FileText },
  { path: "/payments", label: "Платежи", icon: DollarSign },
  { path: "/tasks", label: "Задачи", icon: CheckSquare },
  { path: "/rights-base", label: "База прав", icon: BookMarked },
];

function navClassName(active: boolean) {
  return `flex shrink-0 items-center gap-1 whitespace-nowrap rounded px-1.5 py-1 text-[11px] font-medium transition-all duration-200 sm:gap-1.5 sm:px-2 sm:py-1.5 sm:text-xs md:text-sm ${
    active
      ? "bg-white/20 text-white shadow-sm"
      : "text-white/80 hover:bg-white/10 hover:text-white"
  }`;
}

function isNavActive(pathname: string, path: string) {
  if (path === "/") return pathname === "/";
  return pathname === path || pathname.startsWith(`${path}/`);
}

type MeUser = {
  id: string;
  email: string;
  role: string;
  displayName: string | null;
};

function userInitials(displayName: string | null, email: string): string {
  const base = (displayName ?? email).trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  if (parts.length === 1 && parts[0].length >= 2) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function roleLabel(role: string): string {
  switch (role) {
    case "admin":
      return "Администратор";
    case "manager":
      return "Менеджер";
    case "rights_owner":
      return "Правообладатель";
    case "client":
      return "Клиент";
    default:
      return role;
  }
}

export function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<MeUser | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await v1Fetch<{ user: MeUser }>("/auth/me");
        if (!cancelled) setMe(res.user);
      } catch {
        if (!cancelled) setMe(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }, [router]);

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <BackgroundEffects />

      {/* Header */}
      <header className="border-b bg-primary text-primary-foreground shadow-md relative z-10">
        <div className="px-8 py-4">
          <div className="grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:gap-3">
            <Link
              href="/"
              className="flex shrink-0 items-center justify-self-start rounded-lg border border-white/30 bg-white/95 px-2.5 py-1 shadow-sm transition-colors hover:bg-white sm:px-3 sm:py-1.5"
            >
              <Image
                src="/brand/growix-logo.png"
                alt="GROWIX CONTENT GROUP"
                width={220}
                height={62}
                className="h-8 w-auto object-contain object-left sm:h-9"
                priority
              />
            </Link>

            {/* Разделы строго по центру свободного пространства между логотипом и пользователем */}
            <div className="flex min-w-0 justify-center justify-self-stretch">
              <nav
                className="w-max max-w-full overflow-x-auto overflow-y-hidden py-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                aria-label="Разделы"
              >
                <div className="flex flex-nowrap items-center gap-0.5">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const active = isNavActive(pathname, item.path);
                    return (
                      <Link
                        key={item.path}
                        href={item.path}
                        className={navClassName(active)}
                      >
                        <Icon
                          className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4"
                          strokeWidth={2}
                        />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </nav>
            </div>

            {/* Компактный блок пользователя */}
            <div className="flex shrink-0 items-center justify-self-end gap-0.5 border-l border-white/25 pl-1.5 sm:gap-1 sm:pl-2 md:pl-3">
              <button
                type="button"
                className="relative rounded p-1 text-white/80 transition-colors hover:bg-white/10 hover:text-white sm:p-1.5"
                aria-label="Уведомления"
              >
                <Bell className="h-4 w-4 sm:h-[18px] sm:w-[18px]" strokeWidth={2} />
                <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-accent sm:right-1 sm:top-1 sm:h-2 sm:w-2" />
              </button>
              <button
                type="button"
                className="rounded p-1 text-white/80 transition-colors hover:bg-white/10 hover:text-white sm:p-1.5"
                aria-label="Настройки"
              >
                <Settings className="h-4 w-4 sm:h-[18px] sm:w-[18px]" strokeWidth={2} />
              </button>
              <div
                className="ml-0.5 flex min-w-0 max-w-[5.5rem] items-center gap-1 rounded border border-white/20 bg-white/10 py-0.5 pl-1 pr-0.5 sm:max-w-[9rem] sm:gap-1.5 sm:py-1 sm:pl-1.5 sm:pr-1 md:max-w-[12rem]"
                title={
                  me === undefined || !me
                    ? undefined
                    : `${me.displayName ?? me.email}\n${roleLabel(me.role)}`
                }
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-accent text-[10px] font-bold text-accent-foreground shadow-sm sm:h-7 sm:w-7 sm:text-xs">
                  {me === undefined
                    ? "…"
                    : userInitials(me?.displayName ?? null, me?.email ?? "?")}
                </div>
                <p className="min-w-0 truncate text-[10px] font-semibold leading-tight text-white sm:text-xs">
                  {me === undefined
                    ? "…"
                    : (me?.displayName ?? me?.email ?? "—")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void logout()}
                className="shrink-0 rounded px-1 py-0.5 text-[10px] font-medium text-white/90 hover:bg-white/10 hover:text-white sm:px-1.5 sm:py-1 sm:text-xs"
              >
                Выйти
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto px-8 py-6">
        <div className="max-w-[1600px] mx-auto">{children}</div>
      </main>
    </div>
  );
}
