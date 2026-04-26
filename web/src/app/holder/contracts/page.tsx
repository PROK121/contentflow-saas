"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Download, FileText, PenTool } from "lucide-react";
import { v1Fetch, v1DownloadFile } from "@/lib/v1-client";

interface Contract {
  id: string;
  number: string;
  status: string;
  territory: string;
  termEndAt: string;
  currency: string;
  signingDueAt: string | null;
  cabinetSignedAt: string | null;
  clientCabinetSigned: boolean;
  /// Поля click-sign правообладателя.
  holderSignedAt: string | null;
  holderSignedVersion: number | null;
  createdAt: string;
  deal: { id: string; title: string } | null;
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Черновик",
  sent: "На подписании",
  signed: "Подписан",
  expired: "Истёк",
  terminated: "Расторгнут",
};

/// Версия пользовательского соглашения о click-sign. При смене политики —
/// инкремент. Передаём в API, оно сохраняется в `holderSignedTermsVer`.
const HOLDER_SIGN_TERMS_VERSION = "2026-04-26";

export default function HolderContractsPage() {
  const [items, setItems] = useState<Contract[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signingFor, setSigningFor] = useState<Contract | null>(null);

  async function reload() {
    try {
      setItems(await v1Fetch<Contract[]>("/holder/contracts"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Договоры</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Контракты, в которых вы — правообладатель. Договор со статусом «На
          подписании» можно подписать прямо в кабинете.
        </p>
      </div>

      {error ? (
        <div className="mb-6 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {items === null ? (
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 bg-card p-10 text-center">
          <FileText className="mx-auto mb-3 size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Договоров пока нет.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/40 bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">№</th>
                <th className="px-4 py-3 text-left">Сделка</th>
                <th className="px-4 py-3 text-left">Территория</th>
                <th className="px-4 py-3 text-left">Действует до</th>
                <th className="px-4 py-3 text-left">Статус</th>
                <th className="px-4 py-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="border-t border-border/40">
                  <td className="px-4 py-3 font-medium">{c.number}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.deal?.title ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.territory}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(c.termEndAt).toLocaleDateString("ru-RU")}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-md px-2 py-0.5 text-xs ${
                        c.status === "signed"
                          ? "bg-emerald-50 text-emerald-700"
                          : c.status === "sent"
                            ? "bg-amber-50 text-amber-700"
                            : c.status === "expired"
                              ? "bg-muted text-muted-foreground"
                              : "bg-blue-50 text-blue-700"
                      }`}
                    >
                      {STATUS_LABEL[c.status] ?? c.status}
                    </span>
                    {c.holderSignedAt ? (
                      <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-700">
                        <CheckCircle2 className="size-3" />
                        подписано вами{" "}
                        {new Date(c.holderSignedAt).toLocaleDateString(
                          "ru-RU",
                        )}
                        {c.holderSignedVersion
                          ? ` (v${c.holderSignedVersion})`
                          : null}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {c.status === "sent" && !c.holderSignedAt ? (
                        <button
                          type="button"
                          onClick={() => setSigningFor(c)}
                          className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                        >
                          <PenTool className="size-3.5" />
                          Подписать
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() =>
                          v1DownloadFile(
                            `/holder/contracts/${c.id}/download`,
                            `contract-${c.number}.pdf`,
                          ).catch((e) =>
                            setError(
                              e instanceof Error ? e.message : "Ошибка",
                            ),
                          )
                        }
                        className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2.5 py-1 text-xs text-foreground hover:bg-muted"
                      >
                        <Download className="size-3.5" />
                        Скачать
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {signingFor ? (
        <SignContractModal
          contract={signingFor}
          onClose={() => setSigningFor(null)}
          onSigned={async () => {
            setSigningFor(null);
            await reload();
          }}
          onError={(msg) => setError(msg)}
        />
      ) : null}
    </div>
  );
}

function SignContractModal({
  contract,
  onClose,
  onSigned,
  onError,
}: {
  contract: Contract;
  onClose: () => void;
  onSigned: () => void;
  onError: (msg: string) => void;
}) {
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSign() {
    if (!consent || submitting) return;
    setSubmitting(true);
    try {
      await v1Fetch<{ ok: true }>(`/holder/contracts/${contract.id}/sign`, {
        method: "POST",
        body: JSON.stringify({
          consent: true,
          termsVersion: HOLDER_SIGN_TERMS_VERSION,
        }),
      });
      onSigned();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Ошибка подписи");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-card p-6 shadow-xl">
        <h2 className="text-lg font-semibold">
          Подписание договора № {contract.number}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Перед подписанием обязательно скачайте и внимательно прочитайте
          актуальную версию договора.
        </p>

        <button
          type="button"
          onClick={() =>
            v1DownloadFile(
              `/holder/contracts/${contract.id}/download`,
              `contract-${contract.number}.pdf`,
            ).catch((e) =>
              onError(e instanceof Error ? e.message : "Ошибка"),
            )
          }
          className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border/60 px-3 py-1.5 text-sm hover:bg-muted"
        >
          <Download className="size-4" />
          Скачать PDF договора
        </button>

        <div className="mt-5 rounded-lg border border-border/60 bg-muted/30 p-4 text-xs leading-5 text-muted-foreground">
          Нажимая «Подписать», я подтверждаю, что:
          <ul className="ml-4 mt-2 list-disc space-y-1">
            <li>я являюсь уполномоченным представителем правообладателя;</li>
            <li>
              я ознакомился(-ась) с актуальной версией договора и принимаю его
              условия;
            </li>
            <li>
              мои действия (IP, время, версия документа) будут зафиксированы
              для подтверждения подписи в случае спора;
            </li>
            <li>
              я согласен(-на) на использование простой электронной подписи в
              соответствии с законодательством РФ.
            </li>
          </ul>
        </div>

        <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Я подтверждаю своё согласие на условия выше и подписание договора
            № {contract.number}.
          </span>
        </label>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-md border border-border/60 px-4 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleSign}
            disabled={!consent || submitting}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <PenTool className="size-4" />
            {submitting ? "Подписание…" : "Подписать"}
          </button>
        </div>
      </div>
    </div>
  );
}
