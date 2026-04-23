/**
 * Доменные типы ContentFlow (черновик для бэкенда/общих пакетов).
 * Не привязан к ORM — только контракты полей.
 */

export type Role = "admin" | "manager" | "rights_owner" | "client";

export type DealStage = "lead" | "negotiation" | "contract" | "paid";

export type AssetType =
  | "video"
  | "series"
  | "animated_series"
  | "animated_film"
  | "anime_series"
  | "anime_film"
  | "concert_show";

export type Platform = "TV" | "OTT" | "YouTube";

export type Exclusivity = "exclusive" | "non_exclusive" | "sole";

export type ContractStatus = "draft" | "signed" | "expired";

export type RoyaltyModel = "fixed" | "percent";

export type RoyaltyBase = "gross" | "net" | "collections";

export type TaskType = "contract_expiry" | "payment_due" | "renewal" | "custom";

export interface LicenseTerms {
  territoryCode: string;
  startAt?: string;
  endAt?: string;
  exclusivity: Exclusivity;
  platforms: Platform[];
  sublicensingAllowed: boolean;
  languageRights: string[];
}

export interface CatalogItem {
  id: string;
  title: string;
  slug: string;
  assetType: AssetType;
  rightsHolderOrgId: string;
  licenseTerms: LicenseTerms[];
  status: "draft" | "active" | "archived";
  /** Имя файла постера на сервере (если загружен) */
  posterFileName?: string | null;
}

export interface Deal {
  id: string;
  title: string;
  stage: DealStage;
  ownerUserId: string;
  buyerOrgId: string;
  currency: string;
  expectedCloseAt?: string;
  actualCloseAt?: string;
  catalogItemIds: string[];
  commercialSnapshot: Record<string, unknown>;
}

export interface Contract {
  id: string;
  dealId: string;
  number: string;
  status: ContractStatus;
  territory: string;
  termEndAt: string;
  amount: string;
  currency: string;
  fxRateFixed?: string;
  fxRateSource?: string;
  fxLockedAt?: string;
  rightsPayload: LicenseTerms[];
}

export interface ContractVersion {
  contractId: string;
  version: number;
  storageKey: string;
  sha256: string;
  templateId: string;
  createdAt: string;
  signedAt?: string;
}

export interface TaxProfile {
  organizationId: string;
  jurisdiction: string;
  isTaxResidentInPayerCountry: boolean;
  dtCertificatePresent: boolean;
  withholdingRateOverride?: string;
  residencyCertificateStorageKey?: string;
  validUntil?: string;
}

export interface Payout {
  id: string;
  royaltyLineId: string;
  rightsHolderOrgId: string;
  amountGross: string;
  withholdingTaxAmount: string;
  amountNet: string;
  currency: string;
  taxProfileSnapshotId: string;
}

export interface RoyaltyLine {
  id: string;
  contractId: string;
  rightsHolderOrgId: string;
  model: RoyaltyModel;
  percent?: string;
  fixedAmount?: string;
  base: RoyaltyBase;
}

export interface Task {
  id: string;
  assigneeId: string;
  dueAt: string;
  type: TaskType;
  linkedEntityType: "deal" | "contract" | "payment";
  linkedEntityId: string;
}
