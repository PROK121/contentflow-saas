"use client";

import { FormEvent, useState } from "react";
import { Mail } from "lucide-react";
import { ErrorState } from "@/components/PageState";
import { HolderAuthLayout } from "@/components/holder/HolderAuthLayout";
import { tr } from "@/lib/i18n";

type Mode = "magic" | "password";

export default function HolderLoginPage() {
  const [mode, setMode] = useState<Mode>("magic");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (mode === "magic") {
        const r = await fetch("/v1/auth/holder/magic-link/request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim() }),
        });
        if (!r.ok) {
          throw new Error(`Не удалось отправить ссылку (HTTP ${r.status})`);
        }
        setInfo(
          "Если этот email зарегистрирован в системе, на него отправлена ссылка для входа.",
        );
      } else {
        const r = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), password }),
        });
        const text = await r.text();
        if (!r.ok) {
          let msg = text || `Ошибка ${r.status}`;
          try {
            const j = JSON.parse(text) as { message?: string | string[] };
            if (Array.isArray(j.message)) msg = j.message.join(" ");
            else if (typeof j.message === "string") msg = j.message;
          } catch {
            /* raw */
          }
          throw new Error(msg);
        }
        window.location.href = "/holder";
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  return (
    <HolderAuthLayout
      title={tr("holderAuth", "cabinetTitle")}
      subtitle={tr("holderAuth", "cabinetSubtitle")}
      maxWidth="max-w-md"
    >
      <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg bg-muted/50 p-1 text-sm">
        <button
          type="button"
          onClick={() => setMode("magic")}
          className={`rounded-md px-3 py-2 transition-colors ${
            mode === "magic"
              ? "bg-card font-medium text-foreground shadow-sm"
              : "text-muted-foreground"
          }`}
        >
          {tr("holderAuth", "loginByLink")}
        </button>
        <button
          type="button"
          onClick={() => setMode("password")}
          className={`rounded-md px-3 py-2 transition-colors ${
            mode === "password"
              ? "bg-card font-medium text-foreground shadow-sm"
              : "text-muted-foreground"
          }`}
        >
          {tr("holderAuth", "loginByPassword")}
        </button>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div>
          <label
            htmlFor="email"
            className="mb-1 block text-sm font-medium text-foreground"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            className="w-full rounded-lg border border-border/50 bg-input-background px-3 py-2 text-sm outline-none focus-visible:border-ring/80 focus-visible:ring-2 focus-visible:ring-ring/25"
          />
        </div>
        {mode === "password" ? (
          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              Пароль
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              className="w-full rounded-lg border border-border/50 bg-input-background px-3 py-2 text-sm outline-none focus-visible:border-ring/80 focus-visible:ring-2 focus-visible:ring-ring/25"
            />
          </div>
        ) : null}

        {error ? <ErrorState message={error} /> : null}
        {info ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {info}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow transition-opacity disabled:opacity-60"
        >
          {mode === "magic" ? <Mail className="size-4" /> : null}
          {loading
            ? tr("holderAuth", "sending")
            : mode === "magic"
              ? tr("holderAuth", "sendLink")
              : tr("holderAuth", "signIn")}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        {tr("holderAuth", "inviteHelp")}
      </p>
    </HolderAuthLayout>
  );
}
