"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Archive,
  ArchiveRestore,
  Trash2,
  Download,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  Send,
  PenLine,
  Ban,
  FilePlus2,
} from "lucide-react";
import { v1ApiPath, v1Fetch, v1DownloadFile } from "@/lib/v1-client";
import { tr } from "@/lib/i18n";
import { isAdminDeleteEmail } from "@/lib/admin-delete-email";
import { formatMoneyAmount } from "@/lib/format-money";
import { Button } from "@/figma/components/ui/button";
import { Input } from "@/figma/components/ui/input";
import { Label } from "@/figma/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/figma/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/figma/components/ui/alert-dialog";
import { cn } from "@/figma/components/ui/utils";

const STATUS_META: Record<
  string,
  { label: string; className: string; icon: typeof FileText }
> = {
  draft: {
    label: tr("crm", "contractStatusDraft"),
    className:
      "bg-muted/50 text-muted-foreground border border-border",
    icon: FileText,
  },
  sent: {
    label: tr("crm", "contractStatusSent"),
    className: "bg-warning/15 text-warning border border-warning/30",
    icon: Clock,
  },
  signed: {
    label: tr("crm", "contractStatusSigned"),
    className: "bg-success/15 text-success border border-success/30",
    icon: CheckCircle,
  },
  expired: {
    label: tr("crm", "contractStatusExpired"),
    className: "bg-destructive/15 text-destructive border border-destructive/30",
    icon: Ban,
  },
};

type ContractDetailData = {
  id: string;
  dealId: string;
  number: string;
  status: string;
  archived?: boolean;
  territory: string;
  termEndAt: string;
  amount: string;
  currency: string;
  fxRateFixed?: string | null;
  signingDueAt?: string | null;
  dealSnapshotFingerprint?: string | null;
  templateId?: string | null;
  createdAt: string;
  updatedAt: string;
  deal: {
    id: string;
    title: string;
    kind?: string;
    currency: string;
    buyer: { legalName: string; country?: string };
    catalogItems: Array<{
      catalogItemId: string;
      catalogItem: { title: string };
    }>;
  };
};

type DiffDealResponse = {
  differs: boolean;
  differences: string[];
  message: string;
};

type VersionRow = {
  id: string;
  version: number;
  createdAt: string;
  signedAt: string | null;
};

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("ru-RU");
}

export function ContractDetail({ contractId }: { contractId: string }) {
  const router = useRouter();
  const [contract, setContract] = useState<ContractDetailData | null>(null);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [diff, setDiff] = useState<DiffDealResponse | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [sendDue, setSendDue] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [manualNote, setManualNote] = useState("");
  const [expireOpen, setExpireOpen] = useState(false);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const canAdminDelete = isAdminDeleteEmail(authEmail);

  const reload = useCallback(async () => {
    setLoadErr(null);
    try {
      const [c, v, d] = await Promise.all([
        v1Fetch<ContractDetailData>(`/contracts/${contractId}`),
        v1Fetch<VersionRow[]>(`/contracts/${contractId}/versions`),
        v1Fetch<DiffDealResponse>(`/contracts/${contractId}/diff-deal`).catch(
          () => null,
        ),
      ]);
      setContract(c);
      setVersions(v);
      setDiff(d);
    } catch (e) {
      setContract(null);
      setVersions([]);
      setDiff(null);
      setLoadErr(e instanceof Error ? e.message : "Ошибка загрузки");
    }
  }, [contractId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    void v1Fetch<{ user: { email: string } }>("/auth/me")
      .then((r) => setAuthEmail(r.user.email))
      .catch(() => setAuthEmail(null));
  }, []);

  async function downloadVersion(version: number) {
    setBusy(`dl-${version}`);
    try {
      await v1DownloadFile(
        `/contracts/${contractId}/versions/${version}/download`,
        `contract-v${version}.pdf`,
      );
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Не удалось скачать");
    } finally {
      setBusy(null);
    }
  }

  async function postSend() {
    setBusy("send");
    try {
      await v1Fetch(`/contracts/${contractId}/send`, {
        method: "POST",
        body: JSON.stringify({
          signingDueAt: sendDue.trim() || undefined,
        }),
      });
      setSendOpen(false);
      setSendDue("");
      await reload();
      router.refresh();
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(null);
    }
  }

  async function postSign() {
    setBusy("sign");
    try {
      await v1Fetch(`/contracts/${contractId}/sign`, { method: "POST" });
      await reload();
      router.refresh();
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(null);
    }
  }

  async function postExpire() {
    setBusy("expire");
    try {
      await v1Fetch(`/contracts/${contractId}/expire-draft`, {
        method: "POST",
      });
      setExpireOpen(false);
      await reload();
      router.refresh();
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(null);
    }
  }

  async function postManualVersion() {
    setBusy("manual");
    try {
      await v1Fetch(`/contracts/${contractId}/manual-version`, {
        method: "POST",
        body: JSON.stringify({ note: manualNote.trim() || undefined }),
      });
      setManualOpen(false);
      setManualNote("");
      await reload();
      router.refresh();
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(null);
    }
  }

  async function patchArchived(archived: boolean) {
    setBusy("archive");
    try {
      await v1Fetch(`/contracts/${contractId}`, {
        method: "PATCH",
        body: JSON.stringify({ archived }),
      });
      await reload();
      router.refresh();
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(null);
    }
  }

  async function deleteContractForever() {
    if (
      !window.confirm(
        "Удалить контракт безвозвратно? Действие необратимо.",
      )
    ) {
      return;
    }
    setDeleteBusy(true);
    try {
      await v1Fetch(`/contracts/${contractId}`, { method: "DELETE" });
      router.push("/contracts");
      router.refresh();
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Ошибка удаления");
    } finally {
      setDeleteBusy(false);
    }
  }

  if (loadErr && !contract) {
    return (
      <div className="space-y-4">
        <Link
          href="/contracts"
          className="inline-flex items-center gap-2 text-sm text-primary font-medium hover:underline"
        >
          <ArrowLeft className="size-4" />
          {tr("crm", "contractDetailBackList")}
        </Link>
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive whitespace-pre-wrap">
          {loadErr}
        </div>
      </div>
    );
  }

  if (!contract) {
    return (
      <p className="text-sm text-muted-foreground">{tr("crm", "gradesLoading")}</p>
    );
  }

  const st =
    STATUS_META[contract.status] ?? STATUS_META.draft;
  const StatusIcon = st.icon;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/contracts"
            className="inline-flex items-center gap-2 text-sm text-primary font-medium hover:underline mb-3"
          >
            <ArrowLeft className="size-4" />
            {tr("crm", "contractDetailContracts")}
          </Link>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap items-center gap-3"
          >
            <h1
              className="text-[22px] font-semibold tracking-tight text-foreground"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {contract.number}
            </h1>
            <span
              className={cn(
                "inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold",
                st.className,
              )}
            >
              <StatusIcon className="size-3.5" strokeWidth={2.5} />
              {st.label}
            </span>
          </motion.div>
          <p className="text-sm text-muted-foreground mt-2">
            Сделка:{" "}
            <Link
              href={`/deals/${contract.deal.id}`}
              className="font-semibold text-primary hover:underline"
            >
              {contract.deal.title}
            </Link>
            {" · "}
            {contract.deal.buyer?.legalName ?? "—"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {contract.archived && canAdminDelete ? (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => void deleteContractForever()}
              disabled={busy !== null || deleteBusy}
            >
              <Trash2 className="size-4 mr-1.5" />
              {deleteBusy ? "Удаление…" : "Удалить навсегда"}
            </Button>
          ) : null}
          {contract.archived ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void patchArchived(false)}
              disabled={busy !== null}
            >
              <ArchiveRestore className="size-4 mr-1.5" />
              Вернуть из архива
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void patchArchived(true)}
              disabled={busy !== null}
            >
              <Archive className="size-4 mr-1.5" />
              В архив
            </Button>
          )}
          {contract.status === "draft" ? (
            <>
              <Button
                type="button"
                size="sm"
                onClick={() => setSendOpen(true)}
                disabled={busy !== null || contract.archived}
              >
                <Send className="size-4 mr-1.5" />
                Отправить на подпись
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setExpireOpen(true)}
                disabled={busy !== null || contract.archived}
              >
                Снять с учёта
              </Button>
            </>
          ) : null}
          {contract.status === "sent" ? (
            <Button
              type="button"
              size="sm"
              onClick={() => void postSign()}
              disabled={busy !== null || contract.archived}
            >
              <PenLine className="size-4 mr-1.5" />
              Отметить подписанным
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setManualOpen(true)}
            disabled={busy !== null || contract.archived}
          >
            <FilePlus2 className="size-4 mr-1.5" />
            Новая версия
          </Button>
        </div>
      </div>

      {loadErr ? (
        <p className="text-sm text-destructive whitespace-pre-wrap">{loadErr}</p>
      ) : null}

      {contract.archived ? (
        <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground flex flex-wrap items-center gap-2">
          <Archive className="size-4 shrink-0" />
          Контракт в архиве и скрыт из основного списка. Его можно вернуть кнопкой выше.
        </div>
      ) : null}

      {diff?.differs ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 space-y-2">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-semibold text-sm">
            <AlertTriangle className="size-4 shrink-0" />
            {diff.message}
          </div>
          <ul className="text-sm text-foreground/90 list-disc pl-5 space-y-1">
            {diff.differences.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      ) : diff && !diff.differs ? (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <CheckCircle className="size-3.5 text-success" />
          {diff.message}
        </p>
      ) : null}

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h2 className="font-semibold text-sm">Условия</h2>
          <dl className="grid grid-cols-1 gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Сумма</dt>
              <dd className="font-mono font-semibold">
                {formatMoneyAmount(contract.amount)} {contract.currency}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Территория</dt>
              <dd>{contract.territory}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Окончание срока</dt>
              <dd>{fmtDate(contract.termEndAt)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Срок подписания</dt>
              <dd>{fmtDate(contract.signingDueAt)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Обновлён</dt>
              <dd>{fmtDate(contract.updatedAt)}</dd>
            </div>
          </dl>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h2 className="font-semibold text-sm">Контент в сделке</h2>
          <ul className="text-sm space-y-1">
            {contract.deal.catalogItems.length === 0 ? (
              <li className="text-muted-foreground">Нет позиций</li>
            ) : (
              contract.deal.catalogItems.map((row) => (
                <li key={row.catalogItemId}>
                  <Link
                    href={`/content/${row.catalogItemId}`}
                    className="text-primary hover:underline"
                  >
                    {row.catalogItem?.title ?? row.catalogItemId}
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <h2 className="font-semibold text-sm">Версии PDF</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-bold uppercase">
                  Версия
                </th>
                <th className="text-left px-4 py-2 text-xs font-bold uppercase">
                  Создана
                </th>
                <th className="text-left px-4 py-2 text-xs font-bold uppercase">
                  Подпись
                </th>
                <th className="text-right px-4 py-2 text-xs font-bold uppercase">
                  Файл
                </th>
              </tr>
            </thead>
            <tbody>
              {versions.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-muted-foreground text-center"
                  >
                    Версий нет
                  </td>
                </tr>
              ) : (
                versions.map((v) => (
                  <tr
                    key={v.id}
                    className="border-b border-border last:border-0 hover:bg-muted/20"
                  >
                    <td className="px-4 py-2 font-mono font-semibold">
                      v{v.version}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {fmtDate(v.createdAt)}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {fmtDate(v.signedAt)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-2 flex-wrap">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8"
                          asChild
                        >
                          <a
                            href={v1ApiPath(
                              `/contracts/${contractId}/versions/${v.version}/download?inline=1`,
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Просмотр
                          </a>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8"
                          disabled={busy !== null}
                          onClick={() => void downloadVersion(v.version)}
                        >
                          <Download className="size-3.5 mr-1" />
                          {busy === `dl-${v.version}` ? "…" : "Скачать"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Отправить на подпись</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Желаемая дата подписания (необязательно)</Label>
            <Input
              type="date"
              value={sendDue}
              onChange={(e) => setSendDue(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Будет создана задача ответственному по сделке.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSendOpen(false)}>
              Отмена
            </Button>
            <Button
              type="button"
              disabled={busy !== null}
              onClick={() => void postSend()}
            >
              Отправить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Новая версия</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Комментарий (необязательно)</Label>
            <Input
              value={manualNote}
              onChange={(e) => setManualNote(e.target.value)}
              placeholder="Например: правки от юриста"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setManualOpen(false)}>
              Отмена
            </Button>
            <Button
              type="button"
              disabled={busy !== null}
              onClick={() => void postManualVersion()}
            >
              Создать версию
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={expireOpen} onOpenChange={setExpireOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Снять контракт с учёта?</AlertDialogTitle>
            <AlertDialogDescription>
              Статус станет «Неактуален». Данные и версии сохранятся.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy !== null}>Отмена</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={busy !== null}
              onClick={() => void postExpire()}
            >
              Подтвердить
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
