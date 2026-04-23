import { Suspense } from "react";
import { ContentCatalog } from "@/figma/pages/ContentCatalog";

export default function ContentPage() {
  return (
    <Suspense
      fallback={
        <div className="p-4 text-sm text-muted-foreground">Загрузка…</div>
      }
    >
      <ContentCatalog />
    </Suspense>
  );
}
