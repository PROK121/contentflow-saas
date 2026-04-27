"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { v1Fetch, v1FormUpload } from "@/lib/v1-client";
import {
  buildCatalogItemMetadataForApi,
  buildLicenseTermsForApi,
  CATALOG_ASSET_TYPES,
  CATALOG_EXCLUSIVITY,
  CATALOG_PREMIERE_CATEGORIES,
  CATALOG_PLATFORM_OPTIONS,
  defaultCatalogTerm,
  isSeriesLikeCatalogAssetType,
  type CatalogTermDraft,
  suggestCatalogSlug,
  validateCatalogItemCreateInput,
} from "@/lib/catalog-item-create";
import { Button } from "@/figma/components/ui/button";
import { Input } from "@/figma/components/ui/input";
import { Label } from "@/figma/components/ui/label";
import { Checkbox } from "@/figma/components/ui/checkbox";
import { cn } from "@/figma/components/ui/utils";

type Org = { id: string; legalName: string };

export type NewCatalogItemFormProps = {
  /** В диалоге — без шапки страницы и ссылки «Каталог» */
  layout?: "page" | "embedded";
  /** Если задан — после создания вызывается вместо перехода на карточку */
  onCreated?: (catalogItemId: string) => void | Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
};

export function NewCatalogItemForm(props: NewCatalogItemFormProps = {}) {
  const {
    layout = "page",
    onCreated,
    onCancel,
    submitLabel = "Создать",
  } = props;
  const router = useRouter();
  const [holders, setHolders] = useState<Org[]>([]);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [assetType, setAssetType] = useState<string>("video");
  const [rightsHolderOrgId, setRightsHolderOrgId] = useState("");
  const [terms, setTerms] = useState<CatalogTermDraft[]>([defaultCatalogTerm()]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [inlineHolderOpen, setInlineHolderOpen] = useState(false);
  const [newHolderName, setNewHolderName] = useState("");
  const [newHolderCountry, setNewHolderCountry] = useState("KZ");
  const [creatingHolder, setCreatingHolder] = useState(false);
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [episodeCount, setEpisodeCount] = useState("");
  const [runtime, setRuntime] = useState("");
  const [seasonCount, setSeasonCount] = useState("");
  const [productionYear, setProductionYear] = useState("");
  const [countryOfProduction, setCountryOfProduction] = useState("");
  const [contentFormatExtra, setContentFormatExtra] = useState("");
  const [genre, setGenre] = useState("");
  const [ageRating, setAgeRating] = useState("");
  const [localizationNeeded, setLocalizationNeeded] = useState("Да");
  const [musicRightsStatus, setMusicRightsStatus] = useState("Не подтверждён");
  const [theatricalRelease, setTheatricalRelease] = useState("");
  const [distributorLine, setDistributorLine] = useState("");
  const [localTitle, setLocalTitle] = useState("");
  const [premiereCategory, setPremiereCategory] = useState("C");

  const posterPreviewUrl = useMemo(() => {
    if (!posterFile) return null;
    return URL.createObjectURL(posterFile);
  }, [posterFile]);

  useEffect(() => {
    return () => {
      if (posterPreviewUrl) URL.revokeObjectURL(posterPreviewUrl);
    };
  }, [posterPreviewUrl]);

  const loadHolders = useCallback(async () => {
    try {
      const o = await v1Fetch<Org[]>("/organizations?type=rights_holder");
      setHolders(o);
      setRightsHolderOrgId((prev) => prev || o[0]?.id || "");
    } catch {
      setHolders([]);
    }
  }, []);

  useEffect(() => {
    void loadHolders();
  }, [loadHolders]);

  const showSeriesFields = useMemo(
    () => isSeriesLikeCatalogAssetType(assetType),
    [assetType],
  );
  const currentProductionYear = String(new Date().getFullYear());
  const showPremiereCategoryField =
    productionYear.trim() === currentProductionYear;

  const validationError = useMemo(
    () =>
      validateCatalogItemCreateInput({
        title,
        slug,
        assetType,
        rightsHolderOrgId,
        terms,
        runtime,
        episodeCount,
      }),
    [title, slug, assetType, rightsHolderOrgId, terms, runtime, episodeCount],
  );
  const [step, setStep] = useState<1 | 2 | 3>(1);

  async function createInlineRightsHolder() {
    setCreatingHolder(true);
    setErr(null);
    try {
      const org = await v1Fetch<Org>("/organizations", {
        method: "POST",
        body: JSON.stringify({
          legalName: newHolderName.trim(),
          country: newHolderCountry.trim().toUpperCase().slice(0, 2),
          type: "rights_holder",
          isResident: true,
        }),
      });
      setHolders((list) =>
        [...list, org].sort((a, b) =>
          a.legalName.localeCompare(b.legalName, "ru"),
        ),
      );
      setRightsHolderOrgId(org.id);
      setInlineHolderOpen(false);
      setNewHolderName("");
      setNewHolderCountry("KZ");
    } catch (e) {
      setErr(
        e instanceof Error ? e.message : "Не удалось создать правообладателя",
      );
    } finally {
      setCreatingHolder(false);
    }
  }

  function setTerm(i: number, patch: Partial<CatalogTermDraft>) {
    setTerms((prev) =>
      prev.map((t, j) => (j === i ? { ...t, ...patch } : t)),
    );
  }

  function togglePlatform(termIndex: number, p: string) {
    setTerms((prev) =>
      prev.map((t, j) => {
        if (j !== termIndex) return t;
        const set = new Set(t.platforms);
        if (set.has(p)) set.delete(p);
        else set.add(p);
        return { ...t, platforms: [...set] };
      }),
    );
  }

  async function submit() {
    const firstError = validateCatalogItemCreateInput({
      title,
      slug,
      assetType,
      rightsHolderOrgId,
      terms,
      runtime,
      episodeCount,
    });
    if (firstError) {
      setErr(firstError);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const slugFinal = slug.trim();
      const licenseTerms = buildLicenseTermsForApi(terms);
      const created = await v1Fetch<{ id: string }>("/catalog/items", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          slug: slugFinal,
          assetType,
          rightsHolderOrgId,
          metadata: buildCatalogItemMetadataForApi(
            assetType,
            runtime,
            episodeCount,
            {
              seasonCount,
              productionYear,
              countryOfProduction,
              contentFormat: contentFormatExtra,
              genre,
              ageRating,
              localizationNeeded,
              musicRightsStatus,
              contentTitle: localTitle,
              theatricalRelease,
              distributorLine,
              premiereCategory: showPremiereCategoryField
                ? premiereCategory
                : undefined,
            },
          ),
          licenseTerms,
        }),
      });
      if (posterFile) {
        const fd = new FormData();
        fd.append("file", posterFile);
        await v1FormUpload(`/catalog/items/${created.id}/poster`, fd);
      }
      if (onCreated) {
        await onCreated(created.id);
      } else {
        router.push(`/content/${created.id}`);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка создания");
    } finally {
      setLoading(false);
    }
  }

  const isEmbedded = layout === "embedded";
  const stepError = useMemo(() => {
    if (step === 1) {
      if (!title.trim()) return "Введите название";
      if (!slug.trim()) return "Введите slug";
      if (!assetType.trim()) return "Выберите тип актива";
      if (!runtime.trim()) return "Укажите хронометраж";
      if (showSeriesFields && !episodeCount.trim()) {
        return "Для сериалов укажите количество серий";
      }
      return null;
    }
    if (step === 2) {
      if (!rightsHolderOrgId) return "Выберите правообладателя";
      return null;
    }
    if (step === 3) {
      return validationError;
    }
    return null;
  }, [
    step,
    title,
    slug,
    assetType,
    runtime,
    showSeriesFields,
    episodeCount,
    rightsHolderOrgId,
    validationError,
  ]);

  function nextStep() {
    if (stepError) {
      setErr(stepError);
      return;
    }
    setErr(null);
    setStep((prev) => (prev < 3 ? ((prev + 1) as 1 | 2 | 3) : prev));
  }

  function prevStep() {
    setErr(null);
    setStep((prev) => (prev > 1 ? ((prev - 1) as 1 | 2 | 3) : prev));
  }

  return (
    <div
      className={cn(
        isEmbedded ? "space-y-4 max-w-none" : "space-y-8 max-w-3xl",
      )}
    >
      {!isEmbedded ? (
        <div>
          <Link
            href="/content"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Каталог
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Новая единица каталога</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Обязательны название, slug, тип, хронометраж; для сериалов,
            анимационных и аниме-сериалов — число серий; правообладатель,
            опционально постер и лицензионные сроки.
          </p>
        </div>
      ) : null}

      {err && (
        <p className="text-sm text-destructive whitespace-pre-wrap">{err}</p>
      )}

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                  step === s
                    ? "bg-primary text-primary-foreground"
                    : step > s
                      ? "bg-emerald-600 text-white"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {s}
              </div>
              <span className={cn("text-xs", step === s ? "text-foreground" : "text-muted-foreground")}>
                {s === 1 ? "Основное" : s === 2 ? "Метаданные" : "Права"}
              </span>
              {s < 3 ? <div className="h-px w-6 bg-border" /> : null}
            </div>
          ))}
        </div>

        {step === 1 ? (
          <div className="space-y-4">
            <div>
              <Label>Название</Label>
              <Input
                className="mt-1"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Например, Пакет документальных фильмов 2025"
              />
            </div>
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-[200px]">
                <Label>Slug (уникальный)</Label>
                <Input
                  className="mt-1"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="doc-pack-2025"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mb-0.5"
                onClick={() => setSlug(suggestCatalogSlug(title))}
              >
                Из названия
              </Button>
            </div>
            <div>
              <Label>Тип актива</Label>
              <select
                className="mt-1 w-full rounded-md border border-border/50 bg-input-background px-3 py-2 text-sm"
                value={assetType}
                onChange={(e) => setAssetType(e.target.value)}
              >
                {CATALOG_ASSET_TYPES.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
            {showSeriesFields ? (
              <div>
                <Label>Количество серий</Label>
                <Input
                  className="mt-1"
                  inputMode="numeric"
                  autoComplete="off"
                  value={episodeCount}
                  onChange={(e) => setEpisodeCount(e.target.value.replace(/\D/g, ""))}
                  placeholder="Например, 12"
                />
              </div>
            ) : null}
            <div>
              <Label>Хронометраж</Label>
              <p className="text-xs text-muted-foreground mt-0.5 mb-1">
                Для всех типов: длительность выпуска или серии (как принято в договоре).
              </p>
              <Input
                className="mt-1"
                value={runtime}
                onChange={(e) => setRuntime(e.target.value)}
                placeholder="Например: 98 мин; 45 мин/серия; 12×45 мин"
              />
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Поля ниже сохраняются в карточке каталога и подставляются в оффер при выборе этого тайтла.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {showSeriesFields ? (
                <div>
                  <Label>Количество сезонов</Label>
                  <Input
                    className="mt-1"
                    inputMode="numeric"
                    autoComplete="off"
                    value={seasonCount}
                    onChange={(e) => setSeasonCount(e.target.value.replace(/\D/g, ""))}
                    placeholder="Например, 1"
                  />
                </div>
              ) : null}
              <div>
                <Label>Год производства</Label>
                <Input className="mt-1" value={productionYear} onChange={(e) => setProductionYear(e.target.value)} placeholder="2025" />
              </div>
              <div>
                <Label>Страна производства</Label>
                <Input className="mt-1" value={countryOfProduction} onChange={(e) => setCountryOfProduction(e.target.value)} placeholder="Например, Казахстан" />
              </div>
              <div>
                <Label>Формат (текст для оффера)</Label>
                <Input className="mt-1" value={contentFormatExtra} onChange={(e) => setContentFormatExtra(e.target.value)} placeholder="Иначе подставится тип актива из поля выше" />
              </div>
              <div>
                <Label>Локальное название</Label>
                <Input className="mt-1" value={localTitle} onChange={(e) => setLocalTitle(e.target.value)} placeholder="Если пусто, будет равно оригинальному" />
              </div>
              <div>
                <Label>Жанр</Label>
                <Input className="mt-1" value={genre} onChange={(e) => setGenre(e.target.value)} />
              </div>
              <div>
                <Label>Возрастной рейтинг</Label>
                <Input className="mt-1" value={ageRating} onChange={(e) => setAgeRating(e.target.value)} placeholder="Например, 16+" />
              </div>
              <div>
                <Label>Нужна локализация</Label>
                <select className="mt-1 w-full rounded-md border border-border/50 bg-input-background px-3 py-2 text-sm" value={localizationNeeded} onChange={(e) => setLocalizationNeeded(e.target.value)}>
                  <option value="Да">Да</option>
                  <option value="Нет">Нет</option>
                </select>
              </div>
              <div>
                <Label>Статус муз. прав</Label>
                <Input className="mt-1" value={musicRightsStatus} onChange={(e) => setMusicRightsStatus(e.target.value)} placeholder="Например, Подтверждён" />
              </div>
              <div>
                <Label>Статус цепочки прав</Label>
                <Input className="mt-1" value="Не загружены" disabled />
              </div>
              {showPremiereCategoryField ? (
                <div>
                  <Label>Категория фильма (премьера)</Label>
                  <select className="mt-1 w-full rounded-md border border-border/50 bg-input-background px-3 py-2 text-sm" value={premiereCategory} onChange={(e) => setPremiereCategory(e.target.value)}>
                    {CATALOG_PREMIERE_CATEGORIES.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div className="sm:col-span-2">
                <Label>Кинотеатральный релиз</Label>
                <Input className="mt-1" value={theatricalRelease} onChange={(e) => setTheatricalRelease(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Label>Дистрибьютор (необязательно)</Label>
                <Input className="mt-1" value={distributorLine} onChange={(e) => setDistributorLine(e.target.value)} placeholder='По умолчанию в оффере: ТОО «Growix Content Group»' />
              </div>
            </div>
            <div>
              <Label>Правообладатель</Label>
              <select
                className="mt-1 w-full rounded-md border border-border/50 bg-input-background px-3 py-2 text-sm"
                value={rightsHolderOrgId}
                onChange={(e) => setRightsHolderOrgId(e.target.value)}
              >
                {holders.length === 0 ? (
                  <option value="">— выберите или создайте —</option>
                ) : null}
                {holders.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.legalName}
                  </option>
                ))}
              </select>
              {holders.length === 0 && !inlineHolderOpen ? (
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                  В списке нет правообладателей — создайте организацию ниже.
                </p>
              ) : null}
              {!inlineHolderOpen ? (
                <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => setInlineHolderOpen(true)}>
                  + Новый правообладатель
                </Button>
              ) : (
                <div className="mt-2 space-y-2 rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">
                    Организация с типом «правообладатель» (rights_holder).
                  </p>
                  <Input placeholder="Юридическое название" value={newHolderName} onChange={(e) => setNewHolderName(e.target.value)} />
                  <Input placeholder="Страна (ISO2)" value={newHolderCountry} onChange={(e) => setNewHolderCountry(e.target.value)} maxLength={2} />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void createInlineRightsHolder()}
                      disabled={creatingHolder || !newHolderName.trim() || !newHolderCountry.trim()}
                    >
                      {creatingHolder ? "Создание…" : "Создать правообладателя"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setInlineHolderOpen(false);
                        setNewHolderName("");
                        setNewHolderCountry("KZ");
                      }}
                    >
                      Отмена
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <div>
              <Label>Постер (обложка)</Label>
              <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                JPEG, PNG, GIF или WebP, до ~12 МБ. Отображается в каталоге и на странице контента.
              </p>
              <Input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="mt-1 cursor-pointer"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  setPosterFile(f ?? null);
                }}
              />
              {posterPreviewUrl ? (
                <div className="mt-3 rounded-lg border border-border overflow-hidden max-w-xs aspect-[2/3] bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={posterPreviewUrl}
                    alt="Предпросмотр постера"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : null}
              {posterFile ? (
                <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => setPosterFile(null)}>
                  Убрать файл
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Лицензионные сроки</h2>
            {terms.map((term, i) => (
              <div
                key={i}
                className="rounded-xl border border-border bg-card p-4 space-y-3"
              >
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Строка {i + 1}</span>
                  {terms.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() =>
                        setTerms((prev) => prev.filter((_, j) => j !== i))
                      }
                    >
                      Удалить
                    </Button>
                  ) : null}
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Территория (код)</Label>
                    <Input className="mt-1" value={term.territoryCode} onChange={(e) => setTerm(i, { territoryCode: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Формат лицензии</Label>
                    <select className="mt-1 w-full rounded-md border border-border/50 bg-input-background px-2 py-2 text-sm" value={term.exclusivity} onChange={(e) => setTerm(i, { exclusivity: e.target.value })}>
                      {CATALOG_EXCLUSIVITY.map((x) => (
                        <option key={x.value} value={x.value}>
                          {x.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Платформы</Label>
                  <div className="flex flex-wrap gap-3 mt-2">
                    {CATALOG_PLATFORM_OPTIONS.map(({ value, label }) => (
                      <label key={value} className="flex items-center gap-1.5 text-sm">
                        <Checkbox
                          checked={term.platforms.includes(value)}
                          onCheckedChange={() => togglePlatform(i, value)}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Длительность (лет), опц.</Label>
                    <Input className="mt-1" type="text" inputMode="decimal" value={term.durationYears} onChange={(e) => setTerm(i, { durationYears: e.target.value })} placeholder="2" />
                  </div>
                  <div>
                    <Label className="text-xs">Языки (через запятую)</Label>
                    <Input className="mt-1" value={term.languageRights} onChange={(e) => setTerm(i, { languageRights: e.target.value })} placeholder="original, sub_ru" />
                  </div>
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={() => setTerms((prev) => [...prev, defaultCatalogTerm()])}>
              + Добавить строку лицензии
            </Button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {step > 1 ? (
          <Button type="button" variant="outline" onClick={prevStep}>
            Назад
          </Button>
        ) : null}
        {step < 3 ? (
          <Button type="button" onClick={nextStep}>
            Далее
          </Button>
        ) : (
          <Button
            type="button"
            onClick={() => void submit()}
            disabled={loading || validationError !== null}
            title={validationError ?? undefined}
          >
            {loading ? "Создание…" : submitLabel}
          </Button>
        )}
        {isEmbedded && onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            Отмена
          </Button>
        ) : !isEmbedded ? (
          <Button type="button" variant="outline" asChild>
            <Link href="/content">Отмена</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
