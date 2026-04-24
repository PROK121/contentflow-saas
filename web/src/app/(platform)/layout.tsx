import { MainLayout } from "@/figma/components/layout/MainLayout";

// Все страницы платформы — за auth-cookie и используют клиентские хуки
// (useSearchParams, useRouter). Статический пререндер тут не нужен и
// ломается на этапе билда. Рендерим на сервере при каждом запросе.
export const dynamic = "force-dynamic";

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MainLayout>{children}</MainLayout>;
}

