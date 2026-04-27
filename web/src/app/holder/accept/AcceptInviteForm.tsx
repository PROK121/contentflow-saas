"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { ErrorState, LoadingState } from "@/components/PageState";
import { HolderAuthLayout } from "@/components/holder/HolderAuthLayout";
import { tr } from "@/lib/i18n";

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
      <HolderAuthLayout title={tr("holderAuth", "invalidLinkTitle")} maxWidth="max-w-md">
        <ErrorState message={previewError} />
      </HolderAuthLayout>
    );
  }

  if (!preview) {
    return (
      <HolderAuthLayout title={tr("holderAuth", "checkInviteTitle")} maxWidth="max-w-md">
        <LoadingState label="Проверяем ссылку..." />
      </HolderAuthLayout>
    );
  }

  if (preview.alreadyConsumed) {
    return (
      <HolderAuthLayout title={tr("holderAuth", "inviteConsumed")} maxWidth="max-w-md">
        <div className="text-center">
          <CheckCircle2 className="mx-auto mb-3 size-10 text-emerald-600" />
          <p className="mb-4 text-sm text-muted-foreground">
            {tr("holderAuth", "inviteConsumedDescription")}
          </p>
          <a className="text-sm text-primary underline" href="/holder/login">
            {tr("holderAuth", "signIn")}
          </a>
        </div>
      </HolderAuthLayout>
    );
  }

  return (
    <HolderAuthLayout
      title={tr("holderAuth", "inviteTitle")}
      subtitle={
        <>
          {preview.invitedBy.displayName ?? preview.invitedBy.email} приглашает вас как
          представителя организации{" "}
          <span className="font-medium text-foreground">
            {preview.organization.legalName}
          </span>
          .
        </>
      }
      maxWidth="max-w-lg"
    >
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

        {error ? <ErrorState message={error} /> : null}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow transition-opacity disabled:opacity-60"
        >
          {submitting ? "Сохраняем…" : "Принять приглашение и войти"}
        </button>
      </form>
    </HolderAuthLayout>
  );
}
