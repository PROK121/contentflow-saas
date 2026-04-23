import { MainLayout } from "@/figma/components/layout/MainLayout";

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MainLayout>{children}</MainLayout>;
}

