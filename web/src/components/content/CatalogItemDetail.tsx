"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { v1Fetch, v1FormUpload } from "@/lib/v1-client";
import {
  CATALOG_EXCLUSIVITY,
  CATALOG_PLATFORM_OPTIONS,
  formatExclusivityLabel,
  readCatalogContentMeta,
  readCatalogOfferSourceMeta,
} from "@/lib/catalog-item-create";
import { formatAssetTypeLabel } from "@/lib/asset-type-labels";
import { formatLicenseTermCell } from "@/lib/license-term-format";
import { DEAL_TERRITORY_PRESETS } from "@/lib/deal-territory-presets";
import { Button } from "@/figma/components/ui/button";
import { Checkbox } from "@/figma/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/figma/components/ui/alert-dialog";
import { Input } from "@/figma/components/ui/input";
import { Label } from "@/figma/components/ui/label";

type LicenseTerm = {
  id: string;
  territoryCode: string;
  startAt: string | null;
  endAt: string | null;
  durationMonths: number | null;
  exclusivity: string;
  platforms: string[];
  sublicensingAllowed: boolean;
  languageRights: string[];
};

type EditableLicenseTerm = {
  territoryCode: string;
  exclusivity: "exclusive" | "co_exclusive" | "non_exclusive";
  platforms: string[];
  durationMonths: string;
  startAt: string;
  endAt: string;
  languageRights: string;
  sublicensingAllowed: boolean;
};

type CatalogRow = {
  id: string;
  title: string;
  slug: string;
  assetType: string;
  status: string;
  posterFileName?: string | null;
  metadata?: unknown;
  rightsHolder: { id: string; legalName: string };
  licenseTerms: LicenseTerm[];
  updatedAt: string;
};

type DealRow = {
  id: string;
  title: string;
  stage: string;
  currency: string;
};

const STAGE_LABEL: Record<string, string> = {
  lead: "Лид",
  negotiation: "Переговоры",
  contract: "Контракт",
  paid: "Оплачено",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Черновик",
  active: "Активен",
  archived: "Архив",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ru-RU");
}

export function CatalogItemDetail(props: { catalogItemId: string }) {
  const { catalogItemId } = props;
  const router = useRouter();
  const [item, setItem] = useState<CatalogRow | null>(null);
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [posterUploading, setPosterUploading] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archivingCatalog, setArchivingCatalog] = useState(false);
  const [restoringCatalog, setRestoringCatalog] = useState(false);
  const [titleEdit, setTitleEdit] = useState("");
  const [statusEdit, setStatusEdit] = useState("");
  const [offerMetaYear, setOfferMetaYear] = useState("");
  const [offerMetaFormat, setOfferMetaFormat] = useState("");
  const [offerMetaGenre, setOfferMetaGenre] = useState("");
  const [offerMetaTheatrical, setOfferMetaTheatrical] = useState("");
  const [offerMetaDistributor, setOfferMetaDistributor] = useState("");
  const [offerMetaContentTitle, setOfferMetaContentTitle] = useState("");
  const [offerMetaRuntime, setOfferMetaRuntime] = useState("");
  const [offerMetaEpisodes, setOfferMetaEpisodes] = useState("");
  const [offerMetaSaving, setOfferMetaSaving] = useState(false);
  const [licenseTermsEdit, setLicenseTermsEdit] = useState<EditableLicenseTerm[]>([]);
  const [licenseTermsSaving, setLicenseTermsSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [c, d] = await Promise.all([
        v1Fetch<CatalogRow>(`/catalog/items/${catalogItemId}`),
        v1Fetch<DealRow[]>(
          `/deals?catalogItemId=${encodeURIComponent(catalogItemId)}`,
        ),
      ]);
      setItem(c);
      setTitleEdit(c.title);
      setStatusEdit(c.status);
      setDeals(d);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка загрузки");
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [catalogItemId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!item) return;
    const m = readCatalogOfferSourceMeta(item.metadata);
    setOfferMetaYear(m.productionYear ?? "");
    setOfferMetaFormat(m.contentFormat ?? "");
    setOfferMetaGenre(m.genre ?? "");
    setOfferMetaTheatrical(m.theatricalRelease ?? "");
    setOfferMetaDistributor(m.distributorLine ?? "");
    setOfferMetaContentTitle(m.contentTitle ?? "");
    setOfferMetaRuntime(m.runtime ?? "");
    setOfferMetaEpisodes(
      m.episodeCount != null ? String(m.episodeCount) : "",
    );
  }, [item?.id, item?.metadata]);

  useEffect(() => {
    if (!item) return;
    setLicenseTermsEdit(
      item.licenseTerms.map((t) => ({
        territoryCode: t.territoryCode,
        exclusivity:
          t.exclusivity === "exclusive" ? "exclusive" : "non_exclusive",
        platforms: [...(t.platforms ?? [])],
        durationMonths:
          t.durationMonths != null && Number.isFinite(t.durationMonths)
            ? String(t.durationMonths)
            : "",
        startAt: t.startAt ? t.startAt.slice(0, 10) : "",
        endAt: t.endAt ? t.endAt.slice(0, 10) : "",
        languageRights: (t.languageRights ?? []).join(", "),
        sublicensingAllowed: Boolean(t.sublicensingAllowed),
      })),
    );
  }, [item?.id, item?.licenseTerms]);

  async function saveOfferMetaPatch() {
    if (!item) return;
    setOfferMetaSaving(true);
    setErr(null);
    try {
      const patch: Record<string, unknown> = {
        runtime: offerMetaRuntime.trim(),
        productionYear: offerMetaYear.trim() || undefined,
        contentFormat: offerMetaFormat.trim() || undefined,
        genre: offerMetaGenre.trim() || undefined,
        theatricalRelease: offerMetaTheatrical.trim() || undefined,
        distributorLine: offerMetaDistributor.trim() || undefined,
        contentTitle: offerMetaContentTitle.trim() || undefined,
      };
      const ep = offerMetaEpisodes.trim();
      if (ep && /^\d+$/.test(ep)) {
        patch.episodeCount = Number.parseInt(ep, 10);
      }
      Object.keys(patch).forEach((k) => {
        if (patch[k] === undefined) delete patch[k];
      });
      const updated = await v1Fetch<CatalogRow>(
        `/catalog/items/${catalogItemId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ metadataPatch: patch }),
        },
      );
      setItem(updated);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не удалось сохранить сведения");
    } finally {
      setOfferMetaSaving(false);
    }
  }

  async function saveMeta() {
    if (!item) return;
    setSaving(true);
    setErr(null);
    try {
      const patch: { title?: string; status?: string } = {};
      if (titleEdit.trim() && titleEdit.trim() !== item.title) {
        patch.title = titleEdit.trim();
      }
      if (statusEdit && statusEdit !== item.status) {
        patch.status = statusEdit;
      }
      if (!Object.keys(patch).length) return;
      const updated = await v1Fetch<CatalogRow>(
        `/catalog/items/${catalogItemId}`,
        { method: "PATCH", body: JSON.stringify(patch) },
      );
      setItem(updated);
      setTitleEdit(updated.title);
      setStatusEdit(updated.status);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  function setLicenseTermAt(
    index: number,
    patch: Partial<EditableLicenseTerm>,
  ) {
    setLicenseTermsEdit((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  function togglePlatform(index: number, value: string, checked: boolean) {
    setLicenseTermsEdit((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const set = new Set(row.platforms);
        if (checked) set.add(value);
        else set.delete(value);
        return { ...row, platforms: [...set] };
      }),
    );
  }

  function selectTerritoryPreset(index: number, code: string, checked: boolean) {
    setLicenseTermsEdit((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        return { ...row, territoryCode: checked ? code : "" };
      }),
    );
  }

  async function saveLicenseTerms() {
    if (!item) return;
    setLicenseTermsSaving(true);
    setErr(null);
    try {
      const licenseTerms = licenseTermsEdit.map((row, idx) => {
        const territoryCode = row.territoryCode.trim();
        if (!territoryCode) {
          throw new Error(`Лицензионная строка ${idx + 1}: укажите территорию`);
        }
        if (!row.platforms.length) {
          throw new Error(
            `Лицензионная строка ${idx + 1}: выберите хотя бы одну платформу`,
          );
        }
        const langs = row.languageRights
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (!langs.length) {
          throw new Error(`Лицензионная строка ${idx + 1}: укажите языки`);
        }
        const durationRaw = row.durationMonths.trim();
        const durationMonths = durationRaw
          ? Number.parseInt(durationRaw, 10)
          : undefined;
        if (
          durationRaw &&
          (typeof durationMonths !== "number" ||
            !Number.isFinite(durationMonths) ||
            durationMonths <= 0)
        ) {
          throw new Error(
            `Лицензионная строка ${idx + 1}: срок в месяцах должен быть > 0`,
          );
        }
        return {
          territoryCode,
          exclusivity: row.exclusivity,
          platforms: row.platforms,
          durationMonths,
          startAt: row.startAt || undefined,
          endAt: row.endAt || undefined,
          languageRights: langs,
          sublicensingAllowed: row.sublicensingAllowed,
        };
      });

      const updated = await v1Fetch<CatalogRow>(`/catalog/items/${catalogItemId}`, {
        method: "PATCH",
        body: JSON.stringify({ licenseTerms }),
      });
      setItem(updated);
    } catch (e) {
      setErr(
        e instanceof Error ? e.message : "Не удалось сохранить лицензионные сроки",
      );
    } finally {
      setLicenseTermsSaving(false);
    }
  }

  async function uploadPoster(file: File | null) {
    if (!file || !item) return;
    setPosterUploading(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const updated = await v1FormUpload<CatalogRow>(
        `/catalog/items/${catalogItemId}/poster`,
        fd,
      );
      setItem(updated);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не удалось загрузить постер");
    } finally {
      setPosterUploading(false);
    }
  }

  async function confirmSendToArchive() {
    setArchivingCatalog(true);
    setErr(null);
    try {
      await v1Fetch(`/catalog/items/${catalogItemId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "archived" }),
      });
      setArchiveDialogOpen(false);
      router.push("/content?tab=archive");
    } catch (e) {
      setErr(
        e instanceof Error ? e.message : "Не удалось отправить в архив",
      );
    } finally {
      setArchivingCatalog(false);
    }
  }

  async function restoreFromArchiveDetail() {
    setRestoringCatalog(true);
    setErr(null);
    try {
      const updated = await v1Fetch<CatalogRow>(
        `/catalog/items/${catalogItemId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: "draft" }),
        },
      );
      setItem(updated);
      setTitleEdit(updated.title);
      setStatusEdit(updated.status);
    } catch (e) {
      setErr(
        e instanceof Error ? e.message : "Не удалось восстановить из архива",
      );
    } finally {
      setRestoringCatalog(false);
    }
  }

  if (loading) {
    return (
      <div className="p-2 text-sm text-muted-foreground">Загрузка…</div>
    );
  }

  if (err && !item) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive whitespace-pre-wrap">{err}</p>
        <Button type="button" variant="outline" onClick={() => void load()}>
          Повторить
        </Button>
        <Link
          href="/content"
          className="block text-sm text-primary underline-offset-4 hover:underline"
        >
          ← К каталогу
        </Link>
      </div>
    );
  }

  if (!item) return null;

  return (
    <div className="space-y-8">
      <AlertDialog
        open={archiveDialogOpen}
        onOpenChange={setArchiveDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отправить в архив?</AlertDialogTitle>
            <AlertDialogDescription>
              «{item.title}» скроется из основного каталога. Данные сохранятся;
              позже можно восстановить как черновик.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archivingCatalog}>
              Отмена
            </AlertDialogCancel>
            <Button
              type="button"
              disabled={archivingCatalog}
              onClick={() => void confirmSendToArchive()}
            >
              {archivingCatalog ? "Сохранение…" : "В архив"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/content"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Каталог
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-foreground">
            {item.title}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {formatAssetTypeLabel(item.assetType)} · slug:{" "}
            <code className="text-xs">{item.slug}</code>{" "}
            · обновлено {fmtDate(item.updatedAt)}
          </p>
          {(() => {
            const meta = readCatalogContentMeta(item.metadata);
            if (!meta.runtime && meta.episodeCount == null) return null;
            return (
              <p className="text-sm text-muted-foreground mt-2 space-x-3">
                {meta.episodeCount != null ? (
                  <span>Серий: {meta.episodeCount}</span>
                ) : null}
                {meta.runtime ? (
                  <span>Хронометраж: {meta.runtime}</span>
                ) : null}
              </p>
            );
          })()}
          {item.status === "archived" ? (
            <p className="mt-3 text-sm rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-amber-900 dark:text-amber-100">
              Карточка в архиве: в основном каталоге не отображается.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/deals?create=1&catalogItemId=${item.id}`}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90"
          >
            Новая сделка
          </Link>
        </div>
      </div>

      <div className="space-y-3 max-w-md">
        {item.posterFileName ? (
          <div className="rounded-xl border border-border overflow-hidden bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/v1/catalog/items/${item.id}/poster?v=${encodeURIComponent(item.updatedAt)}`}
              alt={`Постер: ${item.title}`}
              className="w-full aspect-[2/3] max-h-[420px] object-cover"
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Постер не загружен.</p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="max-w-xs cursor-pointer"
            disabled={posterUploading}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              e.target.value = "";
              void uploadPoster(f);
            }}
          />
          {posterUploading ? (
            <span className="text-xs text-muted-foreground">Загрузка…</span>
          ) : null}
        </div>
      </div>

      {err && (
        <p className="text-sm text-destructive whitespace-pre-wrap">{err}</p>
      )}

      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="text-lg font-semibold">Сведения для оффера</h2>
        <p className="text-xs text-muted-foreground">
          Эти поля подставляются в форму «Офферы» при выборе этого тайтла из
          каталога (включая правообладателя из карточки).
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Хронометраж</Label>
            <Input
              className="mt-1"
              value={offerMetaRuntime}
              onChange={(e) => setOfferMetaRuntime(e.target.value)}
            />
          </div>
          <div>
            <Label>Кол-во серий</Label>
            <Input
              className="mt-1"
              inputMode="numeric"
              value={offerMetaEpisodes}
              onChange={(e) =>
                setOfferMetaEpisodes(e.target.value.replace(/\D/g, ""))
              }
            />
          </div>
          <div>
            <Label>Год производства</Label>
            <Input
              className="mt-1"
              value={offerMetaYear}
              onChange={(e) => setOfferMetaYear(e.target.value)}
            />
          </div>
          <div>
            <Label>Формат (текст)</Label>
            <Input
              className="mt-1"
              value={offerMetaFormat}
              onChange={(e) => setOfferMetaFormat(e.target.value)}
            />
          </div>
          <div>
            <Label>Жанр</Label>
            <Input
              className="mt-1"
              value={offerMetaGenre}
              onChange={(e) => setOfferMetaGenre(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Кинотеатральный релиз</Label>
            <Input
              className="mt-1"
              value={offerMetaTheatrical}
              onChange={(e) => setOfferMetaTheatrical(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Дистрибьютор</Label>
            <Input
              className="mt-1"
              value={offerMetaDistributor}
              onChange={(e) => setOfferMetaDistributor(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Название (блок сведений)</Label>
            <Input
              className="mt-1"
              value={offerMetaContentTitle}
              onChange={(e) => setOfferMetaContentTitle(e.target.value)}
              placeholder={`По умолчанию: ${item.title}`}
            />
          </div>
        </div>
        <Button
          type="button"
          variant="secondary"
          disabled={offerMetaSaving}
          onClick={() => void saveOfferMetaPatch()}
        >
          {offerMetaSaving ? "Сохранение…" : "Сохранить сведения для оффера"}
        </Button>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="text-lg font-semibold">Редактирование</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Название</Label>
            <Input
              className="mt-1"
              value={titleEdit}
              onChange={(e) => setTitleEdit(e.target.value)}
            />
          </div>
          <div>
            <Label>Статус в каталоге</Label>
            <select
              className="mt-1 w-full rounded-md border border-border/50 bg-input-background px-3 py-2 text-sm"
              value={statusEdit}
              onChange={(e) => setStatusEdit(e.target.value)}
            >
              {(["draft", "active", "archived"] as const).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s] ?? s}
                </option>
              ))}
            </select>
          </div>
        </div>
        <Button
          type="button"
          onClick={() => void saveMeta()}
          disabled={
            saving ||
            (titleEdit.trim() === item.title && statusEdit === item.status)
          }
        >
          Сохранить
        </Button>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 space-y-2">
        <h2 className="text-lg font-semibold">Правообладатель</h2>
        <p className="text-sm">{item.rightsHolder.legalName}</p>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h2 className="text-lg font-semibold">Лецинзионные сроки</h2>
        {licenseTermsEdit.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Лицензионных строк пока нет. Добавьте первую строку.
          </p>
        ) : null}
        <div className="space-y-4">
          {licenseTermsEdit.map((t, idx) => (
            <div key={`${idx}-${t.territoryCode}`} className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">Строка {idx + 1}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setLicenseTermsEdit((prev) => prev.filter((_, i) => i !== idx))
                  }
                >
                  Удалить
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2 space-y-2">
                  <Label>Территория</Label>
                  <div className="flex flex-wrap gap-3">
                    {DEAL_TERRITORY_PRESETS.map((preset) => {
                      const checked =
                        t.territoryCode.trim().toUpperCase() === preset.code;
                      return (
                        <label
                          key={preset.code}
                          className="inline-flex items-center gap-2 text-sm"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) =>
                              selectTerritoryPreset(idx, preset.code, v === true)
                            }
                          />
                          {preset.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <Label>Формат лицензии</Label>
                  <select
                    className="mt-1 w-full rounded-md border border-border/50 bg-input-background px-3 py-2 text-sm"
                    value={t.exclusivity}
                    onChange={(e) =>
                      setLicenseTermAt(idx, {
                        exclusivity: e.target.value as "exclusive" | "co_exclusive" | "non_exclusive",
                      })
                    }
                  >
                    {CATALOG_EXCLUSIVITY.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Срок (месяцы)</Label>
                  <Input
                    className="mt-1"
                    inputMode="numeric"
                    value={t.durationMonths}
                    onChange={(e) =>
                      setLicenseTermAt(idx, {
                        durationMonths: e.target.value.replace(/\D/g, ""),
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Языки (через запятую)</Label>
                  <Input
                    className="mt-1"
                    value={t.languageRights}
                    onChange={(e) =>
                      setLicenseTermAt(idx, { languageRights: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Дата начала</Label>
                  <Input
                    className="mt-1"
                    type="date"
                    value={t.startAt}
                    onChange={(e) =>
                      setLicenseTermAt(idx, { startAt: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Дата окончания</Label>
                  <Input
                    className="mt-1"
                    type="date"
                    value={t.endAt}
                    onChange={(e) =>
                      setLicenseTermAt(idx, { endAt: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Платформы</Label>
                <div className="flex flex-wrap gap-3">
                  {CATALOG_PLATFORM_OPTIONS.map((p) => {
                    const checked = t.platforms.includes(p.value);
                    return (
                      <label key={p.value} className="inline-flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => togglePlatform(idx, p.value, v === true)}
                        />
                        {p.label}
                      </label>
                    );
                  })}
                </div>
              </div>
              <label className="inline-flex items-center gap-2 text-sm">
                <Checkbox
                  checked={t.sublicensingAllowed}
                  onCheckedChange={(v) =>
                    setLicenseTermAt(idx, { sublicensingAllowed: v === true })
                  }
                />
                Разрешено сублицензирование
              </label>
              <p className="text-xs text-muted-foreground">
                Текущее значение:{" "}
                {formatExclusivityLabel(t.exclusivity)} ·{" "}
                {formatLicenseTermCell(
                  t.durationMonths ? Number.parseInt(t.durationMonths, 10) : null,
                  t.startAt || null,
                  t.endAt || null,
                )}
              </p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setLicenseTermsEdit((prev) => [
                ...prev,
                {
                  territoryCode: "KZ",
                  exclusivity: "non_exclusive",
                  platforms: ["TV"],
                  durationMonths: "",
                  startAt: "",
                  endAt: "",
                  languageRights: "original",
                  sublicensingAllowed: false,
                },
              ])
            }
          >
            Добавить строку
          </Button>
          <Button
            type="button"
            disabled={licenseTermsSaving}
            onClick={() => void saveLicenseTerms()}
          >
            {licenseTermsSaving ? "Сохранение…" : "Сохранить лицензионные сроки"}
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h2 className="text-lg font-semibold">Сделки с этой единицей</h2>
        {deals.length === 0 ? (
          <p className="text-sm text-muted-foreground">Пока нет сделок.</p>
        ) : (
          <ul className="space-y-2">
            {deals.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/deals/${d.id}`}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  {d.title}
                </Link>
                <span className="text-xs text-muted-foreground ml-2">
                  {STAGE_LABEL[d.stage] ?? d.stage} · {d.currency}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h2 className="text-lg font-semibold">Архив</h2>
        {item.status === "archived" ? (
          <>
            <p className="text-sm text-muted-foreground">
              Верните карточку в работу со статусом «Черновик» — она снова
              появится в основном каталоге.
            </p>
            <Button
              type="button"
              disabled={restoringCatalog}
              onClick={() => void restoreFromArchiveDetail()}
            >
              {restoringCatalog ? "Восстановление…" : "Восстановить из архива"}
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Скрыть карточку из основного каталога без удаления данных и
              файлов. Сделки с этой единицей сохраняются.
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={archivingCatalog}
              onClick={() => setArchiveDialogOpen(true)}
            >
              В архив
            </Button>
          </>
        )}
      </section>
    </div>
  );
}
