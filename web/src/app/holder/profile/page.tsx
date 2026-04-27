"use client";

import { FormEvent, useEffect, useState } from "react";
import { Bell, BellOff, Loader2, Save, UserCircle } from "lucide-react";
import { v1Fetch } from "@/lib/v1-client";
import { ErrorState, LoadingState } from "@/components/PageState";
import { tr } from "@/lib/i18n";

interface HolderMe {
  user: {
    id: string;
    email: string;
    displayName: string | null;
    phone: string | null;
    notificationsEnabled: boolean;
  };
  onboardingComplete: boolean;
}

export default function HolderProfilePage() {
  const [data, setData] = useState<HolderMe | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Локальный draft, чтобы не дёргать API на каждое нажатие клавиши.
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    let alive = true;
    v1Fetch<HolderMe>("/holder/me")
      .then((res) => {
        if (!alive) return;
        setData(res);
        setDisplayName(res.user.displayName ?? "");
        setPhone(res.user.phone ?? "");
        setNotificationsEnabled(res.user.notificationsEnabled);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Не удалось загрузить");
      });
    return () => {
      alive = false;
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!data) return;
    setSaving(true);
    setError(null);
    try {
      // Шлём только изменённые поля, чтобы PATCH был дифф-семантичным
      // (бэкенд пишет в audit-лог список реально менявшихся полей).
      const payload: Record<string, unknown> = {};
      if ((displayName || null) !== data.user.displayName) {
        payload.displayName = displayName;
      }
      if ((phone || null) !== data.user.phone) {
        payload.phone = phone;
      }
      if (notificationsEnabled !== data.user.notificationsEnabled) {
        payload.notificationsEnabled = notificationsEnabled;
      }
      if (Object.keys(payload).length === 0) {
        setSavedAt(new Date());
        return;
      }
      await v1Fetch("/holder/me", {
        method: "PATCH",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });
      setData((prev) =>
        prev
          ? {
              ...prev,
              user: {
                ...prev.user,
                displayName: displayName || null,
                phone: phone || null,
                notificationsEnabled,
              },
            }
          : prev,
      );
      setSavedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6 flex items-center gap-3">
        <UserCircle className="size-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{tr("holder", "profileTitle")}</h1>
          <p className="text-sm text-muted-foreground">
            Контакт для менеджера и настройки уведомлений
          </p>
        </div>
      </header>

      {error ? <ErrorState message={error} /> : null}

      {!data ? (
        <LoadingState label={tr("holder", "loadingData")} />
      ) : (
        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-xl border border-border/40 bg-card p-6"
        >
          <Field label="Email" hint="Email менять нельзя — это идентификатор">
            <input
              type="email"
              value={data.user.email}
              disabled
              className="w-full rounded-md border border-border/40 bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
            />
          </Field>

          <Field label="Имя" hint="Как менеджер увидит вас в письмах и задачах">
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={255}
              placeholder="Иван Иванов"
              className="w-full rounded-md border border-border/40 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </Field>

          <Field
            label="Телефон"
            hint="Менеджер свяжется по телефону при срочных задачах"
          >
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={64}
              placeholder="+7 (___) ___-__-__"
              className="w-full rounded-md border border-border/40 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </Field>

          <div className="rounded-lg border border-border/30 bg-muted/20 p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={notificationsEnabled}
                onChange={(e) => setNotificationsEnabled(e.target.checked)}
                className="mt-0.5 size-4 rounded border-border/60"
              />
              <span className="flex-1">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  {notificationsEnabled ? (
                    <Bell className="size-4 text-primary" />
                  ) : (
                    <BellOff className="size-4 text-muted-foreground" />
                  )}
                  Получать уведомления о событиях по сделкам
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Транзакционные письма (вход в кабинет, ссылки приглашения,
                  подтверждения подписи) приходят всегда — это нужно для
                  безопасности.
                </span>
              </span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            {savedAt ? (
              <span className="text-xs text-muted-foreground">
                Сохранено {savedAt.toLocaleTimeString("ru-RU")}
              </span>
            ) : null}
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Сохранить
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {hint ? (
        <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>
      ) : null}
    </label>
  );
}
