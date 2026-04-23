import { Clock, CheckCircle2, Flag } from "lucide-react";

export const STATUS_COLUMNS = [
  {
    id: "todo" as const,
    title: "К выполнению",
    color: "bg-info/15",
    borderColor: "border-info/30",
    icon: Clock,
  },
  {
    id: "in_progress" as const,
    title: "В работе",
    color: "bg-warning/15",
    borderColor: "border-warning/30",
    icon: CheckCircle2,
  },
  {
    id: "review" as const,
    title: "На проверке",
    color: "bg-primary/15",
    borderColor: "border-primary/30",
    icon: Flag,
  },
  {
    id: "done" as const,
    title: "Выполнено",
    color: "bg-success/15",
    borderColor: "border-success/30",
    icon: CheckCircle2,
  },
];

export type TaskStatusId = (typeof STATUS_COLUMNS)[number]["id"];

export const DONE_COLUMN_PREVIEW = 8;

export const TASK_PAGE_SIZE = 80;

export const priorityConfig = {
  high: { label: "Высокий", color: "bg-destructive/15 text-destructive border border-destructive/30" },
  medium: { label: "Средний", color: "bg-warning/15 text-warning border border-warning/30" },
  low: { label: "Низкий", color: "bg-info/15 text-info border border-info/30" },
} as const;
