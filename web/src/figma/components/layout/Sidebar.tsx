"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import {
  LayoutDashboard,
  Handshake,
  FileStack,
  FileText,
  CheckSquare,
  Film,
  BarChart3,
  BadgePercent,
  BookMarked,
  DollarSign,
  CalendarDays,
  Users,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { v1Fetch } from "@/lib/v1-client";
import { useEffect } from "react";

/* ─── Types ───────────────────────────────────────────────────────── */
type NavItem = {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
};
type NavGroup = { label: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    label: "Главная",
    items: [{ path: "/", label: "Панель", icon: LayoutDashboard }],
  },
  {
    label: "Работа",
    items: [
      { path: "/deals", label: "Сделки", icon: Handshake },
      { path: "/offers", label: "Офферы", icon: FileStack },
      { path: "/contracts", label: "Контракты", icon: FileText },
      { path: "/tasks", label: "Задачи", icon: CheckSquare },
    ],
  },
  {
    label: "Контент",
    items: [
      { path: "/content", label: "Контент", icon: Film },
      { path: "/platform-forecast", label: "Прогноз", icon: BarChart3 },
      { path: "/grades", label: "Грейды", icon: BadgePercent },
      { path: "/rights-base", label: "База прав", icon: BookMarked },
    ],
  },
  {
    label: "Финансы",
    items: [
      { path: "/payments", label: "Платежи", icon: DollarSign },
      { path: "/cashflow", label: "Кэш-флоу", icon: CalendarDays },
    ],
  },
  {
    label: "Партнёры",
    items: [{ path: "/counterparties", label: "Контрагенты", icon: Users }],
  },
];

function isActive(pathname: string, path: string) {
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
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    admin: "Администратор",
    manager: "Менеджер",
    rights_owner: "Правообладатель",
    client: "Клиент",
  };
  return map[role] ?? role;
}

/* ─── Component ───────────────────────────────────────────────────── */
export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<MeUser | null | undefined>(undefined);
  const [collapsed, setCollapsed] = useState(false);

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
    return () => { cancelled = true; };
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }, [router]);

  const w = collapsed ? "w-[60px]" : "w-[210px]";

  return (
    <aside
      className={`glass-sidebar relative flex flex-col shrink-0 h-full transition-all duration-200 ${w}`}
      aria-label="Навигация"
    >
      {/* Logo */}
      <div className={`flex items-center gap-3 px-3 py-4 border-b border-[var(--glass-border)] ${collapsed ? "justify-center" : ""}`}>
        <Link
          href="/"
          className="flex shrink-0 items-center justify-center w-8 h-8 rounded-[10px] bg-[#1e3d32] overflow-hidden"
          aria-label="На главную"
        >
          <Image
            src="/brand/growix-logo.png"
            alt="GROWIX"
            width={32}
            height={32}
            className="w-5 h-5 object-contain brightness-0 invert"
            priority
          />
        </Link>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-foreground leading-tight tracking-tight truncate">GROWIX</p>
            <p className="text-[10px] text-muted-foreground truncate">Content Group</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2" aria-label="Разделы">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-1">
            {!collapsed && (
              <p className="px-2 pt-2 pb-1 text-[9px] font-semibold uppercase tracking-[0.07em] text-muted-foreground select-none">
                {group.label}
              </p>
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.path);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  title={collapsed ? `${group.label}: ${item.label}` : undefined}
                  className={`flex items-center gap-2.5 px-2.5 py-[7px] rounded-[10px] text-[12px] font-medium transition-colors mb-0.5 ${
                    active
                      ? "bg-[#1e3d32] text-white"
                      : "text-foreground/60 hover:bg-black/[0.04] hover:text-foreground"
                  } ${collapsed ? "justify-center" : ""}`}
                >
                  <Icon
                    className={`shrink-0 h-[15px] w-[15px] ${active ? "text-[#7fd4af]" : ""}`}
                    strokeWidth={active ? 2 : 1.8}
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User block */}
      <div className="border-t border-[var(--glass-border)] p-2">
        <div className={`flex items-center gap-2.5 px-2 py-2 rounded-[10px] hover:bg-black/[0.04] cursor-pointer ${collapsed ? "justify-center" : ""}`}>
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2d9e75] text-[10px] font-bold text-white">
            {me === undefined ? "…" : userInitials(me?.displayName ?? null, me?.email ?? "?")}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-foreground truncate leading-tight">
                {me === undefined ? "…" : (me?.displayName ?? me?.email ?? "—")}
              </p>
              <p className="text-[9px] text-muted-foreground truncate">
                {me ? roleLabel(me.role) : ""}
              </p>
            </div>
          )}
          {!collapsed && (
            <button
              type="button"
              onClick={() => void logout()}
              aria-label="Выйти"
              className="shrink-0 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-black/[0.06] transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={1.8} />
            </button>
          )}
        </div>
      </div>

      {/* Collapse toggle */}
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        aria-label={collapsed ? "Развернуть меню" : "Свернуть меню"}
        className="absolute -right-3 top-[52px] z-10 flex h-6 w-6 items-center justify-center rounded-full bg-white border border-[var(--glass-border)] text-muted-foreground shadow-sm hover:text-foreground transition-colors"
      >
        {collapsed
          ? <ChevronRight className="h-3 w-3" strokeWidth={2} />
          : <ChevronLeft className="h-3 w-3" strokeWidth={2} />
        }
      </button>
    </aside>
  );
}
