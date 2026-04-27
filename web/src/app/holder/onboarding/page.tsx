"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { v1Fetch } from "@/lib/v1-client";
import { ErrorState } from "@/components/PageState";

const TERMS_VERSION = "2026-04-26";

/// Лёгкий вариант onboarding: для пользователей, которые попали в кабинет
/// без прохождения флоу invite/accept (например, мигрированные старые
/// rights_owner или зашли через magic-link до того, как приняли условия).
/// Полная версия с реквизитами — на /holder/accept (только при первом
/// приёме инвайта).
export default function HolderOnboardingPage() {
  const router = useRouter();
  const [accept, setAccept] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!accept) {
      setError("Подтвердите согласие с условиями использования");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await v1Fetch<{ ok: boolean }>("/holder/me/accept-terms", {
        method: "POST",
        body: JSON.stringify({ version: TERMS_VERSION }),
      });
      router.replace("/holder");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-2 text-2xl font-semibold">Добро пожаловать</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Прежде чем продолжить, ознакомьтесь с условиями работы в кабинете
        правообладателя.
      </p>
      <form
        onSubmit={onSubmit}
        className="space-y-5 rounded-xl border border-border/40 bg-card p-6"
      >
        <div className="rounded-lg border border-border/30 bg-muted/30 p-4 text-sm text-muted-foreground">
          В кабинете отображаются ваши тайтлы, активные сделки по ним, начисления
          и договоры. Все действия с финансовыми и правовыми документами
          фиксируются в журнале аудита (дата, IP, действие).
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={accept}
            onChange={(e) => setAccept(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Я согласен(на) с условиями использования платформы (версия{" "}
            {TERMS_VERSION}) и подтверждаю, что уполномочен(а) представлять свою
            организацию в кабинете правообладателя.
          </span>
        </label>
        {error ? <ErrorState message={error} /> : null}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow disabled:opacity-60"
        >
          {submitting ? "Сохраняем…" : "Продолжить"}
        </button>
      </form>
    </div>
  );
}
