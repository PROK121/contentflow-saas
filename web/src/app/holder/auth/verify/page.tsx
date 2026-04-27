"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { ErrorState, LoadingState } from "@/components/PageState";
import { HolderAuthLayout } from "@/components/holder/HolderAuthLayout";
import { tr } from "@/lib/i18n";

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
    <HolderAuthLayout
      title={
        error
          ? tr("holderAuth", "invalidLinkTitle")
          : tr("holderAuth", "enteringTitle")
      }
      maxWidth="max-w-md"
    >
      <div className="text-center">
        {error ? (
          <>
            <ErrorState message={error} />
            <a
              className="text-sm text-primary underline"
              href="/holder/login"
            >
              {tr("holderAuth", "requestNewLink")}
            </a>
          </>
        ) : (
          <LoadingState label={tr("holderAuth", "enteringDescription")} />
        )}
      </div>
    </HolderAuthLayout>
  );
}

export default function MagicLinkVerifyPage() {
  return (
    <Suspense
      fallback={
        <HolderAuthLayout title={tr("holderAuth", "loadingTitle")} maxWidth="max-w-md">
          <LoadingState />
        </HolderAuthLayout>
      }
    >
      <MagicLinkVerifyInner />
    </Suspense>
  );
}
