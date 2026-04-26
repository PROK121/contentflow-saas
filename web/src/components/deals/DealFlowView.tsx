"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Accordion,
} from "@/figma/components/ui/accordion";
import { Button } from "@/figma/components/ui/button";
import { Input } from "@/figma/components/ui/input";
import { Label } from "@/figma/components/ui/label";
import {
  v1ApiPath,
  v1DownloadFile,
  v1Fetch,
  v1FormUpload,
} from "@/lib/v1-client";
import { DEAL_DOCUMENT_GROUPS } from "@/lib/deal-document-slots";
import {
  formatMoneyAmount,
  formatMoneyAmountOrEmpty,
  moneyValuesEqual,
  normalizeMoneyInput,
} from "@/lib/format-money";
import { DEMO_OWNER_USER_ID } from "@/lib/demo-ids";
import { DealCatalogRightsCard } from "./DealCatalogRightsCard";
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
import { Checkbox } from "@/figma/components/ui/checkbox";

const NO_GREEN_FOCUS_CLASS = "focus-visible:ring-0 focus-visible:border-border/50";

type DealDocumentSlotMeta = {
  storedFileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
};

type DealDetail = {
  id: string;
  title: string;
  kind?: string;
  stage: string;
  archived?: boolean;
  currency: string;
  commercialSnapshot: (Record<string, unknown> & { driveFolders?: Record<string, string> }) | null;
  dealDocuments?: Record<string, DealDocumentSlotMeta> | null;
  buyer: { legalName: string; country: string; isResident: boolean };
  owner: { email: string };
  catalogItems: {
    catalogItemId: string;
    rightsSelection: unknown;
    catalogItem: {
      title: string;
      licenseTerms: { territoryCode: string }[];
    };
  }[];
  activities: {
    id: string;
    kind: string;
    message: string;
    metadata?: Record<string, unknown> | null;
    createdAt: string;
    user?: { email: string } | null;
  }[];
  contracts: {
    id: string;
    number: string;
    status: string;
    amount: string;
    currency: string;
    templateId: string | null;
    dealSnapshotFingerprint: string | null;
    archived?: boolean;
    versions?: { version: number }[];
  }[];
  payments: {
    id: string;
    direction?: string;
    amount: string;
    currency: string;
    status: string;
    paidAt: string | null;
    dueAt: string | null;
    withholdingTaxAmount?: string | null;
    netAmount?: string | null;
  }[];
};

type PaymentPreview = {
  gross: string;
  taxRate: string;
  taxPercentLabel: string;
  withholdingTaxAmount: string;
  net: string;
  vatIncluded: boolean;
  projectAdministrationEnabled: boolean;
  projectAdministrationDeduction: string;
  currency: string;
  buyerIsResident: boolean;
  taxNote: string;
  paidSum: string;
  partialPaymentHint: boolean;
  fxNote: string | null;
};

const stageLabels: Record<string, string> = {
  lead: "Лид",
  negotiation: "Переговоры",
  contract: "Контракт",
  paid: "Оплачено",
};

const dealKindLabels: Record<string, string> = {
  sale: "Продажа",
  purchase: "Покупка",
};

const CONTRACT_STATUS_LABELS: Record<string, string> = {
  draft: "Черновик",
  sent: "Отправлен",
  signed: "Подписан",
  expired: "Неактуален",
};

function formatFileSize(bytes: unknown): string {
  const n = typeof bytes === "number" ? bytes : Number(bytes);
  if (!Number.isFinite(n) || n < 0) return "";
  if (n < 1024) return `${n} Б`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} КБ`;
  return `${(n / (1024 * 1024)).toFixed(1)} МБ`;
}

function DealDocumentSlotRow({
  dealId,
  slot,
  label,
  meta,
  onUpdated,
  onError,
}: {
  dealId: string;
  slot: string;
  label: string;
  meta?: DealDocumentSlotMeta | null;
  onUpdated: () => void | Promise<void>;
  onError: (msg: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<File | null>(null);
  const [resetKey, setResetKey] = useState(0);

  async function upload() {
    if (!pending) return;
    setBusy(true);
    onError(null);
    try {
      const fd = new FormData();
      fd.append("file", pending);
      await v1FormUpload(`/deals/${dealId}/documents/${slot}`, fd);
      setPending(null);
      setResetKey((k) => k + 1);
      await onUpdated();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Ошибка загрузки файла");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    onError(null);
    try {
      await v1Fetch(`/deals/${dealId}/documents/${slot}`, { method: "DELETE" });
      await onUpdated();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Ошибка удаления");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-md border border-border/80 p-3 space-y-2 bg-muted/20">
      <p className="text-sm font-medium">{label}</p>
      {meta ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <a
            href={v1ApiPath(`/deals/${dealId}/documents/${slot}/file`)}
            className="text-primary font-semibold underline-offset-2 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            {meta.originalName}
          </a>
          <span className="text-xs text-muted-foreground">
            {formatFileSize(meta.size)} ·{" "}
            {new Date(meta.uploadedAt).toLocaleString("ru-RU")}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive h-7 px-2"
            disabled={busy}
            onClick={() => void remove()}
          >
            Удалить
          </Button>
        </div>
      ) : null}
      <div className="flex flex-wrap items-end gap-2">
        <Input
          key={resetKey}
          type="file"
          className={`max-w-[min(100%,24rem)] cursor-pointer text-sm ${NO_GREEN_FOCUS_CLASS}`}
          disabled={busy}
          onChange={(e) => setPending(e.target.files?.[0] ?? null)}
        />
        <Button
          type="button"
          size="sm"
          disabled={busy || !pending}
          onClick={() => void upload()}
        >
          {busy ? <><Loader2 size={14} className="animate-spin mr-1.5" />Загрузка…</> : "Загрузить"}
        </Button>
      </div>
    </div>
  );
}

function activityStyle(kind: string) {
  switch (kind) {
    case "comment":
      return {
        badge: "комментарий",
        className: "border-l-4 border-primary/50 bg-primary/5",
      };
    case "file":
      return {
        badge: "файл",
        className: "border-l-4 border-chart-3/50 bg-muted/50",
      };
    case "system":
    default:
      return {
        badge: kind,
        className: "border-l-4 border-muted-foreground/30 bg-muted/30",
      };
  }
}

export function DealFlowView({ dealId }: { dealId: string }) {
  const router = useRouter();
  const [deal, setDeal] = useState<DealDetail | null>(null);
  const [pay, setPay] = useState<PaymentPreview | null>(null);
  const [attachNote, setAttachNote] = useState("");
  const [attachBusy, setAttachBusy] = useState(false);
  const [attachResetKey, setAttachResetKey] = useState(0);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [expectedInput, setExpectedInput] = useState("");
  const [vatIncludedInput, setVatIncludedInput] = useState(true);
  const [projectAdministrationInput, setProjectAdministrationInput] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [kindInput, setKindInput] = useState<"sale" | "purchase">("sale");
  const [metaBusy, setMetaBusy] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [contractDlBusy, setContractDlBusy] = useState<string | null>(null);
  // Google Drive folder generation state: keyed by catalogItemId
  const [driveEmails, setDriveEmails] = useState<Record<string, string>>({});
  const [driveBusy, setDriveBusy] = useState<Record<string, boolean>>({});
  // Keep a ref to the latest driveFolders so callbacks don't go stale
  const driveFoldersRef = useRef<Record<string, string>>({});
  const isBuyerResidentByCountry =
    (deal?.buyer.country ?? "").trim().toUpperCase() === "KZ";
  const isPurchaseNonKzCounterparty =
    kindInput === "purchase" &&
    (deal?.buyer.country ?? "").trim().toUpperCase() !== "KZ";
  const isPurchaseKzCounterparty =
    kindInput === "purchase" &&
    (deal?.buyer.country ?? "").trim().toUpperCase() === "KZ";
  const visibleDocumentGroups = DEAL_DOCUMENT_GROUPS.filter(
    (group) => kindInput === "purchase" || !group.title.startsWith("Цепочка прав"),
  );

  const reload = useCallback(async () => {
    const d = await v1Fetch<DealDetail>(`/deals/${dealId}`);
    setDeal(d);
    try {
      const p = await v1Fetch<PaymentPreview>(
        `/deals/${dealId}/payment-preview`,
      );
      setPay(p);
       } catch {
      setPay(null);
    }
  }, [dealId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Keep ref in sync so generateDriveFolder always sees latest folders
  useEffect(() => {
    driveFoldersRef.current = deal?.commercialSnapshot?.driveFolders ?? {};
  }, [deal]);

  async function generateDriveFolder(catalogItemId: string) {
    const email = driveEmails[catalogItemId]?.trim() ?? "";
    if (!email) {
      toast.error("Введите email для доступа к папке");
      return;
    }
    setDriveBusy((prev) => ({ ...prev, [catalogItemId]: true }));
    try {
      const res = await v1Fetch<{ folderUrl: string }>(
        `/deals/${dealId}/drive-folder`,
        {
          method: "POST",
          body: JSON.stringify({ email, catalogItemId }),
        },
      );
      toast.success("Папка на Google Drive создана");
      await reload();
      return res.folderUrl;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка создания папки");
    } finally {
      setDriveBusy((prev) => ({ ...prev, [catalogItemId]: false }));
    }
  }

  useEffect(() => {
    if (!deal) return;
    const ev = deal.commercialSnapshot?.expectedValue;
    setExpectedInput(
      ev !== undefined && ev !== null && (typeof ev === "string" || typeof ev === "number")
        ? formatMoneyAmountOrEmpty(ev)
        : "",
    );
    setTitleInput(deal.title);
    setKindInput(
      (deal.kind ?? "sale") === "purchase" ? "purchase" : "sale",
    );
    setVatIncludedInput(deal.commercialSnapshot?.vatIncluded !== false);
    setProjectAdministrationInput(deal.commercialSnapshot?.projectAdministration === true);
  }, [deal]);

  async function patchStage(stage: string) {
    setBusy(true);
    setErr(null);
    try {
      await v1Fetch(`/deals/${dealId}`, {
        method: "PATCH",
        body: JSON.stringify({ stage }),
      });
      await reload();
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function patchArchived(archived: boolean) {
    setBusy(true);
    setErr(null);
    try {
      await v1Fetch(`/deals/${dealId}`, {
        method: "PATCH",
        body: JSON.stringify({ archived }),
      });
      setArchiveDialogOpen(false);
      await reload();
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function saveDealMeta() {
    if (!deal) return;
    setMetaBusy(true);
    setErr(null);
    try {
      const patch: Record<string, unknown> = {};
      if (titleInput.trim() && titleInput.trim() !== deal.title) {
        patch.title = titleInput.trim();
      }
      if (
        !moneyValuesEqual(
          deal.commercialSnapshot?.expectedValue,
          expectedInput,
        )
      ) {
        const normalized = normalizeMoneyInput(expectedInput);
        patch.commercialSnapshotPatch = {
          ...(deal.commercialSnapshot ?? {}),
          expectedValue: normalized || undefined,
        };
      }
      if ((deal.commercialSnapshot?.vatIncluded !== false) !== vatIncludedInput) {
        patch.commercialSnapshotPatch = {
          ...((patch.commercialSnapshotPatch as Record<string, unknown>) ??
            (deal.commercialSnapshot ?? {})),
          vatIncluded: vatIncludedInput,
        };
      }
      if (
        (deal.commercialSnapshot?.projectAdministration === true) !==
        projectAdministrationInput
      ) {
        patch.commercialSnapshotPatch = {
          ...((patch.commercialSnapshotPatch as Record<string, unknown>) ??
            (deal.commercialSnapshot ?? {})),
          projectAdministration: projectAdministrationInput,
        };
      }
      if (kindInput !== (deal.kind ?? "sale")) {
        patch.kind = kindInput;
      }
      if (Object.keys(patch).length > 0) {
        await v1Fetch(`/deals/${dealId}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        });
      }
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setMetaBusy(false);
    }
  }

  async function uploadDealFile() {
    if (!pendingFile) return;
    setAttachBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", pendingFile);
      if (attachNote.trim()) fd.append("message", attachNote.trim());
      fd.append("userId", DEMO_OWNER_USER_ID);
      await v1FormUpload<unknown>(`/deals/${dealId}/activities/file`, fd);
      setAttachNote("");
      setPendingFile(null);
      setAttachResetKey((k) => k + 1);
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка загрузки файла");
    } finally {
      setAttachBusy(false);
    }
  }

  async function downloadContractPdf(contractId: string, version: number) {
    setContractDlBusy(`${contractId}-${version}`);
    setErr(null);
    try {
      await v1DownloadFile(
        `/contracts/${contractId}/versions/${version}/download`,
        `contract-v${version}.pdf`,
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка скачивания");
    } finally {
      setContractDlBusy(null);
    }
  }

  if (!deal) {
    return (
      <div className="p-8 text-muted-foreground text-sm">Загрузка сделки…</div>
    );
  }

  return (
    <div className="space-y-8 p-2 max-w-5xl mx-auto">
      {deal.archived ? (
        <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-foreground">
          Сделка в архиве: скрыта из активной воронки, проверка конфликтов прав её не учитывает.
          Включите «Показать архив» на странице воронки, чтобы увидеть её в списке.
        </div>
      ) : null}

      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Перенести сделку в архив?</AlertDialogTitle>
            <AlertDialogDescription>
              Сделка исчезнет из активной воронки. Этап и данные сохранятся; при необходимости её
              можно вернуть из архива.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={() => void patchArchived(true)}>
              В архив
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3 min-w-0 flex-1">
          <Link
            href="/deals"
            className="text-sm text-primary hover:underline"
          >
            ← К воронке
          </Link>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Название сделки</Label>
            <Input
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              className={`text-xl font-bold h-auto py-2 ${NO_GREEN_FOCUS_CLASS}`}
            />
          </div>
          {deal.catalogItems.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                Контент
              </p>
              <ul className="text-lg font-semibold text-foreground leading-snug space-y-1">
                {deal.catalogItems.map((row) => (
                  <li key={row.catalogItemId}>{row.catalogItem.title}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase text-muted-foreground">
              Тип
            </span>
            <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold">
              {dealKindLabels[deal.kind ?? "sale"] ?? deal.kind}
            </span>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Тип сделки</Label>
              <select
                className={`mt-1 w-full rounded-md border border-border/50 bg-input-background px-3 py-2 text-sm focus:outline-none ${NO_GREEN_FOCUS_CLASS}`}
                value={kindInput}
                onChange={(e) =>
                  setKindInput(e.target.value === "purchase" ? "purchase" : "sale")
                }
              >
                <option value="sale">Продажа</option>
                <option value="purchase">Покупка</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Ожидаемая сумма ({deal.currency})</Label>
              <Input
                className={`mt-1 font-mono ${NO_GREEN_FOCUS_CLASS}`}
                value={expectedInput}
                onChange={(e) => setExpectedInput(e.target.value)}
                onBlur={() =>
                  setExpectedInput((prev) => formatMoneyAmountOrEmpty(prev))
                }
                placeholder="1 500 000"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="inline-flex items-center gap-2 text-sm">
                <Checkbox
                  checked={vatIncludedInput}
                  onCheckedChange={(v) => setVatIncludedInput(v === true)}
                />
                {isPurchaseNonKzCounterparty ? "С КПН" : "Оплата с НДС"}
              </label>
            </div>
            <div className="sm:col-span-2">
              <label className="inline-flex items-center gap-2 text-sm">
                <Checkbox
                  checked={projectAdministrationInput}
                  onCheckedChange={(v) => setProjectAdministrationInput(v === true)}
                />
                Администрирование проекта
              </label>
            </div>
            <div className="sm:col-span-2 flex items-end">
              <Button
                type="button"
                size="sm"
                disabled={metaBusy}
                onClick={() => void saveDealMeta()}
              >
                Сохранить
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-medium text-muted-foreground/90">
              {(deal.kind ?? "sale") === "purchase"
                ? "Правообладатель"
                : "Клиент"}
            </span>
            : {deal.buyer.legalName}
            {isBuyerResidentByCountry ? " · резидент" : " · нерезидент"}
            <span className="text-muted-foreground/80"> · Ответственный:</span>{" "}
            {deal.owner.email}
          </p>
        </div>
        <div className="flex flex-col gap-2 items-end shrink-0">
          <span className="text-xs uppercase text-muted-foreground">Этап</span>
          <select
            className={`rounded-md border border-border/50 bg-input-background px-3 py-2 text-sm min-w-[200px] focus:outline-none ${NO_GREEN_FOCUS_CLASS}`}
            value={deal.stage}
            disabled={busy}
            onChange={(e) => void patchStage(e.target.value)}
          >
            {Object.entries(stageLabels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          {deal.archived ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void patchArchived(false)}
            >
              Вернуть из архива
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => setArchiveDialogOpen(true)}
            >
              В архив
            </Button>
          )}
        </div>
      </div>

      {err && (
        <p className="text-sm text-destructive whitespace-pre-wrap">{err}</p>
      )}

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="font-semibold mb-1">Контент и права</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Человекочитаемый вид, проверка по рынку (исключая эту сделку) и
          редактирование.
        </p>
        <Accordion type="multiple" className="w-full">
          {deal.catalogItems.map((row) => (
            <DealCatalogRightsCard
              key={row.catalogItemId}
              dealId={deal.id}
              catalogItemId={row.catalogItemId}
              title={row.catalogItem.title}
              rightsSelection={row.rightsSelection}
              licenseTerms={row.catalogItem.licenseTerms ?? []}
              onUpdated={() => void reload()}
            />
          ))}
        </Accordion>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div className="flex items-center gap-2">
          <FolderOpen size={18} className="text-muted-foreground" />
          <h2 className="font-semibold">Материалы на Google Drive</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Введите email получателя и нажмите «Сгенерировать» — в Google Drive
          будет создана папка{" "}
          <span className="font-mono text-foreground/70">
            Правообладатель / Контент
          </span>{" "}
          с доступом для указанного адреса.
        </p>
        {deal.catalogItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Нет позиций каталога в сделке.
          </p>
        ) : (
          <ul className="space-y-3">
            {deal.catalogItems.map((row) => {
              const existingUrl =
                deal.commercialSnapshot?.driveFolders?.[row.catalogItemId];
              const isBusy = driveBusy[row.catalogItemId] ?? false;
              return (
                <li
                  key={row.catalogItemId}
                  className="rounded-lg border border-border/70 bg-muted/20 p-3 space-y-2"
                >
                  <p className="text-sm font-medium">{row.catalogItem.title}</p>
                  {existingUrl ? (
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <a
                        href={existingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-primary font-semibold underline-offset-2 hover:underline"
                      >
                        <FolderOpen size={14} />
                        Открыть папку на Drive
                      </a>
                      <span className="text-xs text-muted-foreground">
                        Нажмите «Сгенерировать» ещё раз, чтобы выдать доступ
                        другому адресу
                      </span>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap items-end gap-2 max-w-lg">
                    <div className="flex-1 min-w-[200px]">
                      <Label className="text-xs">Email для доступа</Label>
                      <Input
                        type="email"
                        className={`mt-1 ${NO_GREEN_FOCUS_CLASS}`}
                        placeholder="manager@example.com"
                        value={driveEmails[row.catalogItemId] ?? ""}
                        onChange={(e) =>
                          setDriveEmails((prev) => ({
                            ...prev,
                            [row.catalogItemId]: e.target.value,
                          }))
                        }
                        disabled={isBusy}
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      disabled={isBusy}
                      onClick={() => void generateDriveFolder(row.catalogItemId)}
                    >
                      {isBusy ? (
                        <>
                          <Loader2 size={14} className="animate-spin mr-1.5" />
                          Создание…
                        </>
                      ) : existingUrl ? (
                        "Обновить доступ"
                      ) : (
                        "Сгенерировать"
                      )}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div>
          <h2 className="font-semibold">Договоры</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Контракты по сделке: карточка в системе, просмотр PDF во вкладке браузера
            и загрузка файла на диск.
          </p>
        </div>
        {deal.contracts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Пока нет привязанных договоров. Создайте контракт в разделе «Контракты»
            или с карточки сделки.
          </p>
        ) : (
          <ul className="space-y-3">
            {deal.contracts.map((c) => {
              const latestV = c.versions?.[0]?.version;
              const statusLabel =
                CONTRACT_STATUS_LABELS[c.status] ?? c.status;
              const dlKey = `${c.id}-${latestV ?? 0}`;
              const busyDl = contractDlBusy === dlKey;
              return (
                <li
                  key={c.id}
                  className="rounded-lg border border-border/80 bg-muted/30 p-3 text-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">
                        № {c.number}
                        {c.archived ? (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            (архив)
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {statusLabel} · {formatMoneyAmount(c.amount)} {c.currency}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <Button type="button" variant="outline" size="sm" asChild>
                        <Link href={`/contracts/${c.id}`}>Карточка</Link>
                      </Button>
                      {latestV != null ? (
                        <>
                          <Button type="button" variant="outline" size="sm" asChild>
                            <a
                              href={v1ApiPath(
                                `/contracts/${c.id}/versions/${latestV}/download?inline=1`,
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Просмотр PDF
                            </a>
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={busyDl}
                            onClick={() =>
                              void downloadContractPdf(c.id, latestV)
                            }
                          >
                            {busyDl ? <><Loader2 size={14} className="animate-spin mr-1.5" />Скачивание…</> : "Скачать PDF"}
                          </Button>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground self-center max-w-[12rem]">
                          Версия PDF ещё не сформирована
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-4 space-y-6">
        <div>
          <h2 className="font-semibold">Документы</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {kindInput === "purchase"
              ? "Уставные документы и цепочка прав — по полям ниже."
              : "Уставные документы — по полям ниже."}{" "}
            PDF, DOC/DOCX, изображения, TIFF, TXT; до ~35 МБ на файл.
          </p>
        </div>
        <div className="space-y-6">
          {visibleDocumentGroups.map((group) => (
            <div key={group.title} className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                {group.title}
              </h3>
              <div className="grid gap-3 sm:grid-cols-1">
                {group.items.map(({ slot, label }) => (
                  <DealDocumentSlotRow
                    key={slot}
                    dealId={dealId}
                    slot={slot}
                    label={label}
                    meta={deal.dealDocuments?.[slot] ?? null}
                    onUpdated={() => void reload()}
                    onError={(msg) => setErr(msg)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-border pt-4 space-y-3">
          <h3 className="text-sm font-semibold">Прочие вложения</h3>
          <p className="text-xs text-muted-foreground">
            Произвольные файлы без привязки к полю (история в ленте).
          </p>
        </div>
        <ul className="space-y-2 text-sm max-h-80 overflow-auto pr-1">
          {deal.activities.filter((a) => a.kind !== "comment").map((a) => {
            const st = activityStyle(a.kind);
            const meta =
              a.metadata && typeof a.metadata === "object"
                ? (a.metadata as {
                    fileName?: string;
                    size?: number;
                  })
                : null;
            return (
              <li
                key={a.id}
                className={cn(
                  "rounded-md p-3 text-sm",
                  st.className,
                )}
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  <span className="font-mono">
                    {new Date(a.createdAt).toLocaleString("ru-RU")}
                  </span>
                  <span className="rounded bg-background/80 px-1.5 py-0.5 border text-[10px] uppercase">
                    {st.badge}
                  </span>
                  {a.user ? <span>{a.user.email}</span> : null}
                </div>
                <p className="mt-1.5 whitespace-pre-wrap">{a.message}</p>
                {a.kind === "file" && meta?.fileName ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <a
                      href={`/v1/deals/${dealId}/activities/${a.id}/file`}
                      className="inline-flex items-center text-sm font-semibold text-primary underline-offset-2 hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Скачать: {meta.fileName}
                    </a>
                    {meta.size != null ? (
                      <span className="text-xs text-muted-foreground">
                        {formatFileSize(meta.size)}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
        <div className="border-t border-border pt-4 max-w-xl">
          <div>
            <Label className="text-xs">Прикрепить договор или файл</Label>
            <Input
              key={attachResetKey}
              type="file"
              className={`mt-1 cursor-pointer ${NO_GREEN_FOCUS_CLASS}`}
              disabled={attachBusy}
              onChange={(e) =>
                setPendingFile(e.target.files?.[0] ?? null)
              }
            />
            {pendingFile ? (
              <p className="text-xs text-muted-foreground mt-1">
                Выбрано: {pendingFile.name}
              </p>
            ) : null}
            <Label className="text-xs mt-2 block">Подпись к файлу (необязательно)</Label>
            <Input
              className={`mt-1 ${NO_GREEN_FOCUS_CLASS}`}
              value={attachNote}
              onChange={(e) => setAttachNote(e.target.value)}
              placeholder="Например: Драфт ДУЛ от 12.03"
              disabled={attachBusy}
            />
            <Button
              type="button"
              className="mt-2"
              size="sm"
              disabled={attachBusy || !pendingFile}
              onClick={() => void uploadDealFile()}
            >
              {attachBusy ? <><Loader2 size={14} className="animate-spin mr-1.5" />Загрузка…</> : "Загрузить файл"}
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 space-y-4">
        <h2 className="font-semibold">Оплата</h2>
        {pay && (
          <div className="grid sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Gross (ожидаемо)</p>
              <p className="font-medium">
                {formatMoneyAmount(pay.gross)} {pay.currency}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Налог / удержание</p>
              {(() => {
                const gross = Number.parseFloat(
                  String(pay.gross).replace(/\s/g, "").replace(",", "."),
                );
                const net = Number.parseFloat(
                  String(pay.net).replace(/\s/g, "").replace(",", "."),
                );
                const ndsWithholding =
                  Number.isFinite(gross) && Number.isFinite(net)
                    ? Math.max(gross - net, 0)
                    : null;
                const withholdingAmount = pay.vatIncluded
                  ? ndsWithholding?.toFixed(2) ?? "0"
                  : String(pay.withholdingTaxAmount);
                const taxPercent = pay.vatIncluded ? "16%" : pay.taxPercentLabel;
                return (
                  <>
                    <p className="font-medium">
                      Удержание: {formatMoneyAmount(withholdingAmount)} {pay.currency}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Процент налога: {taxPercent}
                    </p>
                  </>
                );
              })()}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Net (Лицензионное вознаграждение правообладателю)
              </p>
              <p className="font-medium">
                {formatMoneyAmount(pay.net)} {pay.currency}
              </p>
              {isPurchaseNonKzCounterparty ? (
                <p className="text-xs text-muted-foreground mt-1">
                  {pay.vatIncluded
                    ? "С КПН: NET = GROSS - 10% КПН"
                    : "Без КПН: NET = GROSS"}
                </p>
              ) : isPurchaseKzCounterparty ? (
                <p className="text-xs text-muted-foreground mt-1">
                  {pay.vatIncluded
                    ? "С НДС: налог не возникает, NET = GROSS - 16%"
                    : "Без НДС: налог не возникает, NET = GROSS"}
                </p>
              ) : !pay.vatIncluded ? (
                <p className="text-xs text-muted-foreground mt-1">
                  Расчет без НДС: NET = сумма + 16%
                </p>
              ) : null}
              {pay.projectAdministrationEnabled ? (
                <p className="text-xs text-muted-foreground mt-1">
                  Учтено администрирование проекта: -{" "}
                  {formatMoneyAmount(pay.projectAdministrationDeduction)} {pay.currency}
                </p>
              ) : null}
            </div>
          </div>
        )}
        {deal.payments.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Платежи по сделке
            </p>
            <ul className="text-sm space-y-2 border rounded-md p-3 bg-muted/20">
              {deal.payments.map((p) => (
                <li key={p.id} className="flex flex-wrap gap-x-3 gap-y-1">
                  <span className="text-muted-foreground text-xs">
                    {p.direction === "outbound"
                      ? "Исх."
                      : p.direction === "inbound"
                        ? "Вх."
                        : p.direction ?? "—"}
                  </span>
                  <span className="font-mono">
                    {formatMoneyAmount(p.amount)}
                  </span>
                  <span>{p.currency}</span>
                  {p.netAmount ? (
                    <span className="text-muted-foreground text-xs">
                      net {formatMoneyAmount(p.netAmount)}
                    </span>
                  ) : null}
                  <span className="rounded bg-background px-1.5 border text-xs">
                    {p.status}
                  </span>
                  {p.paidAt && (
                    <span className="text-muted-foreground text-xs">
                      оплачен {new Date(p.paidAt).toLocaleDateString("ru-RU")}
                    </span>
                  )}
                  {p.dueAt && !p.paidAt && (
                    <span className="text-muted-foreground text-xs">
                      срок {new Date(p.dueAt).toLocaleDateString("ru-RU")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" asChild>
            <Link href={`/payments?dealId=${dealId}`}>
              Все платежи по сделке
            </Link>
          </Button>
        </div>
        {pay?.partialPaymentHint && (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Есть частичная оплата (partially paid).
          </p>
        )}
        {pay?.fxNote && (
          <p className="text-sm text-muted-foreground">{pay.fxNote}</p>
        )}
      </section>
    </div>
  );
}
