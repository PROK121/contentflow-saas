"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

function MagicLinkVerifyInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    const token = params.get("token");
    const nextParam = params.get("next");
    if (!token) {
      setError("В ссылке нет токена. Запросите новую ссылку для входа.");
      return;
    }
    (async () => {
      try {
        const r = await fetch("/api/auth/holder/magic-link/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
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
        // Безопасный редирект: только в пределах /holder/* — иначе игнор.
        const safeNext =
          nextParam &&
          nextParam.startsWith("/holder") &&
          !nextParam.startsWith("//")
            ? nextParam
            : "/holder";
        router.replace(safeNext);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось войти");
      }
    })();
  }, [params, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-border/40 bg-card p-8 shadow-sm text-center">
        {error ? (
          <>
            <h1 className="mb-2 text-lg font-semibold">Ссылка недействительна</h1>
            <p className="mb-4 text-sm text-muted-foreground">{error}</p>
            <a
              className="text-sm text-primary underline"
              href="/holder/login"
            >
              Запросить новую ссылку
            </a>
          </>
        ) : (
          <>
            <h1 className="mb-2 text-lg font-semibold">Входим…</h1>
            <p className="text-sm text-muted-foreground">
              Проверяем ссылку и подписываем сессию. Не закрывайте вкладку.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function MagicLinkVerifyPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Загрузка…</div>}>
      <MagicLinkVerifyInner />
    </Suspense>
  );
}
