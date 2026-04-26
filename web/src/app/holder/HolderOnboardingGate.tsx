"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { v1Fetch } from "@/lib/v1-client";

/// Если пользователь зашёл по старому JWT (до приёма условий), отправляем
/// его на онбординг. На /holder/onboarding и публичных страницах гейт молчит.
export function HolderOnboardingGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!pathname) return;
    if (
      pathname === "/holder/onboarding" ||
      pathname === "/holder/login" ||
      pathname === "/holder/accept" ||
      pathname === "/holder/auth/verify"
    ) {
      setChecked(true);
      return;
    }
    (async () => {
      try {
        const data = await v1Fetch<{ onboardingComplete: boolean }>(
          "/holder/me",
        );
        if (cancelled) return;
        if (!data.onboardingComplete) {
          router.replace("/holder/onboarding");
          return;
        }
        setChecked(true);
      } catch {
        // На ошибке — не блокируем, страница сама покажет состояние ошибки.
        setChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (!checked) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        Загрузка…
      </div>
    );
  }
  return <>{children}</>;
}
