"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Lightbulb } from "lucide-react";
import { v1Fetch } from "@/lib/v1-client";

const KIND_OPTIONS: { value: string; label: string }[] = [
  { value: "movie", label: "Фильм" },
  { value: "series", label: "Сериал" },
  { value: "tv_show", label: "ТВ-шоу" },
  { value: "documentary", label: "Документальный" },
  { value: "other", label: "Другое" },
];

interface ProposeForm {
  title: string;
  kind: string;
  productionYear: string;
  countryOfOrigin: string;
  description: string;
  rightsAvailable: string;
  contactPhone: string;
}

const INITIAL_FORM: ProposeForm = {
  title: "",
  kind: "movie",
  productionYear: "",
  countryOfOrigin: "",
  description: "",
  rightsAvailable: "",
  contactPhone: "",
};

export default function HolderProposePage() {
  const router = useRouter();
  const [form, setForm] = useState<ProposeForm>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedTaskId, setSubmittedTaskId] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("Укажите название тайтла");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const resp = await v1Fetch<{ ok: true; taskId: string }>(
        "/holder/proposals",
        {
          method: "POST",
          body: JSON.stringify({
            title: form.title.trim(),
            kind: form.kind || undefined,
            productionYear: form.productionYear.trim() || undefined,
            countryOfOrigin: form.countryOfOrigin.trim() || undefined,
            description: form.description.trim() || undefined,
            rightsAvailable: form.rightsAvailable.trim() || undefined,
            contactPhone: form.contactPhone.trim() || undefined,
          }),
        },
      );
      setSubmittedTaskId(resp.taskId);
      setForm(INITIAL_FORM);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSubmitting(false);
    }
  }

  if (submittedTaskId) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-900">
          <h1 className="text-xl font-semibold">Заявка отправлена</h1>
          <p className="mt-2 text-sm">
            Спасибо! Ваше предложение нового тайтла принято и передано
            ответственному менеджеру. Мы свяжемся с вами в ближайшее время по
            email или телефону, указанному в заявке.
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setSubmittedTaskId(null)}
              className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-emerald-900 hover:bg-emerald-100"
            >
              Отправить ещё одну
            </button>
            <button
              type="button"
              onClick={() => router.push("/holder")}
              className="rounded-md border border-emerald-300 px-3 py-1.5 text-sm font-medium hover:bg-emerald-100"
            >
              Вернуться на главную
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
          <Lightbulb className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Предложить тайтл</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Расскажите о фильме, сериале или другом контенте, который вы хотите
            добавить в каталог GROWIX. Менеджер свяжется с вами в течение 5
            рабочих дней.
          </p>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-border/40 bg-card p-6">
        <Field
          label="Название тайтла"
          required
          value={form.title}
          onChange={(v) => setForm({ ...form, title: v })}
          placeholder="Например, «Ночной полёт»"
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-foreground">
              Тип
            </label>
            <select
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value })}
              className="mt-1 w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
            >
              {KIND_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <Field
            label="Год производства"
            value={form.productionYear}
            onChange={(v) => setForm({ ...form, productionYear: v })}
            placeholder="2024"
            inputMode="numeric"
            maxLength={4}
          />
        </div>

        <Field
          label="Страна производства"
          value={form.countryOfOrigin}
          onChange={(v) => setForm({ ...form, countryOfOrigin: v })}
          placeholder="Россия"
        />

        <Textarea
          label="Описание"
          value={form.description}
          onChange={(v) => setForm({ ...form, description: v })}
          placeholder="Краткий синопсис, жанр, ключевые факты"
          rows={4}
        />

        <Textarea
          label="Какие права доступны"
          value={form.rightsAvailable}
          onChange={(v) => setForm({ ...form, rightsAvailable: v })}
          placeholder="Например: лицензионные права на территорию РФ и СНГ, ТВ + VOD, на 3 года"
          rows={3}
        />

        <Field
          label="Телефон для связи (опционально)"
          value={form.contactPhone}
          onChange={(v) => setForm({ ...form, contactPhone: v })}
          placeholder="+7 ..."
        />

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => router.push("/holder")}
            className="rounded-md border border-border/60 px-4 py-2 text-sm hover:bg-muted"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? "Отправка…" : "Отправить заявку"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  required,
  value,
  onChange,
  placeholder,
  inputMode,
  maxLength,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "text" | "numeric" | "email" | "tel";
  maxLength?: number;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground">
        {label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        maxLength={maxLength}
        className="mt-1 w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
      />
    </div>
  );
}

function Textarea({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="mt-1 w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
      />
    </div>
  );
}
