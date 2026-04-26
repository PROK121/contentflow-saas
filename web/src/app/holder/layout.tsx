import type { Metadata } from "next";
import { HolderOnboardingGate } from "./HolderOnboardingGate";
import { HolderShell } from "./HolderShell";

export const metadata: Metadata = {
  title: "Кабинет правообладателя",
};

// Все страницы кабинета — динамические: данные тянутся клиентом по cookie
// и зависят от текущего пользователя. Статический пререндер не нужен.
export const dynamic = "force-dynamic";

export default function HolderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <HolderShell>
      <HolderOnboardingGate>{children}</HolderOnboardingGate>
    </HolderShell>
  );
}
