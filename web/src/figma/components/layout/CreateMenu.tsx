"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Handshake,
  FileStack,
  FileText,
  CheckSquare,
  ChevronDown,
} from "lucide-react";

type MenuItem = {
  label: string;
  sub: string;
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
};

const ITEMS: MenuItem[] = [
  {
    label: "Сделка",
    sub: "Новая сделка с контрагентом",
    href: "/deals?create=1",
    icon: Handshake,
  },
  {
    label: "Оффер",
    sub: "Коммерческое предложение",
    href: "/offers?create=1",
    icon: FileStack,
  },
  {
    label: "Контракт",
    sub: "Черновик контракта",
    href: "/contracts?create=1",
    icon: FileText,
  },
  {
    label: "Задача",
    sub: "Новая задача",
    href: "/tasks?create=1",
    icon: CheckSquare,
  },
];

export function CreateMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  /* close on outside click */
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  /* close on Escape */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Создать новую запись"
        className={`flex items-center gap-1.5 rounded-[20px] px-3.5 py-1.5 text-xs font-medium transition-colors ${
          open
            ? "bg-[#1e3d32] text-white"
            : "bg-[#1e3d32] text-white hover:bg-[#163028]"
        }`}
      >
        <Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
        <span className="hidden sm:inline">Создать</span>
        <ChevronDown
          className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          strokeWidth={2}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-1.5 w-56 overflow-hidden rounded-xl border border-border bg-background shadow-xl"
        >
          <div className="px-3 pb-1 pt-2.5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Быстрое создание
            </p>
          </div>
          {ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.href}
                role="menuitem"
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push(item.href);
                }}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted">
                  <Icon
                    className="h-3.5 w-3.5 text-muted-foreground"
                    strokeWidth={2}
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {item.label}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.sub}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
