"use client";

import { motion } from "motion/react";
import { formatMoneyAmount } from "@/lib/format-money";
import {
  Film,
  DollarSign,
  FileText,
  TrendingUp,
  Download,
  Eye,
  Globe,
  Calendar,
} from "lucide-react";

const ownerStats = [
  {
    label: "Общий доход",
    value: "219 285 000₸",
    change: "+24.5%",
    icon: DollarSign,
    color: "bg-success/15",
  },
  {
    label: "Активные лицензии",
    value: "18",
    change: "+3 в этом месяце",
    icon: FileText,
    color: "bg-primary/15",
  },
  {
    label: "Контент",
    value: "32",
    change: "8 доступно",
    icon: Film,
    color: "bg-info/15",
  },
  {
    label: "Рост",
    value: "+32%",
    change: "по сравнению с прошлым годом",
    icon: TrendingUp,
    color: "bg-accent/15",
  },
];

const myContent = [
  {
    id: 1,
    title: "Horizon: New Beginnings",
    type: "Сериал",
    licensedTo: "Netflix CEE, Amazon Prime KZ",
    totalДоходы: "84 375 000₸",
    activeLicenses: 2,
    territories: ["CIS", "CEE"],
  },
  {
    id: 2,
    title: "Mountain Landscapes Collection",
    type: "Фильмы",
    licensedTo: "Visual Media Corp",
    totalДоходы: "5 760 000₸",
    activeLicenses: 1,
    territories: ["Worldwide"],
  },
  {
    id: 3,
    title: "Urban Symphony",
    type: "Концерты, шоу",
    licensedTo: "StreamKZ, Radio Network",
    totalДоходы: "35 280 000₸",
    activeLicenses: 2,
    territories: ["CIS"],
  },
];

const recentPayments = [
  {
    id: "ROY-2024-012",
    date: "2024-03-15",
    content: "Horizon: New Beginnings",
    client: "Netflix CEE",
    amount: "28 125 000₸",
    status: "завершено",
  },
  {
    id: "ROY-2024-013",
    date: "2024-03-20",
    content: "Urban Symphony",
    client: "StreamKZ",
    amount: "12 060 000₸",
    status: "завершено",
  },
  {
    id: "ROY-2024-014",
    date: "2026-04-30",
    content: "Mountain Landscapes",
    client: "Visual Media Corp",
    amount: "1 890 000₸",
    status: "ожидание",
  },
];

export function RightsOwnerPortal() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-3"
      >
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-lg bg-primary flex items-center justify-center shadow-sm">
            <span className="text-xl font-bold text-primary-foreground">PP</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Premium Productions Ltd.</h1>
            <p className="text-sm text-muted-foreground">Rights Owner Portal</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Отслеживайте эффективность контента, доходы и активные лицензии
        </p>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {ownerStats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`rounded-lg border border-border bg-card p-5 hover:shadow-md transition-all duration-300 ${stat.color}`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="p-2.5 rounded bg-card shadow-sm text-primary">
                    <Icon size={22} strokeWidth={2.5} />
                  </div>
                  <span className="text-xs text-muted-foreground font-semibold">{stat.change}</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1 text-foreground" style={{ fontFamily: 'var(--font-mono)' }}>
                    {formatMoneyAmount(stat.value)}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Мой контент */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="space-y-4"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">Мой контент</h2>
            <p className="text-xs text-muted-foreground">Портфолио лицензированного контента</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/10 rounded transition-colors">
            <Download size={16} strokeWidth={2.5} />
            Экспорт отчёта
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {myContent.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 + index * 0.1 }}
              className="rounded-lg bg-card border border-border p-5 hover:shadow-md transition-all duration-300"
            >
              <div className="space-y-4">
                <div>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-base font-semibold text-foreground">{item.title}</h3>
                    <span className="px-2 py-1 rounded bg-muted text-muted-foreground text-xs font-bold border border-border">
                      {item.type}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">Лицензировано: {item.licensedTo}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide font-semibold">Доходы</p>
                    <p className="text-base font-bold text-foreground" style={{ fontFamily: 'var(--font-mono)' }}>
                      {formatMoneyAmount(item.totalДоходы)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide font-semibold">Active Licenses</p>
                    <p className="text-base font-bold text-foreground">{item.activeLicenses}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Globe size={12} strokeWidth={2.5} />
                  <span className="font-medium">{item.territories.join(", ")}</span>
                </div>

                <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors text-xs font-bold">
                  <Eye size={14} strokeWidth={2.5} />
                  View Details
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Recent Payments */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="rounded-lg bg-card border border-border overflow-hidden shadow-sm"
      >
        <div className="px-6 py-4 border-b border-border bg-muted/30">
          <h2 className="text-base font-bold text-foreground uppercase tracking-wide">История платежей</h2>
          <p className="text-xs text-muted-foreground mt-1">Последние роялти полученные платежи</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50 border-b-2 border-border">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-bold text-foreground uppercase tracking-wider">ID платежа</th>
                <th className="text-left px-6 py-3 text-xs font-bold text-foreground uppercase tracking-wider">Дата</th>
                <th className="text-left px-6 py-3 text-xs font-bold text-foreground uppercase tracking-wider">Контент</th>
                <th className="text-left px-6 py-3 text-xs font-bold text-foreground uppercase tracking-wider">Клиент</th>
                <th className="text-left px-6 py-3 text-xs font-bold text-foreground uppercase tracking-wider">Сумма</th>
                <th className="text-left px-6 py-3 text-xs font-bold text-foreground uppercase tracking-wider">Статус</th>
              </tr>
            </thead>
            <tbody>
              {recentPayments.map((payment) => (
                <tr
                  key={payment.id}
                  className="border-b border-border hover:bg-muted/30 transition-colors"
                >
                  <td className="px-6 py-4">
                    <span className="text-xs font-bold" style={{ fontFamily: 'var(--font-mono)' }}>{payment.id}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-xs">
                      <Calendar size={12} className="text-muted-foreground" strokeWidth={2.5} />
                      <span className="font-medium">{payment.date}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-semibold text-sm text-foreground">{payment.content}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{payment.client}</td>
                  <td className="px-6 py-4 font-bold text-sm text-foreground" style={{ fontFamily: 'var(--font-mono)' }}>
                    {formatMoneyAmount(payment.amount)}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex px-2.5 py-1 rounded text-xs font-bold ${
                        payment.status === "завершено"
                          ? "bg-success/15 text-success border border-success/30"
                          : "bg-warning/15 text-warning border border-warning/30"
                      }`}
                    >
                      {payment.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Important Notice */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="rounded-lg bg-primary/10 border border-primary/30 p-5"
      >
        <div className="flex items-start gap-4">
          <div className="p-2.5 rounded bg-primary/20">
            <FileText className="text-primary" size={22} strokeWidth={2.5} />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold mb-2 text-foreground">Tax Information</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Все платежи include автоматическое удержание tax calculation based on your статус резидентства.
              Your current rate: <span className="font-bold text-foreground">20% (non-resident)</span>
            </p>
            <button className="text-sm font-bold text-primary hover:underline">
              Update Tax Certificate →
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
