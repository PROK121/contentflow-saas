"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

const TERMS_VERSION = "2026-04-26";

interface InvitePreview {
  email: string;
  organization: { id: string; legalName: string };
  invitedBy: { displayName: string | null; email: string };
  expiresAt: string;
  alreadyConsumed: boolean;
}

export function AcceptInviteForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [usePassword, setUsePassword] = useState(true);
  const [password, setPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setPreviewError("В ссылке нет токена. Попросите менеджера выслать новую.");
      return;
    }
    (async () => {
      try {
        const r = await fetch(
          `/v1/auth/holder/invites/preview?token=${encodeURIComponent(token)}`,
        );
        const text = await r.text();
        if (!r.ok) {
          let msg = `Ошибка ${r.status}`;
          try {
            const j = JSON.parse(text) as { message?: string };
            if (typeof j.message === "string") msg = j.message;
          } catch {
            /* raw */
          }
          setPreviewError(msg);
          return;
        }
        setPreview(JSON.parse(text) as InvitePreview);
      } catch (e) {
        setPreviewError(
          e instanceof Error ? e.message : "Не удалось проверить ссылку",
        );
      }
    })();
  }, [token]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!acceptTerms) {
      setError("Подтвердите согласие с условиями использования");
      return;
    }
    if (usePassword && password.length < 8) {
      setError("Пароль должен содержать не менее 8 символов");
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch("/api/auth/holder/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          displayName: displayName.trim(),
          phone: phone.trim() || undefined,
          password: usePassword ? password : undefined,
          acceptedTermsVersion: TERMS_VERSION,
        }),
      });
      const text = await r.text();
      if (!r.ok) {
        let msg = `Ошибка ${r.status}`;
        try {
          const j = JSON.parse(text) as { message?: string | string[] };
          if (Array.isArray(j.message)) msg = j.message.join(" ");
          else if (typeof j.message === "string") msg = j.message;
        } catch {
          /* raw */
        }
        setError(msg);
        return;
      }
      router.replace("/holder");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось принять приглашение");
    } finally {
      setSubmitting(false);
    }
  }

  if (previewError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-xl border border-border/40 bg-card p-8 text-center shadow-sm">
          <h1 className="mb-2 text-lg font-semibold">Ссылка недействительна</h1>
          <p className="text-sm text-muted-foreground">{previewError}</p>
        </div>
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Проверяем ссылку…
      </div>
    );
  }

  if (preview.alreadyConsumed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-xl border border-border/40 bg-card p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto mb-3 size-10 text-emerald-600" />
          <h1 className="mb-2 text-lg font-semibold">Приглашение уже использовано</h1>
          <p className="mb-4 text-sm text-muted-foreground">
            Эта ссылка одноразовая. Войдите по email на странице входа.
          </p>
          <a className="text-sm text-primary underline" href="/holder/login">
            Перейти ко входу
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-lg rounded-xl border border-border/40 bg-card p-8 shadow-sm">
        <div className="mb-5 flex justify-center">
          <Image
            src="/brand/growix-logo.png"
            alt="GROWIX"
            width={220}
            height={62}
            className="h-9 w-auto object-contain"
            priority
          />
        </div>
        <h1 className="mb-1 text-center text-xl font-semibold">
          Приглашение в кабинет правообладателя
        </h1>
        <p className="mb-6 text-center text-sm text-muted-foreground">
          {preview.invitedBy.displayName ?? preview.invitedBy.email} приглашает
          вас как представителя организации{" "}
          <span className="font-medium text-foreground">
            {preview.organization.legalName}
          </span>
          .
        </p>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Email</label>
            <input
              type="email"
              value={preview.email}
              disabled
              className="w-full rounded-lg border border-border/40 bg-muted px-3 py-2 text-sm text-muted-foreground"
            />
          </div>
          <div>
            <label htmlFor="displayName" className="mb-1 block text-sm font-medium">
              Контактное лицо (ФИО)
            </label>
            <input
              id="displayName"
              required
              minLength={2}
              maxLength={120}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-lg border border-border/50 bg-input-background px-3 py-2 text-sm outline-none focus-visible:border-ring/80 focus-visible:ring-2 focus-visible:ring-ring/25"
            />
          </div>
          <div>
            <label htmlFor="phone" className="mb-1 block text-sm font-medium">
              Телефон <span className="text-muted-foreground">(необязательно)</span>
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+7…"
              className="w-full rounded-lg border border-border/50 bg-input-background px-3 py-2 text-sm outline-none focus-visible:border-ring/80 focus-visible:ring-2 focus-visible:ring-ring/25"
            />
          </div>

          <div className="rounded-lg border border-border/40 p-3">
            <label className="mb-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={usePassword}
                onChange={(e) => setUsePassword(e.target.checked)}
              />
              Установить пароль
            </label>
            {usePassword ? (
              <input
                type="password"
                placeholder="Не менее 8 символов"
                minLength={8}
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-border/50 bg-input-background px-3 py-2 text-sm outline-none focus-visible:border-ring/80 focus-visible:ring-2 focus-visible:ring-ring/25"
              />
            ) : (
              <p className="text-xs text-muted-foreground">
                Можно входить только по одноразовой ссылке на email — это безопаснее
                и не требует запоминать пароль.
              </p>
            )}
          </div>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
            />
            <span>
              Я подтверждаю, что уполномочен представлять организацию{" "}
              <span className="font-medium">{preview.organization.legalName}</span>
              {" "}и соглашаюсь с условиями обработки коммерческой информации в
              кабинете.
            </span>
          </label>

          {error ? (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow transition-opacity disabled:opacity-60"
          >
            {submitting ? "Сохраняем…" : "Принять приглашение и войти"}
          </button>
        </form>
      </div>
    </div>
  );
}
