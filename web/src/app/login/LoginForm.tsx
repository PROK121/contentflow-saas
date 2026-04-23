"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { BackgroundEffects } from "@/figma/components/BackgroundEffects";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from")?.trim() || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const text = await res.text();
      if (!res.ok) {
        let msg = text || `Ошибка ${res.status}`;
        try {
          const j = JSON.parse(text) as { message?: string | string[] };
          if (Array.isArray(j.message)) msg = j.message.join(" ");
          else if (typeof j.message === "string") msg = j.message;
        } catch {
          /* сырой текст */
        }
        setError(msg);
        return;
      }
      router.replace(from.startsWith("/") ? from : "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось войти");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <BackgroundEffects />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-white/20 bg-white/95 p-8 shadow-xl backdrop-blur-sm">
        <div className="mb-8 flex justify-center">
          <Link href="/" className="rounded-lg border border-black/10 bg-white px-3 py-2 shadow-sm">
            <Image
              src="/brand/growix-logo.png"
              alt="GROWIX CONTENT GROUP"
              width={220}
              height={62}
              className="h-9 w-auto object-contain object-center"
              priority
            />
          </Link>
        </div>
        <h1 className="mb-1 text-center text-xl font-semibold text-foreground">
          Вход в систему
        </h1>
        <p className="mb-6 text-center text-sm text-muted-foreground">
          Укажите корпоративный email и пароль
        </p>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-foreground">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              className="w-full rounded-lg border border-border/50 bg-input-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring/80 focus-visible:ring-2 focus-visible:ring-ring/25"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-foreground">
              Пароль
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                className="w-full rounded-lg border border-border/50 bg-input-background py-2 pl-3 pr-10 text-sm text-foreground outline-none focus-visible:border-ring/80 focus-visible:ring-2 focus-visible:ring-ring/25"
              />
              <button
                type="button"
                aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {showPassword ? (
                  <EyeOff className="size-4" strokeWidth={2.25} />
                ) : (
                  <Eye className="size-4" strokeWidth={2.25} />
                )}
              </button>
            </div>
          </div>
          {error ? (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow transition-opacity disabled:opacity-60"
          >
            {loading ? "Вход…" : "Войти"}
          </button>
        </form>
      </div>
    </div>
  );
}
