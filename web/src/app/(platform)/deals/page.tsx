import { Suspense } from "react";
import { DealsBoard } from "@/components/deals/DealsBoard";

export default function DealsRoutePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Загрузка…</div>}>
      <DealsBoard />
    </Suspense>
  );
}
