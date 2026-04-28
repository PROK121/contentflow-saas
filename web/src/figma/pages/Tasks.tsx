"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "motion/react";
import Link from "next/link";
import {
  Plus,
  MoreVertical,
  Calendar,
  Flag,
  GripVertical,
  Trash2,
  ExternalLink,
  Pencil,
  Search,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  AlertCircle,
  Check,
  MessageCircle,
  Archive,
  ArchiveRestore,
  ShoppingCart,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { v1Fetch } from "@/lib/v1-client";
import { tr } from "@/lib/i18n";
import { isAdminDeleteEmail } from "@/lib/admin-delete-email";
import { getPlatformOwnerUserId } from "@/lib/platform-user";
import { Button } from "@/figma/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/figma/components/ui/dialog";
import { Label } from "@/figma/components/ui/label";
import { Input } from "@/figma/components/ui/input";
import { Textarea } from "@/figma/components/ui/textarea";
import { Checkbox } from "@/figma/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/figma/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/figma/components/ui/alert-dialog";
import { cn } from "@/figma/components/ui/utils";
import { StageBadge } from "@/components/StageBadge";
import type { DealStage } from "@/lib/types";
import {
  DONE_COLUMN_PREVIEW,
  STATUS_COLUMNS,
  TASK_PAGE_SIZE,
  priorityConfig,
  type TaskStatusId,
} from "./tasks/constants";
import type {
  ApiContract,
  ApiDeal,
  ApiTask,
  LinkKind,
  Manager,
  PurchaseDealTodoPin,
  TaskCommentRow,
  TaskFormState,
  TaskListResponse,
} from "./tasks/task-model";
import {
  assigneeInitials,
  buildLinkPayload,
  defaultTaskForm,
  dueDateToIso,
  isOverdue,
  managerLabel,
  sortTasksForColumn,
  taskToForm,
  validateLink,
} from "./tasks/task-model";

function ColumnDropZone({
  columnId,
  title,
  children,
}: {
  columnId: TaskStatusId;
  title: string;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId });
  return (
    <div
      ref={setNodeRef}
      role="region"
      aria-label={`Колонка «${title}». Перетащите сюда задачу, чтобы сменить статус.`}
      className={cn(
        "space-y-3 flex-1 min-h-[120px] rounded-lg transition-colors p-1 -m-1",
        isOver && "bg-primary/5 ring-2 ring-primary/30",
      )}
    >
      {children}
    </div>
  );
}

function TaskDragHandle({
  taskId,
  children,
}: {
  taskId: string;
  children: (props: {
    setActivatorNodeRef: (el: HTMLElement | null) => void;
    listeners: ReturnType<typeof useDraggable>["listeners"];
    attributes: ReturnType<typeof useDraggable>["attributes"];
  }) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } =
    useDraggable({ id: taskId });

  const style = transform
    ? { transform: CSS.Translate.toString(transform), zIndex: isDragging ? 50 : undefined }
    : undefined;

  return (
    <div ref={setNodeRef} style={style} className={cn("flex overflow-hidden rounded-lg", isDragging && "opacity-40")}>
      {children({ setActivatorNodeRef, listeners, attributes })}
    </div>
  );
}

function TaskCommentsPanel({ taskId }: { taskId: string }) {
  const [items, setItems] = useState<TaskCommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const rows = await v1Fetch<TaskCommentRow[]>(`/tasks/${taskId}/comments`);
      setItems(rows);
    } catch (e) {
      setErr(e instanceof Error ? e.message : tr("crm", "tasksCommentsLoadError"));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit() {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await v1Fetch(`/tasks/${taskId}/comments`, {
        method: "POST",
        body: JSON.stringify({ body: text }),
      });
      setDraft("");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : tr("crm", "tasksSendError"));
    } finally {
      setBusy(false);
    }
  }

  const taClass =
    "w-full rounded-md border border-border/50 bg-input-background px-3 py-2 text-sm focus:outline-none focus-visible:border-ring/80 focus-visible:ring-2 focus-visible:ring-ring/25 min-h-[80px]";

  return (
    <div className="space-y-3">
      {loading ? (
        <p className="text-xs text-muted-foreground">Загрузка комментариев…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Пока нет комментариев. Напишите первый.</p>
      ) : (
        <ul className="space-y-3 max-h-[240px] overflow-y-auto pr-1">
          {items.map((c) => (
            <li key={c.id} className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground mb-1">
                <span className="font-semibold text-foreground truncate">{managerLabel(c.author)}</span>
                <time dateTime={c.createdAt} className="shrink-0 tabular-nums">
                  {new Date(c.createdAt).toLocaleString("ru-RU", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </time>
              </div>
              <p className="whitespace-pre-wrap break-words text-foreground/90">{c.body}</p>
            </li>
          ))}
        </ul>
      )}
      <div className="space-y-2">
        <Label htmlFor={`task-comment-${taskId}`}>Новый комментарий</Label>
        <Textarea
          id={`task-comment-${taskId}`}
          className={taClass}
          rows={3}
          placeholder={tr("crm", "tasksCommentPlaceholder")}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={busy}
        />
        <Button type="button" size="sm" disabled={busy || !draft.trim()} onClick={() => void submit()}>
          {busy ? tr("crm", "tasksSending") : tr("crm", "tasksSend")}
        </Button>
      </div>
      {err ? <p className="text-xs text-destructive">{err}</p> : null}
    </div>
  );
}

type AssigneeFilter = "all" | "mine" | string;

export function Tasks() {
  const platformUserId = getPlatformOwnerUserId();
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const canAdminDelete = isAdminDeleteEmail(authEmail);
  const effectiveUserId = authUserId ?? platformUserId ?? null;

  const [tasks, setTasks] = useState<ApiTask[]>([]);
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  /** Сделки покупки (по владельцу) — только колонка «К выполнению», без переноса. */
  const [purchaseDealsTodo, setPurchaseDealsTodo] = useState<PurchaseDealTodoPin[]>([]);

  const [doneTotal, setDoneTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMoreDone, setLoadingMoreDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [metaErr, setMetaErr] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>("all");

  const [sortMode, setSortMode] = useState<"dueAt" | "priority">("dueAt");
  const [overdueFirst, setOverdueFirst] = useState(true);

  const [doneExpanded, setDoneExpanded] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [taskErrors, setTaskErrors] = useState<Record<string, string>>({});

  const [contractPicklistQ, setContractPicklistQ] = useState("");
  const [debouncedContractQ, setDebouncedContractQ] = useState("");
  const [dealsOptions, setDealsOptions] = useState<ApiDeal[]>([]);
  const [contractsOptions, setContractsOptions] = useState<ApiContract[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState<TaskFormState>(() => defaultTaskForm());
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);

  const [editTask, setEditTask] = useState<ApiTask | null>(null);
  const [editForm, setEditForm] = useState<TaskFormState>(() => defaultTaskForm());
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);

  const [commentTask, setCommentTask] = useState<ApiTask | null>(null);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteDealId, setDeleteDealId] = useState<string | null>(null);
  const [deleteDealBusy, setDeleteDealBusy] = useState(false);
  const [archiveDealBusyId, setArchiveDealBusyId] = useState<string | null>(null);

  const [archiveView, setArchiveView] = useState(false);
  const [archiveBusyId, setArchiveBusyId] = useState<string | null>(null);

  const [activeDragTask, setActiveDragTask] = useState<ApiTask | null>(null);

  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  function flashSaved() {
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    setSavedFlash(true);
    savedTimerRef.current = setTimeout(() => {
      setSavedFlash(false);
      savedTimerRef.current = null;
    }, 2200);
  }

  const buildListParams = useCallback(() => {
    const params = new URLSearchParams();
    if (archiveView) {
      params.set("archivedOnly", "true");
    }
    if (assigneeFilter === "mine" && effectiveUserId) {
      params.set("assigneeId", effectiveUserId);
    } else if (assigneeFilter !== "all" && assigneeFilter !== "mine") {
      params.set("assigneeId", assigneeFilter);
    }
    if (priorityFilter) params.set("priority", priorityFilter);
    if (overdueOnly && !archiveView) params.set("overdue", "true");
    if (debouncedSearch) params.set("q", debouncedSearch);
    return params;
  }, [
    archiveView,
    assigneeFilter,
    effectiveUserId,
    priorityFilter,
    overdueOnly,
    debouncedSearch,
  ]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedContractQ(contractPicklistQ.trim()), 300);
    return () => clearTimeout(t);
  }, [contractPicklistQ]);

  useEffect(() => {
    void v1Fetch<{ user: { id: string; email: string } }>("/auth/me")
      .then((r) => {
        setAuthUserId(r.user.id);
        setAuthEmail(r.user.email);
      })
      .catch(() => {
        setAuthUserId(null);
        setAuthEmail(null);
      });
  }, []);

  const loadMeta = useCallback(async () => {
    try {
      const m = await v1Fetch<Manager[]>("/users/managers");
      setManagers(m);
      setMetaErr(null);
    } catch (e) {
      setMetaErr(
        e instanceof Error ? e.message : tr("crm", "tasksAssigneesLoadError"),
      );
      setManagers([]);
    }
  }, []);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const base = buildListParams();
      const qs = base.toString();
      const prefix = qs ? `${qs}&` : "";

      const ownerForPurchasePins =
        !archiveView
          ? assigneeFilter === "all"
            ? null
            : assigneeFilter === "mine"
              ? effectiveUserId
              : assigneeFilter
          : null;

      const purchasePinsUrl = archiveView
        ? null
        : ownerForPurchasePins
          ? `/deals?kind=purchase&archived=false&ownerUserId=${encodeURIComponent(ownerForPurchasePins)}&limit=100`
          : `/deals?kind=purchase&archived=false&limit=100`;

      const [todoR, ipR, revR, doneR, purchaseDealsRes] = await Promise.all([
        v1Fetch<TaskListResponse>(`/tasks?${prefix}status=todo`),
        v1Fetch<TaskListResponse>(`/tasks?${prefix}status=in_progress`),
        v1Fetch<TaskListResponse>(`/tasks?${prefix}status=review`),
        v1Fetch<TaskListResponse>(`/tasks?${prefix}status=done&limit=${TASK_PAGE_SIZE}&skip=0`),
        purchasePinsUrl
          ? v1Fetch<PurchaseDealTodoPin[]>(purchasePinsUrl).catch(
              () => [] as PurchaseDealTodoPin[],
            )
          : Promise.resolve([] as PurchaseDealTodoPin[]),
      ]);

      setDoneTotal(doneR.total);
      setTasks([...todoR.items, ...ipR.items, ...revR.items, ...doneR.items]);
      setPurchaseDealsTodo(Array.isArray(purchaseDealsRes) ? purchaseDealsRes : []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : tr("crm", "tasksLoadError"));
      setTasks([]);
      setDoneTotal(0);
      setPurchaseDealsTodo([]);
    } finally {
      setLoading(false);
    }
  }, [buildListParams, archiveView, effectiveUserId, assigneeFilter]);

  const loadMoreDone = useCallback(async () => {
    if (archiveView) return;
    const skip = tasksRef.current.filter((t) => t.status === "done").length;
    if (skip >= doneTotal) return;

    setLoadingMoreDone(true);
    setErr(null);
    try {
      const base = buildListParams();
      const qs = base.toString();
      const prefix = qs ? `${qs}&` : "";
      const doneR = await v1Fetch<TaskListResponse>(
        `/tasks?${prefix}status=done&limit=${TASK_PAGE_SIZE}&skip=${skip}`,
      );
      setDoneTotal(doneR.total);
      setTasks((prev) => {
        const ids = new Set(prev.map((t) => t.id));
        const merged = [...prev];
        for (const it of doneR.items) {
          if (!ids.has(it.id)) merged.push(it);
        }
        return merged;
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : tr("crm", "tasksLoadDoneError"));
    } finally {
      setLoadingMoreDone(false);
    }
  }, [buildListParams, doneTotal, archiveView]);

  async function setTaskArchived(taskId: string, archived: boolean) {
    setArchiveBusyId(taskId);
    try {
      await v1Fetch(`/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ archived }),
      });
      await loadTasks();
      flashSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : tr("crm", "tasksArchiveUpdateError"));
    } finally {
      setArchiveBusyId(null);
    }
  }

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const picklistOpen = dialogOpen || !!editTask;

  useEffect(() => {
    if (!picklistOpen) return;
    const kind = dialogOpen ? createForm.linkKind : editForm.linkKind;
    if (kind !== "deal") return;
    let cancelled = false;
    void v1Fetch<ApiDeal[]>(`/deals?limit=80`).then((rows) => {
      if (!cancelled) setDealsOptions(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [picklistOpen, dialogOpen, createForm.linkKind, editForm.linkKind, editTask]);

  useEffect(() => {
    if (!picklistOpen) return;
    const kind = dialogOpen ? createForm.linkKind : editForm.linkKind;
    if (kind !== "contract") return;
    const path =
      debouncedContractQ.length >= 2
        ? `/contracts?q=${encodeURIComponent(debouncedContractQ)}&limit=80`
        : `/contracts?limit=60`;
    let cancelled = false;
    void v1Fetch<ApiContract[]>(path).then((rows) => {
      if (!cancelled) setContractsOptions(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [picklistOpen, dialogOpen, createForm.linkKind, editForm.linkKind, debouncedContractQ, editTask]);

  const fieldClass =
    "w-full rounded-md border border-border/50 bg-input-background px-3 py-2 text-sm focus:outline-none focus-visible:border-ring/80 focus-visible:ring-2 focus-visible:ring-ring/25";

  function openCreateDialog() {
    setCreateErr(null);
    setContractPicklistQ("");
    setCreateForm(defaultTaskForm("in_progress", effectiveUserId ?? ""));
    setDialogOpen(true);
  }

  function openEditDialog(task: ApiTask) {
    setEditErr(null);
    setContractPicklistQ("");
    setEditTask(task);
    setEditForm(taskToForm(task));
  }

  function openCommentsDialog(task: ApiTask) {
    setCommentTask(task);
  }

  async function submitCreate() {
    setCreateErr(null);
    if (!createForm.assigneeId.trim()) {
      setCreateErr(tr("crm", "tasksValidationAssignee"));
      return;
    }
    if (!createForm.title.trim()) {
      setCreateErr(tr("crm", "tasksValidationTitle"));
      return;
    }
    const linkErr = validateLink(createForm);
    if (linkErr) {
      setCreateErr(linkErr);
      return;
    }
    const { linkedEntityType, linkedEntityId } = buildLinkPayload(createForm);

    setCreateSubmitting(true);
    try {
      await v1Fetch("/tasks", {
        method: "POST",
        body: JSON.stringify({
          assigneeId: createForm.assigneeId.trim(),
          dueAt: dueDateToIso(createForm.dueAt),
          title: createForm.title.trim(),
          description: createForm.description.trim() || undefined,
          priority: createForm.priority,
          status: createForm.status,
          type: "custom",
          linkedEntityType,
          linkedEntityId,
        }),
      });
      setDialogOpen(false);
      await loadTasks();
    } catch (e) {
      const msg = e instanceof Error ? e.message : tr("crm", "tasksCreateError");
      setCreateErr(msg);
    } finally {
      setCreateSubmitting(false);
    }
  }

  async function submitEdit() {
    if (!editTask) return;
    setEditErr(null);
    if (!editForm.assigneeId.trim()) {
      setEditErr(tr("crm", "tasksValidationAssignee"));
      return;
    }
    if (!editForm.title.trim()) {
      setEditErr(tr("crm", "tasksValidationTitle"));
      return;
    }
    const linkErr = validateLink(editForm);
    if (linkErr) {
      setEditErr(linkErr);
      return;
    }
    const { linkedEntityType, linkedEntityId } = buildLinkPayload(editForm);

    setEditSubmitting(true);
    try {
      await v1Fetch(`/tasks/${editTask.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          assigneeId: editForm.assigneeId.trim(),
          dueAt: dueDateToIso(editForm.dueAt),
          title: editForm.title.trim(),
          description: editForm.description.trim() || undefined,
          priority: editForm.priority,
          status: editForm.status,
          linkedEntityType,
          linkedEntityId,
        }),
      });
      setEditTask(null);
      await loadTasks();
      flashSaved();
    } catch (e) {
      const msg = e instanceof Error ? e.message : tr("crm", "tasksSaveError");
      setEditErr(msg);
    } finally {
      setEditSubmitting(false);
    }
  }

  async function patchStatus(taskId: string, status: TaskStatusId) {
    const task = tasks.find((t) => t.id === taskId);
    if (task?.status === status) return;
    const prev = tasks;
    setTasks((t) => t.map((x) => (x.id === taskId ? { ...x, status } : x)));
    setTaskErrors((e) => {
      const n = { ...e };
      delete n[taskId];
      return n;
    });
    try {
      const updated = await v1Fetch<ApiTask>(`/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setTasks((t) => t.map((x) => (x.id === taskId ? updated : x)));
      setErr(null);
      flashSaved();

      if (status === "done" || task?.status === "done") {
        const base = buildListParams();
        const qs = base.toString();
        const prefix = qs ? `${qs}&` : "";
        const doneR = await v1Fetch<TaskListResponse>(`/tasks?${prefix}status=done&limit=${TASK_PAGE_SIZE}&skip=0`);
        setDoneTotal(doneR.total);
      }
    } catch (e) {
      setTasks(prev);
      const msg = e instanceof Error ? e.message : tr("crm", "tasksStatusChangeError");
      setTaskErrors((er) => ({ ...er, [taskId]: msg }));
    }
  }

  function onDragStart(ev: DragStartEvent) {
    const id = String(ev.active.id);
    setActiveDragTask(tasks.find((t) => t.id === id) ?? null);
  }

  function onDragEnd(ev: DragEndEvent) {
    setActiveDragTask(null);
    const { active, over } = ev;
    if (!over) return;
    const overId = over.id as string;
    if (!STATUS_COLUMNS.some((c) => c.id === overId)) return;
    const taskId = String(active.id);
    void patchStatus(taskId, overId as TaskStatusId);
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleteBusy(true);
    try {
      await v1Fetch(`/tasks/${deleteId}`, { method: "DELETE" });
      setDeleteId(null);
      await loadTasks();
    } catch (e) {
      const msg = e instanceof Error ? e.message : tr("crm", "tasksDeleteError");
      setErr(msg);
    } finally {
      setDeleteBusy(false);
    }
  }

  async function confirmDeleteDeal() {
    if (!deleteDealId) return;
    setDeleteDealBusy(true);
    try {
      await v1Fetch(`/deals/${deleteDealId}`, { method: "DELETE" });
      setDeleteDealId(null);
      await loadTasks();
    } catch (e) {
      const msg = e instanceof Error ? e.message : tr("crm", "tasksDeleteDealError");
      setErr(msg);
    } finally {
      setDeleteDealBusy(false);
    }
  }

  async function archivePurchaseDeal(dealId: string) {
    setArchiveDealBusyId(dealId);
    setErr(null);
    try {
      await v1Fetch(`/deals/${dealId}`, {
        method: "PATCH",
        body: JSON.stringify({ archived: true }),
      });
      await loadTasks();
    } catch (e) {
      setErr(e instanceof Error ? e.message : tr("crm", "tasksArchiveDealError"));
    } finally {
      setArchiveDealBusyId(null);
    }
  }

  const assigneeSelectValue =
    assigneeFilter === "all" ? "" : assigneeFilter === "mine" ? "mine" : assigneeFilter;

  const linkFields = (form: TaskFormState, setForm: Dispatch<SetStateAction<TaskFormState>>) => (
    <>
      <div className="space-y-1">
        <Label htmlFor="task-link">Привязка</Label>
        <select
          id="task-link"
          className={fieldClass}
          value={form.linkKind}
          onChange={(e) =>
            setForm((s) => ({
              ...s,
              linkKind: e.target.value as LinkKind,
              linkDealId: "",
              linkContractId: "",
            }))
          }
        >
          <option value="none">Без привязки</option>
          <option value="deal">Сделка</option>
          <option value="contract">Контракт</option>
        </select>
      </div>
      {form.linkKind === "deal" ? (
        <div className="space-y-1">
          <Label htmlFor="task-deal">Сделка</Label>
          <select
            id="task-deal"
            className={fieldClass}
            value={form.linkDealId}
            onChange={(e) => setForm((s) => ({ ...s, linkDealId: e.target.value }))}
          >
            <option value="">Выберите…</option>
            {dealsOptions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Показаны последние сделки (до 80 шт.).
          </p>
        </div>
      ) : null}
      {form.linkKind === "contract" ? (
        <div className="space-y-1">
          <Label htmlFor="task-contract-search">Поиск контракта</Label>
          <Input
            id="task-contract-search"
            placeholder={tr("crm", "tasksContractSearchPlaceholder")}
            value={contractPicklistQ}
            onChange={(e) => setContractPicklistQ(e.target.value)}
            className={fieldClass}
          />
          <Label htmlFor="task-contract">Контракт</Label>
          <select
            id="task-contract"
            className={fieldClass}
            value={form.linkContractId}
            onChange={(e) => setForm((s) => ({ ...s, linkContractId: e.target.value }))}
          >
            <option value="">Выберите…</option>
            {contractsOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.number} · {c.deal?.title ?? "—"}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </>
  );

  const formCoreFields = (
    form: TaskFormState,
    setForm: Dispatch<SetStateAction<TaskFormState>>,
    idPrefix: string,
  ) => (
    <>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-assignee`}>Исполнитель</Label>
        <select
          id={`${idPrefix}-assignee`}
          className={fieldClass}
          value={form.assigneeId}
          onChange={(e) => setForm((s) => ({ ...s, assigneeId: e.target.value }))}
        >
          <option value="">Выберите…</option>
          {managers.map((m) => (
            <option key={m.id} value={m.id}>
              {managerLabel(m)}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-due`}>Срок исполнения</Label>
        <Input
          id={`${idPrefix}-due`}
          type="date"
          value={form.dueAt}
          onChange={(e) => setForm((s) => ({ ...s, dueAt: e.target.value }))}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-title`}>Название</Label>
        <Input
          id={`${idPrefix}-title`}
          value={form.title}
          onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
          placeholder={tr("crm", "tasksTitlePlaceholder")}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-desc`}>Описание (необязательно)</Label>
        <Textarea
          id={`${idPrefix}-desc`}
          className={fieldClass}
          rows={3}
          value={form.description}
          onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-priority`}>Приоритет</Label>
          <select
            id={`${idPrefix}-priority`}
            className={fieldClass}
            value={form.priority}
            onChange={(e) =>
              setForm((s) => ({
                ...s,
                priority: e.target.value as TaskFormState["priority"],
              }))
            }
          >
            <option value="low">Низкий</option>
            <option value="medium">Средний</option>
            <option value="high">Высокий</option>
          </select>
        </div>
        {idPrefix === "create" ? (
          <div className="flex flex-col justify-end pb-0.5">
            <p className="text-xs text-muted-foreground leading-snug">
              Задача сразу попадает в колонку «В работе».
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-status`}>Колонка</Label>
            <select
              id={`${idPrefix}-status`}
              className={fieldClass}
              value={form.status}
              onChange={(e) =>
                setForm((s) => ({
                  ...s,
                  status: e.target.value as TaskStatusId,
                }))
              }
            >
              {STATUS_COLUMNS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </>
  );

  const doneLoaded = tasks.filter((t) => t.status === "done").length;
  const doneHasMore = doneLoaded < doneTotal;

  return (
    <div className="space-y-6">
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить задачу навсегда?</AlertDialogTitle>
            <AlertDialogDescription>
              Доступно только для задач в архиве и только администратору. Действие необратимо.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteBusy}
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteDealId} onOpenChange={(o) => !o && setDeleteDealId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить сделку навсегда?</AlertDialogTitle>
            <AlertDialogDescription>
              Доступно только администратору. Связанные данные могут быть затронуты. Действие необратимо.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteDealBusy}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteDealBusy}
              onClick={(e) => {
                e.preventDefault();
                void confirmDeleteDeal();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[min(90vh,680px)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Новая задача</DialogTitle>
            <DialogDescription>
              Назначьте исполнителя и срок. Можно привязать к сделке или контракту.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {formCoreFields(createForm, setCreateForm, "create")}
            {linkFields(createForm, setCreateForm)}
          </div>
          {createErr ? <p className="text-sm text-destructive">{createErr}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Отмена
            </Button>
            <Button type="button" disabled={createSubmitting} onClick={() => void submitCreate()}>
              {createSubmitting ? tr("crm", "tasksCreating") : tr("crm", "tasksCreate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!commentTask}
        onOpenChange={(o) => {
          if (!o) setCommentTask(null);
        }}
      >
        <DialogContent className="max-h-[min(90vh,560px)] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Комментарии к задаче</DialogTitle>
            <DialogDescription className="line-clamp-2">
              {commentTask?.title?.trim()
                ? commentTask.title
                : tr("crm", "tasksUntitled")}
            </DialogDescription>
          </DialogHeader>
          {commentTask ? <TaskCommentsPanel taskId={commentTask.id} /> : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editTask}
        onOpenChange={(o) => {
          if (!o) setEditTask(null);
        }}
      >
        <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Редактировать задачу</DialogTitle>
            <DialogDescription>Измените исполнителя, срок, текст или привязку.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {formCoreFields(editForm, setEditForm, "edit")}
            {linkFields(editForm, setEditForm)}
          </div>
          {editErr ? <p className="text-sm text-destructive">{editErr}</p> : null}
          {editTask ? (
            <div className="border-t border-border pt-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Комментарии</h3>
              <p className="text-xs text-muted-foreground">
                Видны всем пользователям. Обсуждайте ход работы без смены полей задачи.
              </p>
              <TaskCommentsPanel taskId={editTask.id} />
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditTask(null)}>
              Отмена
            </Button>
            <Button type="button" disabled={editSubmitting} onClick={() => void submitEdit()}>
              {editSubmitting ? tr("crm", "tasksSaving") : tr("crm", "tasksSave")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">
            {tr("crm", "tasksTitle")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {tr("crm", "tasksSubtitle")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 justify-end">
          {savedFlash ? (
            <span
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground tabular-nums"
              aria-live="polite"
            >
              <Check className="h-3.5 w-3.5 text-success" strokeWidth={2.5} />
              {tr("crm", "tasksSaved")}
            </span>
          ) : null}
          <div className="flex flex-wrap gap-2 items-center">
            <label className="flex items-center gap-2 text-sm mr-1">
              <Checkbox
                checked={archiveView}
                onCheckedChange={(v) => setArchiveView(v === true)}
              />
              {tr("crm", "tasksArchive")}
            </label>
            <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => void loadTasks()}>
              {tr("crm", "tasksRefresh")}
            </Button>
            <Button
              type="button"
              size="sm"
              className="gap-2"
              disabled={archiveView}
              onClick={() => openCreateDialog()}
            >
              <Plus size={18} strokeWidth={2.5} />
              {tr("crm", "tasksNew")}
            </Button>
          </div>
        </div>
      </motion.div>

      {metaErr ? (
        <div
          className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
          role="alert"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
          <span className="text-destructive flex-1">{metaErr}</span>
          <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => void loadMeta()}>
            <RefreshCw size={14} />
            {tr("crm", "tasksRetry")}
          </Button>
        </div>
      ) : null}

      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <div className="space-y-1 min-w-0 max-w-xl">
          <Label htmlFor="task-search">{tr("crm", "tasksSearch")}</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="task-search"
              className={cn(fieldClass, "pl-9")}
              placeholder={tr("crm", "tasksSearchPlaceholder")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="space-y-1 min-w-[200px] max-w-md flex-1">
            <Label htmlFor="task-assignee-filter">{tr("crm", "tasksAssignee")}</Label>
            <select
              id="task-assignee-filter"
              className={fieldClass}
              value={assigneeSelectValue}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) setAssigneeFilter("all");
                else if (v === "mine") setAssigneeFilter("mine");
                else setAssigneeFilter(v);
              }}
            >
              <option value="">{tr("crm", "tasksAllAssignees")}</option>
              {effectiveUserId ? (
                <option value="mine">{tr("crm", "tasksMineOnly")}</option>
              ) : null}
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {managerLabel(m)}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={overdueOnly} onCheckedChange={(v) => setOverdueOnly(v === true)} />
            {tr("crm", "tasksOverdueOnly")}
          </label>
          <label className="flex items-center gap-2 text-sm border-l border-border pl-3 sm:ml-1">
            <Checkbox checked={doneExpanded} onCheckedChange={(v) => setDoneExpanded(v === true)} />
            {tr("crm", "tasksShowAllDone")}
          </label>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {tr("crm", "tasksSort")}
            </span>
            <select
              className={cn(fieldClass, "w-auto min-w-[160px]")}
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as "dueAt" | "priority")}
            >
              <option value="dueAt">{tr("crm", "tasksSortByDue")}</option>
              <option value="priority">{tr("crm", "tasksSortByPriority")}</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={overdueFirst} onCheckedChange={(v) => setOverdueFirst(v === true)} />
            {tr("crm", "tasksOverdueFirst")}
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPriorityFilter(null)}
            className={`px-4 py-2 rounded font-semibold transition-all text-sm ${
              priorityFilter === null
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/50 border border-border hover:bg-muted/30"
            }`}
          >
            {tr("crm", "tasksAllPriorities")}
          </button>
          {(["high", "medium", "low"] as const).map((priority) => {
            const config = priorityConfig[priority];
            return (
              <button
                key={priority}
                type="button"
                onClick={() => setPriorityFilter(priority)}
                className={`px-4 py-2 rounded font-semibold transition-all text-sm ${
                  priorityFilter === priority
                    ? config.color
                    : "bg-muted/50 border border-border hover:bg-muted/30"
                }`}
              >
                {config.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          {archiveView
            ? tr("crm", "tasksArchiveHint")
            : `Фильтры и поиск на сервере. Колонка «Выполнено» подгружается порциями по ${TASK_PAGE_SIZE}: кнопка «Загрузить ещё» внизу колонки. По умолчанию в колонке видно до ${DONE_COLUMN_PREVIEW} карточек — включите «Показать все выполненные», чтобы развернуть список.`}
        </p>
      </div>

      {err ? <p className="text-sm text-destructive whitespace-pre-wrap">{err}</p> : null}

      {loading && tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">{tr("crm", "paymentsLoading")}</p>
      ) : archiveView ? (
        <div className="space-y-3">
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">{tr("crm", "tasksInArchive")}</p>
          ) : null}
          {tasks.map((task) => {
            const priority =
              priorityConfig[task.priority as keyof typeof priorityConfig] ??
              priorityConfig.medium;
            return (
              <div
                key={task.id}
                className="rounded-lg bg-card border border-border p-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3"
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <h4 className="font-semibold text-sm">
                    {task.title ?? tr("crm", "tasksUntitled")}
                  </h4>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="px-2 py-0.5 rounded bg-muted border border-border">
                      {STATUS_COLUMNS.find((c) => c.id === task.status)?.title ?? task.status}
                    </span>
                    <span className={cn("px-2 py-0.5 rounded font-bold", priority.color)}>
                      {priority.label}
                    </span>
                    <span className="tabular-nums">
                      {new Date(task.dueAt).toLocaleDateString("ru-RU")}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={archiveBusyId === task.id}
                    onClick={() => void setTaskArchived(task.id, false)}
                  >
                    <ArchiveRestore className="size-3.5 mr-1" />
                    {archiveBusyId === task.id
                      ? "…"
                      : tr("crm", "tasksRestoreToWork")}
                  </Button>
                  {canAdminDelete ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => setDeleteId(task.id)}
                    >
                      <Trash2 className="size-3.5 mr-1" />
                      Удалить
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          <div className="overflow-x-auto pb-2 -mx-4 px-4 md:-mx-6 md:px-6 lg:mx-0 lg:px-0">
            <div className="flex gap-5 min-w-min lg:min-w-0 lg:grid lg:grid-cols-2 xl:grid-cols-4 lg:gap-5">
              {STATUS_COLUMNS.map((column, columnIndex) => {
                const Icon = column.icon;
                const columnTasks = sortTasksForColumn(
                  tasks.filter((t) => t.status === column.id),
                  sortMode,
                  overdueFirst,
                );
                const isDoneCol = column.id === "done";
                const truncated =
                  isDoneCol && !doneExpanded && columnTasks.length > DONE_COLUMN_PREVIEW;
                const visibleTasks = truncated
                  ? columnTasks.slice(0, DONE_COLUMN_PREVIEW)
                  : columnTasks;
                const hiddenDone = truncated ? columnTasks.length - DONE_COLUMN_PREVIEW : 0;

                let pinRows: PurchaseDealTodoPin[] = [];
                if (column.id === "todo" && !archiveView && !overdueOnly && !priorityFilter) {
                  pinRows = [...purchaseDealsTodo];
                  if (debouncedSearch.trim()) {
                    const q = debouncedSearch.toLowerCase();
                    pinRows = pinRows.filter(
                      (d) =>
                        d.title.toLowerCase().includes(q) ||
                        (d.buyer?.legalName?.toLowerCase().includes(q) ?? false),
                    );
                  }
                  pinRows.sort(
                    (a, b) =>
                      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
                  );
                }

                const headerCount =
                  column.id === "todo"
                    ? pinRows.length + columnTasks.length
                    : isDoneCol
                      ? doneTotal
                      : columnTasks.length;

                const columnBodyEmpty =
                  pinRows.length === 0 && visibleTasks.length === 0 && !loading;

                return (
                  <motion.div
                    key={column.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: columnIndex * 0.1 }}
                    className="flex flex-col w-[min(100vw-2rem,320px)] shrink-0 lg:w-auto lg:min-w-0 lg:shrink"
                  >
                    <div
                      className={`rounded-lg ${column.color} border ${column.borderColor} p-4 mb-3 bg-card shadow-sm`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="p-2 rounded bg-primary text-primary-foreground shrink-0">
                            <Icon size={16} strokeWidth={2.5} />
                          </div>
                          <h3 className="font-bold text-foreground text-sm uppercase tracking-wide truncate">
                            {column.title}
                          </h3>
                        </div>
                        <span className="px-2.5 py-1 rounded bg-card border border-border text-xs font-bold text-foreground shrink-0">
                          {headerCount}
                        </span>
                      </div>
                      {isDoneCol && columnTasks.length > DONE_COLUMN_PREVIEW ? (
                        <button
                          type="button"
                          className="mt-2 flex w-full items-center justify-center gap-1 text-xs font-semibold text-primary hover:underline"
                          onClick={() => setDoneExpanded((e) => !e)}
                        >
                          {doneExpanded ? (
                            <>
                              <ChevronUp size={14} />
                              Свернуть список
                            </>
                          ) : (
                            <>
                              <ChevronDown size={14} />
                              {`Показать все (${columnTasks.length} загружено)`}
                            </>
                          )}
                        </button>
                      ) : null}
                    </div>

                    <ColumnDropZone columnId={column.id} title={column.title}>
                      {columnBodyEmpty ? (
                        <div className="rounded-lg border border-dashed border-border bg-muted/10 px-4 py-6 text-center space-y-3">
                      <p className="text-sm text-muted-foreground">{tr("crm", "tasksNoTasks")}</p>
                          <Button type="button" size="sm" variant="secondary" onClick={() => openCreateDialog()}>
                            {tr("crm", "tasksAdd")}
                          </Button>
                        </div>
                      ) : null}

                      {pinRows.map((deal, pinIndex) => (
                        <motion.div
                          key={`purchase-deal-${deal.id}`}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: columnIndex * 0.1 + pinIndex * 0.05 }}
                          className="group rounded-lg bg-card border border-border border-l-4 border-l-warning/70 hover:shadow-md transition-all duration-200 flex overflow-hidden w-full"
                        >
                          <div
                            className="shrink-0 px-2 py-4 bg-warning/10 border-r border-border flex items-start justify-center"
                            title={tr("crm", "tasksDealPinNoDrag")}
                          >
                            <ShoppingCart size={18} className="text-warning" strokeWidth={2.25} />
                          </div>
                          <div className="flex-1 min-w-0 p-4">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1 space-y-2">
                                <h4 className="font-semibold text-foreground leading-snug text-sm">
                                  {deal.title}
                                </h4>
                                <div className="flex flex-wrap gap-1.5 items-center">
                                  <span className="px-2 py-1 rounded bg-muted/80 text-xs font-medium border border-border">
                                    Покупка
                                  </span>
                                  <StageBadge stage={deal.stage as DealStage} />
                                </div>
                                {deal.buyer?.legalName ? (
                                  <p className="text-xs text-muted-foreground truncate" title={deal.buyer.legalName}>
                                    Контрагент: {deal.buyer.legalName}
                                  </p>
                                ) : null}
                                {deal.expectedCloseAt ? (
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                                    <Calendar size={12} strokeWidth={2.5} />
                                    <span className="font-semibold">
                                      Ожидаемое закрытие:{" "}
                                      {new Date(deal.expectedCloseAt).toLocaleDateString("ru-RU")}
                                    </span>
                                  </div>
                                ) : null}
                                <div className="pt-2">
                                  <Link
                                    href={`/deals/${deal.id}`}
                                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                                  >
                                    <ExternalLink size={12} />
                                    Открыть сделку
                                  </Link>
                                </div>
                              </div>
                              {canAdminDelete ? (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      type="button"
                                      className="p-1 hover:bg-muted/50 rounded transition-colors shrink-0"
                                      aria-label={tr("crm", "tasksDealActions")}
                                    >
                                      <MoreVertical size={14} className="text-muted-foreground" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem asChild>
                                      <Link href={`/deals/${deal.id}`}>Открыть сделку</Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      disabled={archiveDealBusyId === deal.id}
                                      onClick={() => void archivePurchaseDeal(deal.id)}
                                    >
                                      <Archive size={14} className="mr-2" />
                                      {archiveDealBusyId === deal.id
                                        ? "…"
                                        : tr("crm", "offersToArchive")}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onClick={() => setDeleteDealId(deal.id)}
                                    >
                                      <Trash2 size={14} className="mr-2" />
                                      Удалить навсегда
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              ) : null}
                            </div>
                          </div>
                        </motion.div>
                      ))}

                      {visibleTasks.map((task, taskIndex) => {
                        const priority =
                          priorityConfig[task.priority as keyof typeof priorityConfig] ??
                          priorityConfig.medium;
                        const overdue = isOverdue(task);
                        const rowErr = taskErrors[task.id];

                        return (
                          <TaskDragHandle key={task.id} taskId={task.id}>
                            {({ setActivatorNodeRef, listeners, attributes }) => (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{
                                  delay: columnIndex * 0.1 + (pinRows.length + taskIndex) * 0.05,
                                }}
                                className="group rounded-lg bg-card border border-border hover:shadow-md transition-all duration-200 flex overflow-hidden w-full"
                              >
                                <button
                                  type="button"
                                  ref={setActivatorNodeRef}
                                  title={tr("crm", "tasksDragToColumn")}
                                  className="shrink-0 px-1.5 py-4 text-muted-foreground hover:bg-muted cursor-grab active:cursor-grabbing border-r border-border touch-none"
                                  {...listeners}
                                  {...attributes}
                                >
                                  <GripVertical size={16} />
                                </button>
                                <div className="flex-1 min-w-0 p-4">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1 space-y-2">
                                      <h4 className="font-semibold text-foreground leading-snug text-sm">
                                        {task.title ?? tr("crm", "tasksUntitled")}
                                      </h4>
                                      {task.description ? (
                                        <p className="text-xs text-muted-foreground line-clamp-3">
                                          {task.description}
                                        </p>
                                      ) : null}
                                      {rowErr ? (
                                        <p className="text-xs text-destructive font-medium whitespace-pre-wrap">
                                          {rowErr}
                                        </p>
                                      ) : null}
                                      {task.linkedEntityType !== "none" ? (
                                        <div className="flex flex-col gap-1">
                                          <div className="flex flex-wrap gap-1.5">
                                            <span className="px-2 py-1 rounded bg-muted/80 text-xs font-medium border border-border">
                                              {task.linkedEntityType === "deal"
                                                ? tr("crm", "tasksLinkDeal")
                                                : task.linkedEntityType === "contract"
                                                  ? tr("crm", "tasksLinkContract")
                                                  : task.linkedEntityType}
                                            </span>
                                          </div>
                                          {task.linkedLabel ? (
                                            <p className="text-xs font-semibold text-foreground truncate" title={task.linkedLabel}>
                                              {task.linkedLabel}
                                            </p>
                                          ) : null}
                                        </div>
                                      ) : null}
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <Flag size={12} className="text-muted-foreground" strokeWidth={2.5} />
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${priority.color}`}>
                                          {priority.label}
                                        </span>
                                        {overdue ? (
                                          <span className="text-[10px] font-bold text-destructive uppercase">
                                            Просрочено
                                          </span>
                                        ) : null}
                                      </div>
                                      <div className="flex items-center justify-between pt-2 border-t border-border gap-2 flex-wrap">
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                          <Calendar size={12} strokeWidth={2.5} />
                                          <span className="font-semibold">
                                            {new Date(task.dueAt).toLocaleDateString("ru-RU")}
                                          </span>
                                        </div>
                                        {task.primaryPath ? (
                                          <Link
                                            href={task.primaryPath}
                                            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                                          >
                                            <ExternalLink size={12} />
                                            {tr("crm", "tasksObject")}
                                          </Link>
                                        ) : null}
                                      </div>
                                      <div className="flex items-center gap-2 pt-2">
                                        <div className="w-7 h-7 rounded bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground shadow-sm">
                                          {assigneeInitials(task.assignee)}
                                        </div>
                                        <span className="text-xs font-semibold text-muted-foreground truncate">
                                          {managerLabel(task.assignee)}
                                        </span>
                                      </div>
                                    </div>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <button
                                          type="button"
                                          className="p-1 hover:bg-muted/50 rounded transition-colors shrink-0"
                                          aria-label={tr("crm", "tasksActions")}
                                        >
                                          <MoreVertical size={14} className="text-muted-foreground" />
                                        </button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => openEditDialog(task)}>
                                          <Pencil size={14} className="mr-2" />
                                          Редактировать
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => openCommentsDialog(task)}>
                                          <MessageCircle size={14} className="mr-2" />
                                          Комментарии
                                        </DropdownMenuItem>
                                        {task.primaryPath ? (
                                          <DropdownMenuItem asChild>
                                            <Link href={task.primaryPath}>Открыть объект</Link>
                                          </DropdownMenuItem>
                                        ) : null}
                                        <DropdownMenuSeparator />
                                        {STATUS_COLUMNS.filter((c) => c.id !== task.status).map((c) => (
                                          <DropdownMenuItem
                                            key={c.id}
                                            onClick={() => void patchStatus(task.id, c.id)}
                                          >
                                            {c.title}
                                          </DropdownMenuItem>
                                        ))}
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          onClick={() => void setTaskArchived(task.id, true)}
                                        >
                                          <Archive size={14} className="mr-2" />
                                          В архив
                                        </DropdownMenuItem>
                                        {canAdminDelete && task.archived ? (
                                          <>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                              className="text-destructive focus:text-destructive"
                                              onClick={() => setDeleteId(task.id)}
                                            >
                                              <Trash2 size={14} className="mr-2" />
                                              Удалить навсегда
                                            </DropdownMenuItem>
                                          </>
                                        ) : null}
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </TaskDragHandle>
                        );
                      })}

                      {hiddenDone > 0 && !doneExpanded ? (
                        <p className="text-center text-xs text-muted-foreground py-1">
                          Ещё {hiddenDone}{" "}
                          {hiddenDone === 1
                            ? tr("crm", "tasksOne")
                            : tr("crm", "tasksMany")}{" "}
                          — нажмите «Показать все» выше
                        </p>
                      ) : null}

                      {isDoneCol && doneHasMore ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full"
                          disabled={loadingMoreDone}
                          onClick={() => void loadMoreDone()}
                        >
                          {loadingMoreDone
                            ? tr("crm", "paymentsLoading")
                            : `${tr("crm", "tasksLoadMore")} (${doneLoaded} из ${doneTotal})`}
                        </Button>
                      ) : null}

                      {pinRows.length > 0 || visibleTasks.length > 0 || loading ? (
                        <button
                          type="button"
                          className="w-full p-3 rounded-lg border-2 border-dashed border-border hover:border-primary/30 hover:bg-muted/20 transition-all text-muted-foreground hover:text-primary font-semibold flex items-center justify-center gap-2 text-sm"
                          onClick={() => openCreateDialog()}
                        >
                          <Plus size={16} strokeWidth={2.5} />
                          {tr("crm", "tasksAddTask")}
                        </button>
                      ) : null}
                    </ColumnDropZone>
                  </motion.div>
                );
              })}
            </div>
          </div>
          <DragOverlay dropAnimation={null}>
            {activeDragTask ? (
              <div className="max-w-[280px] rounded-lg border-2 border-primary bg-card p-3 shadow-xl">
                <p className="text-sm font-semibold line-clamp-2">
                  {activeDragTask.title ?? tr("crm", "tasksUntitled")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {managerLabel(activeDragTask.assignee)}
                </p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
