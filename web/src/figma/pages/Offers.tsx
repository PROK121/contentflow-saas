"use client";

import { motion } from "motion/react";
import {
  Archive,
  ArchiveRestore,
  Download,
  Eye,
  FilePenLine,
  FileStack,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { v1DownloadFile, v1Fetch, v1GetBlob } from "@/lib/v1-client";
import { formatMoneyAmountOrEmpty } from "@/lib/format-money";
import {
  catalogToOfferContentFields,
  OFFER_DEFAULT_LICENSE_TERM,
} from "@/lib/catalog-item-create";
import {
  DEAL_TERRITORY_PRESETS,
  formatDealTerritoryCodes,
} from "@/lib/deal-territory-presets";
import { isAdminDeleteEmail } from "@/lib/admin-delete-email";
import { Button } from "@/figma/components/ui/button";
import { Checkbox } from "@/figma/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/figma/components/ui/dialog";
import { Label } from "@/figma/components/ui/label";
import { Textarea } from "@/figma/components/ui/textarea";

const SEQUEL_DEFAULT =
  "Приоритетное право на приобретение прав на продолжение франшизы, спин-оффов (все связанные по сюжету истории). А также новые премьерные фильмы правообладателя.";

type ApiDealBuyer = {
  id: string;
  buyerOrgId: string;
  buyer: { legalName: string };
};

type OfferTemplateKind = "po" | "platforms";

type CommercialOfferRow = {
  id: string;
  title: string;
  storageKey: string;
  archived?: boolean;
  createdAt: string;
  clientLegalName?: string;
  templateKind?: OfferTemplateKind;
  clientSigned?: boolean;
  signedAt?: string | null;
  sourceOfferId?: string | null;
};

type DealClientOption = { buyerOrgId: string; legalName: string };
type DealPaymentPreviewLite = { net: string };

type CatalogPickRow = {
  id: string;
  title: string;
  assetType: string;
  status: string;
  metadata?: unknown;
  rightsHolder: { legalName: string };
  licenseTerms?: Array<{
    territoryCode: string;
    exclusivity?: string;
    startAt: string | null;
    endAt: string | null;
    durationMonths: number | null;
  }>;
};

type OfferFormState = {
  buyerOrgId: string;
  offerDate: string;
  workTitle: string;
  distributorLine: string;
  contentTitle: string;
  productionYear: string;
  contentFormat: string;
  genre: string;
  seriesCount: string;
  runtime: string;
  theatricalRelease: string;
  rightsHolder: string;
  contentLanguage: string;
  exclusivity: "exclusive" | "co_exclusive" | "non_exclusive";
  territory: string;
  localization: string;
  materialsNote: string;
  promoSupport: boolean;
  catalogInclusion: boolean;
  contractsAdmin: boolean;
  digitization: boolean;
  licenseTerm: string;
  rightsOpeningProcedure: string;
  remunerationKztNet: string;
  sequelFranchiseTerms: string;
  paymentSchedule: string;
  offerValidityDays: string;
  signatoryPlaceholder: string;
};

function defaultOfferForm(): OfferFormState {
  const today = new Date().toISOString().slice(0, 10);
  return {
    buyerOrgId: "",
    offerDate: today,
    workTitle: "",
    distributorLine: "",
    contentTitle: "",
    productionYear: "",
    contentFormat: "",
    genre: "",
    seriesCount: "",
    runtime: "",
    theatricalRelease: "",
    rightsHolder: "",
    contentLanguage: "",
    exclusivity: "exclusive",
    territory: "",
    localization: "Языки/Форматы (дубляж / voice-over / субтитры)",
    materialsNote: "",
    promoSupport: false,
    catalogInclusion: false,
    contractsAdmin: false,
    digitization: false,
    licenseTerm: OFFER_DEFAULT_LICENSE_TERM,
    rightsOpeningProcedure: "",
    remunerationKztNet: "",
    sequelFranchiseTerms: SEQUEL_DEFAULT,
    paymentSchedule:
      "50% по факту подписания договора / 50% по факту публикации на Сервисах партнеров",
    offerValidityDays: "7",
    signatoryPlaceholder: "",
  };
}

function parseOfferTerritoryCodes(value: string): string[] {
  const byLabel = new Map<string, string>(
    DEAL_TERRITORY_PRESETS.map((p) => [p.label, p.code]),
  );
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((token) => {
      const upper = token.toUpperCase();
      if (DEAL_TERRITORY_PRESETS.some((p) => p.code === upper)) return upper;
      return byLabel.get(token) ?? "";
    })
    .filter(Boolean);
}

async function fetchLatestDealNetForBuyer(
  buyerOrgId: string,
): Promise<string | null> {
  const deals = await v1Fetch<ApiDealBuyer[]>(
    `/deals?buyerOrgId=${encodeURIComponent(buyerOrgId)}&limit=1`,
  );
  const latest = deals[0];
  if (!latest?.id) return null;
  const preview = await v1Fetch<DealPaymentPreviewLite>(
    `/deals/${latest.id}/payment-preview`,
  );
  return typeof preview.net === "string" && preview.net.trim()
    ? preview.net
    : null;
}

function deriveOfferExclusivityFromCatalog(
  row: CatalogPickRow | undefined,
): OfferFormState["exclusivity"] | null {
  if (!row?.licenseTerms?.length) return null;
  const values = row.licenseTerms
    .map((t) => String(t.exclusivity ?? "").trim())
    .filter(Boolean);
  if (values.includes("exclusive")) return "exclusive";
  if (values.includes("co_exclusive")) return "co_exclusive";
  if (values.includes("non_exclusive")) return "non_exclusive";
  return null;
}

export function Offers() {
  const [searchQuery, setSearchQuery] = useState("");
  const [offersTab, setOffersTab] = useState<"active" | "signed" | "archive">(
    "active",
  );
  const [offers, setOffers] = useState<CommercialOfferRow[]>([]);
  const [offersLoading, setOffersLoading] = useState(true);
  const [archiveBusyId, setArchiveBusyId] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [deleteOfferBusyId, setDeleteOfferBusyId] = useState<string | null>(null);
  const canAdminDelete = isAdminDeleteEmail(authEmail);
  const [dealClients, setDealClients] = useState<DealClientOption[]>([]);
  const [catalogPickList, setCatalogPickList] = useState<CatalogPickRow[]>([]);
  const [offerCatalogItemId, setOfferCatalogItemId] = useState("");
  const [offerDialogOpen, setOfferDialogOpen] = useState(false);
  const [offerTemplateKind, setOfferTemplateKind] = useState<OfferTemplateKind>("po");
  const [offerForm, setOfferForm] = useState<OfferFormState>(() => defaultOfferForm());
  const [offerSubmitting, setOfferSubmitting] = useState(false);
  const [offerError, setOfferError] = useState<string | null>(null);
  const [offerDownloadId, setOfferDownloadId] = useState<string | null>(null);
  const [offerDownloadError, setOfferDownloadError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTitle, setPreviewTitle] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewLoadingOfferId, setPreviewLoadingOfferId] = useState<string | null>(
    null,
  );
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewAbortRef = useRef<AbortController | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const revokePreviewUrl = useCallback((url: string | null) => {
    if (url) URL.revokeObjectURL(url);
  }, []);

  const closePreview = useCallback(() => {
    previewAbortRef.current?.abort();
    previewAbortRef.current = null;
    setPreviewOpen(false);
    setPreviewTitle("");
    setPreviewError(null);
    setPreviewLoading(false);
    setPreviewLoadingOfferId(null);
    revokePreviewUrl(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreviewUrl(null);
  }, [revokePreviewUrl]);

  const openPreview = async (o: CommercialOfferRow) => {
    previewAbortRef.current?.abort();
    const ac = new AbortController();
    previewAbortRef.current = ac;
    setPreviewError(null);
    setPreviewTitle(o.title);
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewLoadingOfferId(o.id);
    revokePreviewUrl(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreviewUrl(null);
    try {
      const blob = await v1GetBlob(`/commercial-offers/${o.id}/document`, {
        signal: ac.signal,
      });
      if (ac.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      previewUrlRef.current = url;
      setPreviewUrl(url);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setPreviewError(
        e instanceof Error ? e.message : "Не удалось загрузить предпросмотр",
      );
    } finally {
      if (!ac.signal.aborted) {
        setPreviewLoading(false);
        setPreviewLoadingOfferId(null);
      }
    }
  };

  useEffect(() => {
    return () => {
      previewAbortRef.current?.abort();
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  const loadOffers = useCallback(async () => {
    setOffersLoading(true);
    try {
      const q =
        offersTab === "archive"
          ? "?archivedOnly=true"
          : offersTab === "signed"
            ? "?signedOnly=true"
            : "";
      const rows = await v1Fetch<CommercialOfferRow[]>(
        `/commercial-offers${q}`,
      );
      setOffers(rows);
    } catch {
      setOffers([]);
    } finally {
      setOffersLoading(false);
    }
  }, [offersTab]);

  useEffect(() => {
    void loadOffers();
  }, [loadOffers]);

  useEffect(() => {
    void v1Fetch<{ user: { email: string } }>("/auth/me")
      .then((r) => setAuthEmail(r.user.email))
      .catch(() => setAuthEmail(null));
  }, []);

  const loadDealClients = useCallback(async () => {
    try {
      const deals = await v1Fetch<ApiDealBuyer[]>("/deals");
      const byOrg = new Map<string, string>();
      for (const d of deals) {
        const name = d.buyer?.legalName?.trim();
        if (d.buyerOrgId && name && !byOrg.has(d.buyerOrgId)) {
          byOrg.set(d.buyerOrgId, name);
        }
      }
      const opts = [...byOrg.entries()]
        .map(([buyerOrgId, legalName]) => ({ buyerOrgId, legalName }))
        .sort((a, b) => a.legalName.localeCompare(b.legalName, "ru"));
      setDealClients(opts);
    } catch {
      setDealClients([]);
    }
  }, []);

  useEffect(() => {
    void loadDealClients();
  }, [loadDealClients]);

  useEffect(() => {
    void v1Fetch<CatalogPickRow[]>("/catalog/items")
      .then((rows) =>
        setCatalogPickList(
          rows
            .filter((r) => r.status !== "archived")
            .sort((a, b) => a.title.localeCompare(b.title, "ru")),
        ),
      )
      .catch(() => setCatalogPickList([]));
  }, []);

  const submitOffer = async () => {
    setOfferError(null);
    setOfferSubmitting(true);
    try {
      const validity = Number.parseInt(offerForm.offerValidityDays, 10);
      const body: Record<string, unknown> = {
        buyerOrgId: offerForm.buyerOrgId,
        offerDate: offerForm.offerDate,
        workTitle: offerForm.workTitle.trim(),
        contentTitle: offerForm.contentTitle.trim(),
        productionYear: offerForm.productionYear.trim(),
        contentFormat: offerForm.contentFormat.trim(),
        genre: offerForm.genre.trim(),
        seriesCount: offerForm.seriesCount.trim(),
        runtime: offerForm.runtime.trim(),
        theatricalRelease: offerForm.theatricalRelease.trim(),
        rightsHolder: offerForm.rightsHolder.trim(),
        contentLanguage: offerForm.contentLanguage.trim(),
        exclusivity: offerForm.exclusivity,
        rightsOpeningProcedure: offerForm.rightsOpeningProcedure.trim(),
        remunerationKztNet: offerForm.remunerationKztNet.trim(),
        paymentSchedule: offerForm.paymentSchedule.trim(),
        promoSupport: offerForm.promoSupport,
        catalogInclusion: offerForm.catalogInclusion,
        contractsAdmin: offerForm.contractsAdmin,
        digitization: offerForm.digitization,
      };
      if (offerForm.distributorLine.trim()) {
        body.distributorLine = offerForm.distributorLine.trim();
      }
      if (offerForm.territory.trim()) body.territory = offerForm.territory.trim();
      if (offerForm.localization.trim()) body.localization = offerForm.localization.trim();
      if (offerForm.materialsNote.trim()) body.materialsNote = offerForm.materialsNote.trim();
      if (offerForm.licenseTerm.trim()) body.licenseTerm = offerForm.licenseTerm.trim();
      if (offerForm.sequelFranchiseTerms.trim()) {
        body.sequelFranchiseTerms = offerForm.sequelFranchiseTerms.trim();
      }
      if (offerForm.signatoryPlaceholder.trim()) {
        body.signatoryPlaceholder = offerForm.signatoryPlaceholder.trim();
      }
      if (Number.isFinite(validity) && validity > 0) {
        body.offerValidityDays = validity;
      }
      body.templateKind = offerTemplateKind;
      await v1Fetch("/commercial-offers", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setOfferDialogOpen(false);
      setOfferCatalogItemId("");
      setOfferForm(defaultOfferForm());
      await loadOffers();
    } catch (e) {
      setOfferError(e instanceof Error ? e.message : "Не удалось создать оффер");
    } finally {
      setOfferSubmitting(false);
    }
  };

  const fieldClass =
    "w-full rounded-md border border-border/50 bg-input-background px-3 py-2 text-sm focus:outline-none focus-visible:border-ring/80 focus-visible:ring-2 focus-visible:ring-ring/25";

  async function deleteOfferForever(id: string) {
    if (
      !window.confirm(
        "Удалить оффер безвозвратно вместе с файлом? Действие необратимо.",
      )
    ) {
      return;
    }
    setDeleteOfferBusyId(id);
    try {
      await v1Fetch(`/commercial-offers/${id}`, { method: "DELETE" });
      await loadOffers();
    } catch (e) {
      setOfferDownloadError(
        e instanceof Error ? e.message : "Не удалось удалить",
      );
    } finally {
      setDeleteOfferBusyId(null);
    }
  }

  const filteredOffers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return offers;
    return offers.filter(
      (o) =>
        o.title.toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q) ||
        (o.clientLegalName?.toLowerCase().includes(q) ?? false),
    );
  }, [offers, searchQuery]);
  const selectedOfferTerritoryCodes = useMemo(
    () => parseOfferTerritoryCodes(offerForm.territory),
    [offerForm.territory],
  );

  const toggleOfferTerritory = useCallback((code: string) => {
    setOfferForm((prev) => {
      const selected = new Set(parseOfferTerritoryCodes(prev.territory));
      if (selected.has(code)) selected.delete(code);
      else selected.add(code);
      const next = DEAL_TERRITORY_PRESETS
        .map((p) => p.code)
        .filter((c) => selected.has(c));
      return {
        ...prev,
        territory: next.length ? formatDealTerritoryCodes(next) : "",
      };
    });
  }, []);

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">Офферы</h1>
          <p className="text-sm text-muted-foreground">
            Коммерческие предложения в PDF: оффер для ПО или оффер для площадок.
            Подписанные экземпляры из кабинета клиента — во вкладке «Подписанные
            офферы».
          </p>
        </div>
        <div className="flex flex-row flex-nowrap items-center gap-2 shrink-0">
          <button
            type="button"
            className="flex shrink-0 items-center gap-2 whitespace-nowrap px-4 py-2.5 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors text-sm font-semibold shadow-sm"
            onClick={() => {
              setOfferTemplateKind("po");
              setOfferError(null);
              setOfferCatalogItemId("");
              setOfferForm(defaultOfferForm());
              void loadDealClients();
              setOfferDialogOpen(true);
            }}
          >
            <Plus size={18} strokeWidth={2.5} />
            <span>Создать оффер для ПО</span>
          </button>
          <button
            type="button"
            className="flex shrink-0 items-center gap-2 whitespace-nowrap px-4 py-2.5 border border-border bg-card text-foreground rounded hover:bg-muted/40 transition-colors text-sm font-semibold shadow-sm"
            onClick={() => {
              setOfferTemplateKind("platforms");
              setOfferError(null);
              setOfferCatalogItemId("");
              setOfferForm(defaultOfferForm());
              void loadDealClients();
              setOfferDialogOpen(true);
            }}
          >
            <Plus size={18} strokeWidth={2.5} />
            <span>Создать оффер для Площадок</span>
          </button>
        </div>
      </motion.div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setOffersTab("active")}
          className={`px-4 py-2 rounded font-semibold transition-all text-sm ${
            offersTab === "active"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted/50 border border-border hover:bg-muted/30"
          }`}
        >
          Активные
          {offersTab === "active" ? (
            <span className="ml-2 px-2 py-0.5 rounded-full bg-current/20 text-xs font-bold">
              {offers.length}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          onClick={() => setOffersTab("signed")}
          className={`px-4 py-2 rounded font-semibold transition-all text-sm ${
            offersTab === "signed"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted/50 border border-border hover:bg-muted/30"
          }`}
        >
          Подписанные офферы
          {offersTab === "signed" ? (
            <span className="ml-2 px-2 py-0.5 rounded-full bg-current/20 text-xs font-bold">
              {offers.length}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          onClick={() => setOffersTab("archive")}
          className={`px-4 py-2 rounded font-semibold transition-all text-sm ${
            offersTab === "archive"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted/50 border border-border hover:bg-muted/30"
          }`}
        >
          Архив
          {offersTab === "archive" ? (
            <span className="ml-2 px-2 py-0.5 rounded-full bg-current/20 text-xs font-bold">
              {offers.length}
            </span>
          ) : null}
        </button>
      </div>

      <div className="relative">
               <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          size={18}
        />
        <input
          type="text"
          placeholder="Поиск по названию, клиенту или ID…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-md border border-border/50 bg-input-background pl-10 pr-4 py-2.5 text-sm focus:outline-none focus-visible:border-ring/80 focus-visible:ring-2 focus-visible:ring-ring/25"
        />
      </div>

      {offersLoading ? (
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      ) : filteredOffers.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {offers.length === 0
            ? offersTab === "archive"
              ? "В архиве пока пусто."
              : offersTab === "signed"
                ? "Здесь появятся подписанные офферы, которые клиент прикрепит в личном кабинете. Кабинет клиента подключается позже — список пока пуст."
                : "Пока нет офферов. Создайте документ кнопкой «Создать оффер для ПО» или «Создать оффер для Площадок»."
            : "Ничего не найдено по запросу."}
        </p>
      ) : (
        <div className="space-y-4">
          {offerDownloadError ? (
            <p className="text-sm text-destructive">{offerDownloadError}</p>
          ) : null}
          <div className="flex justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => void loadOffers()}>
              Обновить список
            </Button>
          </div>
          {filteredOffers.map((o, index) => (
            <motion.div
              key={o.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="rounded-lg bg-card border border-border p-5 hover:shadow-md transition-all duration-300"
            >
              <div className="flex flex-col lg:flex-row lg:items-center gap-5">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {offersTab === "signed" || o.clientSigned ? (
                      <FilePenLine size={18} className="text-primary" strokeWidth={2.5} />
                    ) : (
                      <FileStack size={18} className="text-muted-foreground" strokeWidth={2.5} />
                    )}
                    <span
                      className="text-xs font-bold text-muted-foreground"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {o.id.slice(0, 8)}…
                    </span>
                    {offersTab === "signed" || o.clientSigned ? (
                      <span className="text-[10px] font-bold uppercase tracking-wide rounded bg-primary/15 text-primary px-2 py-0.5 ring-1 ring-primary/25">
                        Подписанный · кабинет клиента
                      </span>
                    ) : null}
                  </div>
                  <h3 className="text-base font-bold text-foreground">{o.title}</h3>
                  {o.clientLegalName ? (
                    <p className="text-sm font-medium text-foreground">
                      Клиент: {o.clientLegalName}
                    </p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    {o.clientSigned || offersTab === "signed"
                      ? "Файл от клиента"
                      : o.templateKind === "platforms"
                        ? "Оффер для площадок"
                        : "Оффер для ПО"}
                  </p>
                  {o.sourceOfferId ? (
                    <p className="text-xs text-muted-foreground">
                      Исходный оффер в CRM:{" "}
                      <span className="font-mono">{o.sourceOfferId.slice(0, 8)}…</span>
                    </p>
                  ) : null}
                  <p className="text-sm text-muted-foreground">
                    Создан: {new Date(o.createdAt).toLocaleString("ru-RU")}
                    {o.signedAt ? (
                      <>
                        {" · "}
                        Подпись получена:{" "}
                        {new Date(o.signedAt).toLocaleString("ru-RU")}
                      </>
                    ) : null}
                  </p>
                </div>
                <div className="flex flex-wrap lg:flex-col gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2 font-bold"
                    disabled={previewLoadingOfferId === o.id}
                    onClick={() => void openPreview(o)}
                  >
                    <Eye size={14} strokeWidth={2.5} />
                    {previewLoadingOfferId === o.id ? "Загрузка…" : "Просмотр"}
                  </Button>
                  {offersTab === "active" || offersTab === "signed" ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2 font-bold"
                      disabled={archiveBusyId === o.id}
                      onClick={() => {
                        setArchiveBusyId(o.id);
                        void v1Fetch(`/commercial-offers/${o.id}`, {
                          method: "PATCH",
                          body: JSON.stringify({ archived: true }),
                        })
                          .then(() => loadOffers())
                          .finally(() => setArchiveBusyId(null));
                      }}
                    >
                      <Archive size={14} strokeWidth={2.5} />
                      {archiveBusyId === o.id ? "…" : "В архив"}
                    </Button>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        className="gap-2 font-bold"
                        disabled={archiveBusyId === o.id}
                        onClick={() => {
                          setArchiveBusyId(o.id);
                          void v1Fetch(`/commercial-offers/${o.id}`, {
                            method: "PATCH",
                            body: JSON.stringify({ archived: false }),
                          })
                            .then(() => loadOffers())
                            .finally(() => setArchiveBusyId(null));
                        }}
                      >
                        <ArchiveRestore size={14} strokeWidth={2.5} />
                        {archiveBusyId === o.id ? "…" : "Вернуть"}
                      </Button>
                      {canAdminDelete ? (
                        <Button
                          type="button"
                          variant="destructive"
                          className="gap-2 font-bold"
                          disabled={deleteOfferBusyId === o.id}
                          onClick={() => void deleteOfferForever(o.id)}
                        >
                          <Trash2 size={14} strokeWidth={2.5} />
                          {deleteOfferBusyId === o.id ? "…" : "Удалить"}
                        </Button>
                      ) : null}
                    </>
                  )}
                  <Button
                    type="button"
                    className="gap-2 font-bold"
                    disabled={offerDownloadId === o.id}
                    onClick={() => {
                      setOfferDownloadError(null);
                      setOfferDownloadId(o.id);
                      const safe = `${o.title.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 80) || "offer"}-${o.id.slice(0, 8)}.pdf`;
                      void v1DownloadFile(`/commercial-offers/${o.id}/document`, safe)
                        .catch((e) => {
                          setOfferDownloadError(
                            e instanceof Error ? e.message : "Не удалось скачать файл",
                          );
                        })
                        .finally(() => setOfferDownloadId(null));
                    }}
                  >
                    <Download size={14} strokeWidth={2.5} />
                    {offerDownloadId === o.id ? "Скачивание…" : "Скачать PDF"}
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <Dialog
        open={previewOpen}
        onOpenChange={(open) => {
          if (!open) closePreview();
        }}
      >
        <DialogContent className="flex max-h-[min(92vh,900px)] w-[min(96vw,56rem)] flex-col gap-0 p-0 sm:max-w-4xl">
          <DialogHeader className="shrink-0 space-y-1 border-b border-border px-6 py-4 text-left">
            <DialogTitle>Предпросмотр оффера</DialogTitle>
            <DialogDescription className="truncate" title={previewTitle}>
              {previewTitle || "—"}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-[min(75vh,720px)] flex-1 bg-muted/30">
            {previewLoading ? (
              <div className="flex h-[min(75vh,720px)] items-center justify-center text-sm text-muted-foreground">
                Загрузка PDF…
              </div>
            ) : previewError ? (
              <div className="flex h-[min(75vh,720px)] items-center justify-center px-6 text-center text-sm text-destructive">
                {previewError}
              </div>
            ) : previewUrl ? (
              <iframe
                title={previewTitle}
                src={previewUrl}
                className="h-[min(75vh,720px)] w-full border-0 bg-background"
              />
            ) : (
              <div className="flex h-[min(75vh,720px)] items-center justify-center text-sm text-muted-foreground">
                Нет данных для отображения
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={offerDialogOpen} onOpenChange={setOfferDialogOpen}>
        <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {offerTemplateKind === "platforms"
                ? "Создать оффер для Площадок"
                : "Создать оффер для ПО"}
            </DialogTitle>
            <DialogDescription>
              {offerTemplateKind === "platforms"
                ? "Оффер для площадок: те же поля, что и для ПО. После сохранения PDF появится в списке."
                : "Оффер для ПО. После сохранения PDF появится в списке."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="offerDate">Дата</Label>
              <input
                id="offerDate"
                type="date"
                className={fieldClass}
                value={offerForm.offerDate}
                onChange={(e) => setOfferForm((s) => ({ ...s, offerDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="buyerOrgId">Клиент</Label>
              <select
                id="buyerOrgId"
                className={fieldClass}
                value={offerForm.buyerOrgId}
                onChange={(e) => {
                  const buyerOrgId = e.target.value;
                  setOfferForm((s) => ({ ...s, buyerOrgId }));
                  if (!buyerOrgId) {
                    setOfferForm((s) => ({ ...s, remunerationKztNet: "" }));
                    return;
                  }
                  void fetchLatestDealNetForBuyer(buyerOrgId)
                    .then((net) => {
                      if (!net) return;
                      setOfferForm((s) => {
                        if (s.buyerOrgId !== buyerOrgId) return s;
                        return {
                          ...s,
                          remunerationKztNet: formatMoneyAmountOrEmpty(net),
                        };
                      });
                    })
                    .catch(() => {
                      // Если не удалось подтянуть NET, оставляем ручной ввод.
                    });
                }}
              >
                <option value="">Выберите клиента…</option>
                {dealClients.map((c) => (
                  <option key={c.buyerOrgId} value={c.buyerOrgId}>
                    {c.legalName}
                  </option>
                ))}
              </select>
              {dealClients.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Нет организаций из сделок. Создайте сделку с покупателем — тогда клиент появится
                  в этом списке.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Только организации, указанные как покупатель хотя бы в одной сделке.
                </p>
              )}
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="offerCatalogItemId">
                Название произведения («…» в шапке)
              </Label>
              <select
                id="offerCatalogItemId"
                className={fieldClass}
                value={offerCatalogItemId}
                onChange={(e) => {
                  const id = e.target.value;
                  setOfferCatalogItemId(id);
                  const row = catalogPickList.find((r) => r.id === id);
                  setOfferForm((prev) => {
                    if (!row) {
                      return {
                        ...prev,
                        workTitle: "",
                        contentTitle: "",
                        productionYear: "",
                        contentFormat: "",
                        genre: "",
                        seriesCount: "",
                        runtime: "",
                        theatricalRelease: "",
                        rightsHolder: "",
                        distributorLine: "",
                        territory: "",
                        exclusivity: "exclusive",
                        licenseTerm: OFFER_DEFAULT_LICENSE_TERM,
                      };
                    }
                    const fromCat = catalogToOfferContentFields(row);
                    const exclusivityFromCat =
                      deriveOfferExclusivityFromCatalog(row);
                    return {
                      ...prev,
                      ...fromCat,
                      exclusivity: exclusivityFromCat ?? prev.exclusivity,
                      contentLanguage: prev.contentLanguage.trim()
                        ? prev.contentLanguage
                        : "русский",
                    };
                  });
                }}
              >
                <option value="">Выберите тайтл из каталога контента…</option>
                {catalogPickList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Данные подтягиваются из карточки в разделе «Контент» (включая
                правообладателя). Поля ниже можно изменить вручную перед
                сохранением.
              </p>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="distributorLine">Дистрибьютор (необязательно)</Label>
              <input
                id="distributorLine"
                className={fieldClass}
                value={offerForm.distributorLine}
                onChange={(e) =>
                  setOfferForm((s) => ({ ...s, distributorLine: e.target.value }))
                }
                placeholder='По умолчанию: ТОО «Growix Content Group»'
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="contentTitle">Название (блок сведений)</Label>
              <input
                id="contentTitle"
                className={fieldClass}
                value={offerForm.contentTitle}
                onChange={(e) => setOfferForm((s) => ({ ...s, contentTitle: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="productionYear">Год производства</Label>
              <input
                id="productionYear"
                className={fieldClass}
                value={offerForm.productionYear}
                onChange={(e) =>
                  setOfferForm((s) => ({ ...s, productionYear: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="contentFormat">Формат</Label>
              <input
                id="contentFormat"
                className={fieldClass}
                value={offerForm.contentFormat}
                onChange={(e) =>
                  setOfferForm((s) => ({ ...s, contentFormat: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="genre">Жанр</Label>
              <input
                id="genre"
                className={fieldClass}
                value={offerForm.genre}
                onChange={(e) => setOfferForm((s) => ({ ...s, genre: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="seriesCount">Кол-во серий</Label>
              <input
                id="seriesCount"
                className={fieldClass}
                value={offerForm.seriesCount}
                onChange={(e) =>
                  setOfferForm((s) => ({ ...s, seriesCount: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="runtime">Хронометраж</Label>
              <input
                id="runtime"
                className={fieldClass}
                value={offerForm.runtime}
                onChange={(e) => setOfferForm((s) => ({ ...s, runtime: e.target.value }))}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="theatricalRelease">Кинотеатральный релиз</Label>
              <input
                id="theatricalRelease"
                className={fieldClass}
                value={offerForm.theatricalRelease}
                onChange={(e) =>
                  setOfferForm((s) => ({ ...s, theatricalRelease: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="rightsHolder">Правообладатель</Label>
              <input
                id="rightsHolder"
                className={fieldClass}
                value={offerForm.rightsHolder}
                onChange={(e) =>
                  setOfferForm((s) => ({ ...s, rightsHolder: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="contentLanguage">Язык</Label>
              <input
                id="contentLanguage"
                className={fieldClass}
                value={offerForm.contentLanguage}
                onChange={(e) =>
                  setOfferForm((s) => ({ ...s, contentLanguage: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="exclusivity">Формат лицензии</Label>
              <select
                id="exclusivity"
                className={fieldClass}
                value={offerForm.exclusivity}
                onChange={(e) =>
                  setOfferForm((s) => ({
                    ...s,
                    exclusivity: e.target.value as OfferFormState["exclusivity"],
                  }))
                }
              >
                <option value="exclusive">Исключительные права</option>
                <option value="co_exclusive">Ко-эксклюзив</option>
                <option value="non_exclusive">Не исключительные права</option>
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Территория (пусто — «Весь мир»)</Label>
              <div className="flex flex-wrap gap-2 rounded-md border border-border/50 bg-input-background px-3 py-2">
                {DEAL_TERRITORY_PRESETS.map((t) => (
                  <label key={t.code} className="flex items-center gap-1.5 text-xs">
                    <Checkbox
                      checked={selectedOfferTerritoryCodes.includes(t.code)}
                      onCheckedChange={() => toggleOfferTerritory(t.code)}
                    />
                    {t.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="localization">Права на локализацию</Label>
              <Textarea
                id="localization"
                className={fieldClass}
                rows={2}
                value={offerForm.localization}
                onChange={(e) =>
                  setOfferForm((s) => ({ ...s, localization: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="materialsNote">Доп. сведения по материалам (необязательно)</Label>
              <Textarea
                id="materialsNote"
                className={fieldClass}
                rows={2}
                value={offerForm.materialsNote}
                onChange={(e) =>
                  setOfferForm((s) => ({ ...s, materialsNote: e.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label>Дополнительные условия</Label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={offerForm.promoSupport}
                  onCheckedChange={(v) =>
                    setOfferForm((s) => ({ ...s, promoSupport: v === true }))
                  }
                />
                Промо поддержка
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={offerForm.catalogInclusion}
                  onCheckedChange={(v) =>
                    setOfferForm((s) => ({ ...s, catalogInclusion: v === true }))
                  }
                />
                Добавление проекта в каталог компании
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={offerForm.contractsAdmin}
                  onCheckedChange={(v) =>
                    setOfferForm((s) => ({ ...s, contractsAdmin: v === true }))
                  }
                />
                Заключение договоров, документооборот, отчётность
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={offerForm.digitization}
                  onCheckedChange={(v) =>
                    setOfferForm((s) => ({ ...s, digitization: v === true }))
                  }
                />
                Оцифровка материала
              </label>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="licenseTerm">Общий лицензионный срок</Label>
              <input
                id="licenseTerm"
                className={fieldClass}
                value={offerForm.licenseTerm}
                onChange={(e) =>
                  setOfferForm((s) => ({ ...s, licenseTerm: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="rightsOpeningProcedure">Порядок открытия прав</Label>
              <Textarea
                id="rightsOpeningProcedure"
                className={fieldClass}
                rows={3}
                value={offerForm.rightsOpeningProcedure}
                onChange={(e) =>
                  setOfferForm((s) => ({ ...s, rightsOpeningProcedure: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="remunerationKztNet">Вознаграждение правообладателя (KZT net)</Label>
              <Textarea
                id="remunerationKztNet"
                className={fieldClass}
                rows={2}
                value={offerForm.remunerationKztNet}
                onChange={(e) =>
                  setOfferForm((s) => ({ ...s, remunerationKztNet: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="sequelFranchiseTerms">Продолжения / франшиза</Label>
              <Textarea
                id="sequelFranchiseTerms"
                className={fieldClass}
                rows={3}
                value={offerForm.sequelFranchiseTerms}
                onChange={(e) =>
                  setOfferForm((s) => ({ ...s, sequelFranchiseTerms: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="paymentSchedule">График платежей</Label>
              <Textarea
                id="paymentSchedule"
                className={fieldClass}
                rows={2}
                value={offerForm.paymentSchedule}
                onChange={(e) =>
                  setOfferForm((s) => ({ ...s, paymentSchedule: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="offerValidityDays">Срок действия предложения (дней)</Label>
              <input
                id="offerValidityDays"
                type="number"
                min={1}
                className={fieldClass}
                value={offerForm.offerValidityDays}
                onChange={(e) =>
                  setOfferForm((s) => ({ ...s, offerValidityDays: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="signatoryPlaceholder">Линия подписи (необязательно)</Label>
              <input
                id="signatoryPlaceholder"
                className={fieldClass}
                value={offerForm.signatoryPlaceholder}
                onChange={(e) =>
                  setOfferForm((s) => ({ ...s, signatoryPlaceholder: e.target.value }))
                }
                placeholder="________________________"
              />
            </div>
          </div>
          {offerError ? (
            <p className="text-sm text-destructive">{offerError}</p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOfferDialogOpen(false)}
            >
              Отмена
            </Button>
            <Button
              type="button"
              disabled={
                offerSubmitting ||
                !offerForm.buyerOrgId ||
                !offerCatalogItemId ||
                !offerForm.workTitle.trim() ||
                !offerForm.contentTitle.trim() ||
                !offerForm.productionYear.trim() ||
                !offerForm.contentFormat.trim() ||
                !offerForm.genre.trim() ||
                !offerForm.seriesCount.trim() ||
                !offerForm.runtime.trim() ||
                !offerForm.theatricalRelease.trim() ||
                !offerForm.rightsHolder.trim() ||
                !offerForm.contentLanguage.trim() ||
                !offerForm.rightsOpeningProcedure.trim() ||
                !offerForm.remunerationKztNet.trim() ||
                !offerForm.paymentSchedule.trim()
              }
              onClick={() => void submitOffer()}
            >
              {offerSubmitting ? "Создание…" : "Сформировать PDF"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
