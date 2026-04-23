import { priorityConfig, type TaskStatusId } from "./constants";

const PRI_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

export type ApiTask = {
  id: string;
  assigneeId: string;
  dueAt: string;
  status: string;
  priority: string;
  linkedEntityType: string;
  linkedEntityId: string;
  title: string | null;
  description: string | null;
  archived?: boolean;
  updatedAt?: string;
  primaryPath: string | null;
  linkedLabel: string | null;
  assignee: { id: string; email: string; displayName: string | null };
};

export type TaskListResponse = { items: ApiTask[]; total: number };

export type Manager = { id: string; email: string; displayName: string | null };

export type TaskCommentRow = {
  id: string;
  taskId: string;
  authorId: string;
  body: string;
  createdAt: string;
  author: { id: string; email: string; displayName: string | null };
};

export type ApiDeal = { id: string; title: string };

/** Сделка покупки в колонке «К выполнению» на доске задач. */
export type PurchaseDealTodoPin = {
  id: string;
  title: string;
  stage: string;
  kind: string;
  updatedAt: string;
  expectedCloseAt?: string | null;
  buyer?: { legalName: string };
  ownerUserId: string;
};

export type ApiContract = {
  id: string;
  number: string;
  deal: { id: string; title: string };
};

export type LinkKind = "none" | "deal" | "contract";

export type TaskFormState = {
  assigneeId: string;
  dueAt: string;
  title: string;
  description: string;
  priority: keyof typeof priorityConfig;
  status: TaskStatusId;
  linkKind: LinkKind;
  linkDealId: string;
  linkContractId: string;
};

export function isOverdue(t: ApiTask): boolean {
  if (t.status === "done") return false;
  return new Date(t.dueAt).getTime() < Date.now();
}

export function sortTasksForColumn(
  list: ApiTask[],
  mode: "dueAt" | "priority",
  overdueFirst: boolean,
): ApiTask[] {
  const copy = [...list];
  copy.sort((a, b) => {
    if (overdueFirst) {
      const ao = isOverdue(a) ? 0 : 1;
      const bo = isOverdue(b) ? 0 : 1;
      if (ao !== bo) return ao - bo;
    }
    if (mode === "priority") {
      const pa = PRI_ORDER[a.priority] ?? 9;
      const pb = PRI_ORDER[b.priority] ?? 9;
      if (pa !== pb) return pa - pb;
    }
    return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
  });
  return copy;
}

export function managerLabel(m: Pick<Manager, "displayName" | "email">): string {
  const n = m.displayName?.trim();
  if (n) return n;
  return m.email;
}

export function assigneeInitials(a: Pick<ApiTask["assignee"], "displayName" | "email">): string {
  const label = managerLabel(a);
  if (label.includes("@")) {
    return label.slice(0, 2).toUpperCase();
  }
  const parts = label.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  if (parts.length === 1 && parts[0].length >= 2) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return label.slice(0, 2).toUpperCase();
}

export function dueDateToIso(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map((x) => Number.parseInt(x, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    throw new Error("Некорректная дата");
  }
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).toISOString();
}

export function buildLinkPayload(form: TaskFormState): { linkedEntityType: string; linkedEntityId: string } {
  if (form.linkKind === "deal") {
    return { linkedEntityType: "deal", linkedEntityId: form.linkDealId.trim() };
  }
  if (form.linkKind === "contract") {
    return { linkedEntityType: "contract", linkedEntityId: form.linkContractId.trim() };
  }
  return { linkedEntityType: "none", linkedEntityId: "none" };
}

export function validateLink(form: TaskFormState): string | null {
  if (form.linkKind === "deal" && !form.linkDealId.trim()) {
    return "Выберите сделку";
  }
  if (form.linkKind === "contract" && !form.linkContractId.trim()) {
    return "Выберите контракт";
  }
  return null;
}

export function defaultTaskForm(status: TaskStatusId = "in_progress", defaultAssigneeId = ""): TaskFormState {
  const today = new Date();
  const week = new Date(today.getTime() + 7 * 86400000);
  return {
    assigneeId: defaultAssigneeId,
    dueAt: week.toISOString().slice(0, 10),
    title: "",
    description: "",
    priority: "medium",
    status,
    linkKind: "none",
    linkDealId: "",
    linkContractId: "",
  };
}

export function taskToForm(task: ApiTask): TaskFormState {
  let linkKind: LinkKind = "none";
  let linkDealId = "";
  let linkContractId = "";
  if (task.linkedEntityType === "deal") {
    linkKind = "deal";
    linkDealId = task.linkedEntityId;
  } else if (task.linkedEntityType === "contract") {
    linkKind = "contract";
    linkContractId = task.linkedEntityId;
  }
  const pr = task.priority as keyof typeof priorityConfig;
  return {
    assigneeId: task.assigneeId,
    dueAt: task.dueAt.slice(0, 10),
    title: task.title ?? "",
    description: task.description ?? "",
    priority: pr in priorityConfig ? pr : "medium",
    status: task.status as TaskStatusId,
    linkKind,
    linkDealId,
    linkContractId,
  };
}
