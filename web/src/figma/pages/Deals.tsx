"use client";

import { motion } from "motion/react";
import { Plus, MoreVertical, User, Calendar, DollarSign, TrendingUp } from "lucide-react";
import { formatMoneyAmount, parseMoneyNumber } from "@/lib/format-money";

const pipelineStages = [
  { id: "lead", label: "Лиды", color: "bg-info/15", borderColor: "border-info/30", textColor: "text-info" },
  { id: "negotiation", label: "Переговоры", color: "bg-warning/15", borderColor: "border-warning/30", textColor: "text-warning" },
  { id: "contract", label: "Контракт", color: "bg-primary/15", borderColor: "border-primary/30", textColor: "text-primary" },
  { id: "paid", label: "Оплачено", color: "bg-success/15", borderColor: "border-success/30", textColor: "text-success" },
];

const deals = [
  {
    id: 1,
    stage: "lead",
    client: "Netflix CEE",
    content: "Drama Series 'Horizon'",
    value: "56 250 000₸",
    probability: 65,
    contact: "Anna Kowalski",
    date: "2026-04-20",
  },
  {
    id: 2,
    stage: "lead",
    client: "Amazon Prime KZ",
    content: "Documentary Pack 2024",
    value: "35 100 000₸",
    probability: 45,
    contact: "Dmitry Ivanov",
    date: "2026-04-18",
  },
  {
    id: 3,
    stage: "negotiation",
    client: "Premier Media",
    content: "Film Collection",
    value: "20 250 000₸",
    probability: 80,
    contact: "Sarah Johnson",
    date: "2026-04-15",
  },
  {
    id: 4,
    stage: "negotiation",
    client: "StreamKZ",
    content: "Kids Content Bundle",
    value: "14 400 000₸",
    probability: 70,
    contact: "Aliya Nurbekova",
    date: "2026-04-12",
  },
  {
    id: 5,
    stage: "contract",
    client: "TVCentral",
    content: "Music Licensing Pack",
    value: "23 400 000₸",
    probability: 95,
    contact: "Igor Petrov",
    date: "2026-04-10",
  },
  {
    id: 6,
    stage: "contract",
    client: "MegaTV Russia",
    content: "Sports Documentary",
    value: "40 050 000₸",
    probability: 90,
    contact: "Elena Sokolova",
    date: "2026-04-08",
  },
  {
    id: 7,
    stage: "paid",
    client: "OTT Platform UA",
    content: "Thriller Series",
    value: "30 150 000₸",
    probability: 100,
    contact: "Viktor Kovalenko",
    date: "2026-04-05",
  },
  {
    id: 8,
    stage: "paid",
    client: "Cinema Network",
    content: "Classic Films License",
    value: "19 350 000₸",
    probability: 100,
    contact: "Maria Popova",
    date: "2026-04-01",
  },
];

export function Deals() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">Воронка сделок</h1>
          <p className="text-sm text-muted-foreground">
            Отслеживайте и управляйте лицензионными сделками
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors text-sm font-semibold shadow-sm">
          <Plus size={18} strokeWidth={2.5} />
          <span>Новая сделка</span>
        </button>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {pipelineStages.map((stage, index) => {
          const stageDeals = deals.filter((d) => d.stage === stage.id);
          const totalValue = stageDeals.reduce((sum, deal) => {
            return sum + (parseMoneyNumber(deal.value) ?? 0);
          }, 0);

          return (
            <motion.div
              key={stage.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`rounded-lg ${stage.color} border ${stage.borderColor} p-4 bg-card`}
            >
              <div className="space-y-2">
                <p className="text-xs font-bold text-foreground uppercase tracking-wider">{stage.label}</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold text-foreground">{stageDeals.length}</p>
                  <p className="text-xs text-muted-foreground font-semibold">сделок</p>
                </div>
                <p className="text-sm font-bold" style={{ fontFamily: 'var(--font-mono)' }}>
                  {totalValue > 0
                    ? `${formatMoneyAmount(totalValue)} \u20b8`
                    : "—"}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Pipeline Columns */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
        {pipelineStages.map((stage, stageIndex) => {
          const stageDeals = deals.filter((deal) => deal.stage === stage.id);

          return (
            <motion.div
              key={stage.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: stageIndex * 0.1 }}
              className="space-y-3"
            >
              {/* Column Header */}
              <div className={`rounded-lg ${stage.color} border ${stage.borderColor} p-4 bg-card`}>
                <h3 className="font-bold text-foreground uppercase tracking-wide text-xs mb-1">{stage.label}</h3>
                <p className="text-xs text-muted-foreground font-semibold">
                  {stageDeals.length} {stageDeals.length === 1 ? "сделка" : "сделок"}
                </p>
              </div>

              {/* Deal Cards */}
              <div className="space-y-3">
                {stageDeals.map((deal, dealIndex) => (
                  <motion.div
                    key={deal.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: stageIndex * 0.1 + dealIndex * 0.05 }}
                    className="rounded-lg bg-card border border-border p-4 hover:shadow-md transition-all duration-200 cursor-pointer"
                  >
                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground text-sm">
                            {deal.client}
                          </h4>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                            {deal.content}
                          </p>
                        </div>
                        <button className="p-1 hover:bg-muted rounded">
                          <MoreVertical size={14} className="text-muted-foreground" />
                        </button>
                      </div>

                      {/* Value */}
                      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded">
                        <DollarSign size={14} className="text-primary" strokeWidth={2.5} />
                        <span className="font-bold text-foreground text-sm" style={{ fontFamily: 'var(--font-mono)' }}>
                          {formatMoneyAmount(deal.value)}
                        </span>
                      </div>

                      {/* Details */}
                      <div className="space-y-1.5 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <User size={12} strokeWidth={2.5} />
                          <span className="font-medium">{deal.contact}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar size={12} strokeWidth={2.5} />
                          <span className="font-medium">{deal.date}</span>
                        </div>
                      </div>

                      {/* Probability */}
                      {deal.probability < 100 && (
                        <div className="space-y-1 pt-2 border-t border-border">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground font-semibold flex items-center gap-1">
                              <TrendingUp size={11} strokeWidth={2.5} />
                              Вероятность
                            </span>
                            <span className="font-bold text-foreground">{deal.probability}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all duration-300"
                              style={{ width: `${deal.probability}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
