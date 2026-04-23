import type { DealStage } from "@/lib/types";

const styles: Record<DealStage, string> = {
  lead: "bg-slate-100 text-slate-800 ring-slate-200",
  negotiation: "bg-amber-50 text-amber-900 ring-amber-200",
  contract: "bg-sky-50 text-sky-900 ring-sky-200",
  paid: "bg-emerald-50 text-emerald-900 ring-emerald-200",
};

const labels: Record<DealStage, string> = {
  lead: "Лид",
  negotiation: "Переговоры",
  contract: "Контракт",
  paid: "Оплачено",
};

export function StageBadge({ stage }: { stage: DealStage }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${styles[stage]}`}
    >
      {labels[stage]}
    </span>
  );
}
