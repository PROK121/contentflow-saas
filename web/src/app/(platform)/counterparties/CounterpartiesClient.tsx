"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Building2,
  Eye,
  EyeOff,
  Mail,
  Plus,
  UserCheck,
  UserPlus,
} from "lucide-react";
import { v1Fetch } from "@/lib/v1-client";

type HolderFinanceVisibility = "limited" | "full";

interface Organization {
  id: string;
  legalName: string;
  country: string;
  type: "client" | "rights_holder" | "internal";
  taxId: string | null;
  isResident: boolean;
  holderFinanceVisibility: HolderFinanceVisibility;
}

interface InviteRow {
  id: string;
  email: string;
  expiresAt: string;
  consumedAt: string | null;
  createdAt: string;
  note: string | null;
  invitedBy: { displayName: string | null; email: string };
}

interface UserRow {
  id: string;
  email: string;
  displayName: string | null;
  lastLoginAt: string | null;
  acceptedTermsAt: string | null;
  createdAt: string;
}

interface OrgState {
  invites: InviteRow[];
  users: UserRow[];
  loading: boolean;
  expanded: boolean;
}

export function CounterpartiesClient() {
  const [orgs, setOrgs] = useState<Organization[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<Record<string, OrgState>>({});
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const list = await v1Fetch<Organization[]>(
          "/organizations?type=rights_holder",
        );
        setOrgs(list);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ошибка");
      }
    })();
  }, []);

  const visibleOrgs = useMemo(() => {
    if (!orgs) return null;
    const q = search.trim().toLowerCase();
    if (!q) return orgs;
    return orgs.filter(
      (o) =>
        o.legalName.toLowerCase().includes(q) ||
        o.country.toLowerCase().includes(q),
    );
  }, [orgs, search]);

  async function loadOrgInvites(orgId: string) {
    setState((s) => ({
      ...s,
      [orgId]: {
        invites: s[orgId]?.invites ?? [],
        users: s[orgId]?.users ?? [],
        loading: true,
        expanded: true,
      },
    }));
    try {
      const data = await v1Fetch<{ invites: InviteRow[]; users: UserRow[] }>(
        `/auth/holder/invites?orgId=${encodeURIComponent(orgId)}`,
      );
      setState((s) => ({
        ...s,
        [orgId]: { ...data, loading: false, expanded: true },
      }));
    } catch (e) {
      setState((s) => ({
        ...s,
        [orgId]: {
          invites: [],
          users: [],
          loading: false,
          expanded: true,
        },
      }));
      setError(e instanceof Error ? e.message : "Не удалось загрузить инвайты");
    }
  }

  function toggleOrg(orgId: string) {
    const cur = state[orgId];
    if (cur?.expanded) {
      setState((s) => ({
        ...s,
        [orgId]: { ...cur, expanded: false },
      }));
      return;
    }
    void loadOrgInvites(orgId);
  }

  /// Меняем уровень видимости финансов на сервере и обновляем локальный
  /// список организаций (чтобы переключатель отрисовался сразу).
  async function setVisibility(
    orgId: string,
    visibility: HolderFinanceVisibility,
  ) {
    setOrgs((cur) =>
      cur
        ? cur.map((o) =>
            o.id === orgId ? { ...o, holderFinanceVisibility: visibility } : o,
          )
        : cur,
    );
    try {
      await v1Fetch<Organization>(`/organizations/${orgId}/holder-visibility`, {
        method: "PATCH",
        body: JSON.stringify({ visibility }),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
      // Откатываем UI к предыдущему значению — перечитаем список.
      try {
        const list = await v1Fetch<Organization[]>(
          "/organizations?type=rights_holder",
        );
        setOrgs(list);
      } catch {
        // ignore
      }
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Контрагенты — правообладатели</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Здесь приглашаете правообладателей в кабинет и видите статус их
            подключений. Все компании типа «правообладатель» заводятся в
            разделе «База прав».
          </p>
        </div>
        <input
          type="search"
          placeholder="Поиск по названию"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64 rounded-lg border border-border/40 bg-input-background px-3 py-2 text-sm outline-none focus-visible:border-ring/80 focus-visible:ring-2 focus-visible:ring-ring/25"
        />
      </div>

      {error ? (
        <div className="mb-6 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {visibleOrgs === null ? (
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      ) : visibleOrgs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 bg-card p-10 text-center">
          <Building2 className="mx-auto mb-3 size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Нет правообладателей. Заведите контрагента в «Базе прав».
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {visibleOrgs.map((org) => (
            <OrgRow
              key={org.id}
              org={org}
              state={state[org.id]}
              onToggle={() => toggleOrg(org.id)}
              onInvited={() => void loadOrgInvites(org.id)}
              onVisibilityChange={(v) => void setVisibility(org.id, v)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OrgRow({
  org,
  state,
  onToggle,
  onInvited,
  onVisibilityChange,
}: {
  org: Organization;
  state: OrgState | undefined;
  onToggle: () => void;
  onInvited: () => void;
  onVisibilityChange: (visibility: HolderFinanceVisibility) => void;
}) {
  const [showInvite, setShowInvite] = useState(false);
  const activeUsers = state?.users.length ?? null;
  const pendingInvites =
    state?.invites.filter((i) => !i.consumedAt && new Date(i.expiresAt) > new Date())
      .length ?? null;

  return (
    <div className="rounded-xl border border-border/40 bg-card">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-muted/30"
      >
        <div className="flex min-w-0 items-center gap-3">
          <Building2 className="size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className="truncate font-medium">{org.legalName}</div>
            <div className="text-xs text-muted-foreground">{org.country}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {activeUsers !== null ? (
            <span className="flex items-center gap-1">
              <UserCheck className="size-3.5" />
              {activeUsers}
            </span>
          ) : null}
          {pendingInvites !== null && pendingInvites > 0 ? (
            <span className="flex items-center gap-1 text-amber-600">
              <Mail className="size-3.5" />
              {pendingInvites}
            </span>
          ) : null}
        </div>
      </button>

      {state?.expanded ? (
        <div className="border-t border-border/30 px-4 py-4">
          <VisibilityToggle
            value={org.holderFinanceVisibility}
            onChange={onVisibilityChange}
          />
          {state.loading ? (
            <p className="text-sm text-muted-foreground">Загружаем инвайты…</p>
          ) : (
            <>
              <div className="mb-4 mt-5 flex items-center justify-between">
                <h3 className="text-sm font-medium">
                  Активные пользователи кабинета
                </h3>
                <button
                  type="button"
                  onClick={() => setShowInvite((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
                >
                  <UserPlus className="size-3.5" />
                  Пригласить
                </button>
              </div>
              {state.users.length === 0 ? (
                <p className="text-sm text-muted-foreground">Никто ещё не подключён.</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {state.users.map((u) => (
                    <li
                      key={u.id}
                      className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2"
                    >
                      <span>
                        <span className="font-medium">
                          {u.displayName ?? u.email}
                        </span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {u.email}
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {u.lastLoginAt
                          ? `Заходил ${new Date(u.lastLoginAt).toLocaleDateString("ru-RU")}`
                          : "Не заходил"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {state.invites.length > 0 ? (
                <div className="mt-5">
                  <h3 className="mb-2 text-sm font-medium">История инвайтов</h3>
                  <ul className="space-y-1.5 text-xs">
                    {state.invites.map((inv) => {
                      const expired = new Date(inv.expiresAt).getTime() < Date.now();
                      const status = inv.consumedAt
                        ? "принят"
                        : expired
                          ? "истёк"
                          : "ожидает";
                      return (
                        <li
                          key={inv.id}
                          className="flex items-center justify-between rounded-md border border-border/30 px-3 py-1.5"
                        >
                          <span>
                            <span className="font-medium">{inv.email}</span>{" "}
                            <span className="text-muted-foreground">
                              · отправил {inv.invitedBy.displayName ?? inv.invitedBy.email}
                            </span>
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${
                              status === "принят"
                                ? "bg-emerald-100 text-emerald-700"
                                : status === "истёк"
                                  ? "bg-muted text-muted-foreground"
                                  : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {status}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}

              {showInvite ? (
                <InviteForm
                  orgId={org.id}
                  onDone={() => {
                    setShowInvite(false);
                    onInvited();
                  }}
                  onCancel={() => setShowInvite(false)}
                />
              ) : null}

              <AuditLogSection orgId={org.id} />
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

interface AuditEntry {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  ip: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user: { id: string; email: string; displayName: string | null } | null;
}

const ACTION_LABELS: Record<string, string> = {
  login_password: "Вход по паролю",
  login_magic: "Вход по magic-link",
  invite_claimed: "Активировал инвайт",
  view_dashboard: "Открыл дашборд",
  view_catalog_item: "Открыл тайтл",
  view_deal: "Открыл сделку",
  view_payout: "Открыл выплату",
  view_contract: "Открыл контракт",
  download_contract: "Скачал контракт",
  sign_contract: "Подписал контракт",
  upload_material: "Загрузил материал",
  propose_catalog_item: "Предложил тайтл",
  update_profile: "Обновил профиль",
  logout: "Вышел из кабинета",
};

function formatAction(a: string): string {
  return ACTION_LABELS[a] ?? a;
}

/// Лента «История действий» правообладателя по конкретной организации.
/// Лениво подгружает данные при первом раскрытии секции, чтобы не делать
/// лишний запрос на каждый клик по карточке контрагента.
function AuditLogSection({ orgId }: { orgId: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await v1Fetch<AuditEntry[]>(
        `/organizations/${orgId}/audit?limit=50`,
      );
      setItems(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить");
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    if (!open && items === null) void load();
    setOpen((v) => !v);
  }

  return (
    <div className="mt-5 rounded-lg border border-border/30">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/40"
      >
        <span className="flex items-center gap-2">
          <Activity className="size-4 text-muted-foreground" />
          История действий
        </span>
        <span className="text-xs text-muted-foreground">
          {open ? "скрыть" : "показать"}
        </span>
      </button>
      {open ? (
        <div className="border-t border-border/30 px-3 py-3">
          {loading ? (
            <p className="text-xs text-muted-foreground">Загружаем…</p>
          ) : error ? (
            <p className="text-xs text-destructive">{error}</p>
          ) : !items || items.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Пока никаких действий в кабинете не зафиксировано.
            </p>
          ) : (
            <ul className="space-y-1.5 text-xs">
              {items.map((it) => (
                <li
                  key={it.id}
                  className="flex items-start justify-between gap-3 rounded-md bg-muted/20 px-2.5 py-1.5"
                >
                  <span className="min-w-0">
                    <span className="font-medium">
                      {formatAction(it.action)}
                    </span>
                    {it.entityType ? (
                      <span className="ml-1 text-muted-foreground">
                        · {it.entityType}
                        {it.entityId ? ` ${it.entityId.slice(0, 6)}…` : null}
                      </span>
                    ) : null}
                    <span className="ml-2 text-muted-foreground">
                      {it.user
                        ? it.user.displayName ?? it.user.email
                        : "система"}
                    </span>
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {new Date(it.createdAt).toLocaleString("ru-RU", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

function VisibilityToggle({
  value,
  onChange,
}: {
  value: HolderFinanceVisibility;
  onChange: (v: HolderFinanceVisibility) => void;
}) {
  const isFull = value === "full";
  return (
    <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="flex items-center gap-1.5 text-sm font-medium">
            {isFull ? (
              <Eye className="size-4 text-emerald-600" />
            ) : (
              <EyeOff className="size-4 text-muted-foreground" />
            )}
            Видимость финансов в кабинете
          </h4>
          <p className="mt-1 text-xs text-muted-foreground">
            {isFull
              ? "Правообладатель видит суммы выплат и итоги по контрактам."
              : "Правообладатель видит факт выплат без сумм. Включите «полный доступ» только при наличии подписанного приложения."}
          </p>
        </div>
        <div className="flex shrink-0 overflow-hidden rounded-md border border-border/60 text-xs">
          <button
            type="button"
            onClick={() => {
              if (isFull) onChange("limited");
            }}
            className={`px-2.5 py-1.5 transition-colors ${
              !isFull
                ? "bg-foreground text-background"
                : "bg-card hover:bg-muted/40"
            }`}
          >
            Ограниченно
          </button>
          <button
            type="button"
            onClick={() => {
              if (!isFull) onChange("full");
            }}
            className={`px-2.5 py-1.5 transition-colors ${
              isFull
                ? "bg-emerald-600 text-white"
                : "bg-card hover:bg-muted/40"
            }`}
          >
            Полный доступ
          </button>
        </div>
      </div>
    </div>
  );
}

function InviteForm({
  orgId,
  onDone,
  onCancel,
}: {
  orgId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [issuedLink, setIssuedLink] = useState<string | null>(null);
  const [emailStatus, setEmailStatus] = useState<{
    delivered: boolean;
    mode: "smtp" | "console" | "skipped";
  } | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await v1Fetch<{
        inviteId: string;
        rawToken: string;
        expiresAt: string;
        email?: { delivered: boolean; mode: "smtp" | "console" | "skipped" };
      }>("/auth/holder/invites", {
        method: "POST",
        body: JSON.stringify({
          organizationId: orgId,
          email: email.trim(),
          note: note.trim() || undefined,
        }),
      });
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const url = `${origin}/holder/accept?token=${encodeURIComponent(res.rawToken)}`;
      setIssuedLink(url);
      setEmailStatus(res.email ?? { delivered: false, mode: "console" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSubmitting(false);
    }
  }

  if (issuedLink) {
    const delivered = emailStatus?.delivered === true;
    return (
      <div
        className={`mt-5 space-y-3 rounded-lg border p-4 ${
          delivered
            ? "border-emerald-200 bg-emerald-50"
            : "border-amber-200 bg-amber-50"
        }`}
      >
        <p
          className={`text-sm font-medium ${
            delivered ? "text-emerald-900" : "text-amber-900"
          }`}
        >
          {delivered
            ? "Письмо отправлено правообладателю"
            : "Ссылка готова — письмо не доставлено"}
        </p>
        <p
          className={`text-xs ${delivered ? "text-emerald-800" : "text-amber-800"}`}
        >
          {delivered
            ? "Правообладателю отправлено письмо со ссылкой на приём приглашения. Ссылку ниже можно использовать как запасной канал — например, скопировать в мессенджер."
            : emailStatus?.mode === "console"
              ? "SMTP в API не настроен (CONSOLE-режим). Скопируйте ссылку и отправьте правообладателю в любой удобный мессенджер."
              : "SMTP вернул ошибку — проверьте логи Render (категория EMAIL/holder-invite). А пока скопируйте ссылку и отправьте правообладателю вручную."}{" "}
          Срок действия — 7 дней, открыть ссылку можно один раз.
        </p>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={issuedLink}
            onFocus={(e) => e.currentTarget.select()}
            className={`w-full rounded-md border bg-white px-2 py-1.5 text-xs ${
              delivered ? "border-emerald-300" : "border-amber-300"
            }`}
          />
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(issuedLink);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                /* clipboard not available */
              }
            }}
            className={`rounded-md px-3 py-1.5 text-xs font-medium text-white ${
              delivered ? "bg-emerald-700" : "bg-amber-700"
            }`}
          >
            {copied ? "Скопировано" : "Копировать"}
          </button>
        </div>
        <button
          type="button"
          className={`text-xs underline ${
            delivered ? "text-emerald-900" : "text-amber-900"
          }`}
          onClick={() => onDone()}
        >
          Готово
        </button>
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-lg border border-border/40 bg-muted/30 p-4">
      <h4 className="mb-3 flex items-center gap-1.5 text-sm font-medium">
        <Plus className="size-3.5" />
        Новый инвайт
      </h4>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs">Email правообладателя</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-border/40 bg-card px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs">
            Комментарий <span className="text-muted-foreground">(не виден в письме)</span>
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Например: Алия Кенжебаева, продюсер"
            className="w-full rounded-md border border-border/40 bg-card px-2 py-1.5 text-sm"
          />
        </div>
        {error ? (
          <p className="rounded-md bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-border/40 px-3 py-1.5 text-xs"
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={submitting || !email.trim()}
            onClick={submit}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
          >
            {submitting ? "Создаём…" : "Создать ссылку"}
          </button>
        </div>
      </div>
    </div>
  );
}
