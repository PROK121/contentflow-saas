"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Handshake,
  FileText,
  Film,
  Users,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { v1Fetch } from "@/lib/v1-client";

/* ─── Types ───────────────────────────────────────────────────────── */
type SearchResult = {
  id: string;
  label: string;
  sub?: string;
  href: string;
  group: "deals" | "contracts" | "content" | "counterparties";
};

const GROUP_META = {
  deals: { label: "Сделки", Icon: Handshake, color: "text-emerald-600" },
  contracts: { label: "Контракты", Icon: FileText, color: "text-blue-500" },
  content: { label: "Контент", Icon: Film, color: "text-violet-500" },
  counterparties: { label: "Контрагенты", Icon: Users, color: "text-amber-500" },
} as const;

/* ─── API helpers ─────────────────────────────────────────────────── */
async function searchAll(q: string): Promise<SearchResult[]> {
  if (!q.trim()) return [];
  const ql = q.toLowerCase();

  const [deals, contracts, catalog, orgs] = await Promise.allSettled([
    v1Fetch<{ id: string; title: string; stage?: string }[]>(
      `/deals?q=${encodeURIComponent(q)}&limit=5`,
    ),
    v1Fetch<{ id: string; number?: string; counterparty?: string }[]>(
      `/contracts?q=${encodeURIComponent(q)}&limit=5`,
    ),
    v1Fetch<{ id: string; title: string; slug?: string }[]>(
      `/catalog/items?q=${encodeURIComponent(q)}&take=5`,
    ),
    v1Fetch<{ id: string; legalName: string; type?: string }[]>(
      `/organizations`,
    ),
  ]);

  const results: SearchResult[] = [];

  if (deals.status === "fulfilled") {
    for (const d of deals.value.slice(0, 5)) {
      results.push({
        id: d.id,
        label: d.title,
        sub: d.stage ?? undefined,
        href: `/deals`,
        group: "deals",
      });
    }
  }

  if (contracts.status === "fulfilled") {
    for (const c of contracts.value.slice(0, 5)) {
      const label = c.number ? `Контракт №${c.number}` : "Контракт";
      results.push({
        id: c.id,
        label,
        sub: c.counterparty ?? undefined,
        href: `/contracts`,
        group: "contracts",
      });
    }
  }

  if (catalog.status === "fulfilled") {
    for (const item of catalog.value.slice(0, 5)) {
      results.push({
        id: item.id,
        label: item.title,
        sub: item.slug ?? undefined,
        href: `/content`,
        group: "content",
      });
    }
  }

  if (orgs.status === "fulfilled") {
    const filtered = orgs.value
      .filter((o) => o.legalName.toLowerCase().includes(ql))
      .slice(0, 5);
    for (const o of filtered) {
      results.push({
        id: o.id,
        label: o.legalName,
        sub: o.type ?? undefined,
        href: `/counterparties`,
        group: "counterparties",
      });
    }
  }

  return results;
}

/* ─── Component ───────────────────────────────────────────────────── */
export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ⌘K / Ctrl+K shortcut */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  /* focus input when modal opens */
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setResults([]);
      setSelected(0);
    }
  }, [open]);

  /* debounced search */
  const runSearch = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await searchAll(q);
        setResults(r);
        setSelected(0);
      } finally {
        setLoading(false);
      }
    }, 280);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    runSearch(e.target.value);
  };

  /* keyboard navigation */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter" && results[selected]) {
      navigate(results[selected]);
    }
  };

  const navigate = (r: SearchResult) => {
    setOpen(false);
    router.push(r.href);
  };

  /* group results */
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    acc[r.group] ??= [];
    acc[r.group].push(r);
    return acc;
  }, {});

  const groupOrder: (keyof typeof GROUP_META)[] = [
    "deals",
    "contracts",
    "content",
    "counterparties",
  ];

  return (
    <>
      {/* Trigger bar — pill style */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Открыть поиск (⌘K)"
        className="flex flex-1 min-w-0 max-w-xs items-center gap-2 rounded-[20px] border border-black/[0.06] bg-black/[0.055] px-3 py-1.5 text-left text-xs text-foreground/40 transition-colors hover:bg-black/[0.08] hover:text-foreground/60 sm:max-w-sm xl:max-w-md"
      >
        <Search className="h-3.5 w-3.5 shrink-0 text-foreground/35" strokeWidth={2} />
        <span className="flex-1 truncate">Поиск по всему…</span>
        <kbd className="hidden shrink-0 rounded-[5px] border border-black/[0.1] bg-black/[0.05] px-1.5 py-px font-mono text-[10px] text-foreground/30 sm:block">
          ⌘K
        </kbd>
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4"
          style={{ background: "rgba(0,0,0,0.55)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-background shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search input */}
            <div className="flex items-center gap-2 border-b px-4 py-3">
              {loading ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
              ) : (
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <input
                ref={inputRef}
                value={query}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder="Поиск по сделкам, контрактам, контенту…"
                className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                autoComplete="off"
                spellCheck={false}
              />
              <kbd className="shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                esc
              </kbd>
            </div>

            {/* Results */}
            <div className="max-h-[380px] overflow-y-auto py-1">
              {!query.trim() && (
                <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                  Начните вводить запрос
                </p>
              )}

              {query.trim() && !loading && results.length === 0 && (
                <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                  Ничего не найдено
                </p>
              )}

              {groupOrder.map((group) => {
                const items = grouped[group];
                if (!items?.length) return null;
                const { label, Icon, color } = GROUP_META[group];
                return (
                  <div key={group}>
                    <div className="flex items-center gap-1.5 px-3 pb-1 pt-2">
                      <Icon className={`h-3 w-3 ${color}`} strokeWidth={2} />
                      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        {label}
                      </span>
                    </div>
                    {items.map((r) => {
                      const idx = results.indexOf(r);
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => navigate(r)}
                          className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${
                            idx === selected
                              ? "bg-accent text-accent-foreground"
                              : "text-foreground hover:bg-muted"
                          }`}
                        >
                          <span className="flex-1 truncate">{r.label}</span>
                          {r.sub && (
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {r.sub}
                            </span>
                          )}
                          <ArrowRight className="h-3 w-3 shrink-0 opacity-40" />
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Footer hint */}
            {results.length > 0 && (
              <div className="flex items-center gap-3 border-t px-4 py-2">
                <span className="text-[10px] text-muted-foreground">
                  <kbd className="rounded border border-border bg-muted px-1 font-mono">↑↓</kbd> выбор
                </span>
                <span className="text-[10px] text-muted-foreground">
                  <kbd className="rounded border border-border bg-muted px-1 font-mono">↵</kbd> перейти
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
