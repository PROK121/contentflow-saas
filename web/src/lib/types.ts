export type DealStage =
  | "lead"
  | "negotiation"
  | "contract"
  | "paid";

export interface Deal {
  id: string;
  title: string;
  stage: DealStage;
  archived?: boolean;
  currency: string;
  buyerOrgId: string;
  ownerUserId: string;
  expectedCloseAt?: string | null;
  actualCloseAt?: string | null;
  buyer?: { legalName: string };
  owner?: { email: string };
}

export interface CatalogItem {
  id: string;
  title: string;
  slug: string;
  assetType: string;
  status: string;
  posterFileName?: string | null;
  rightsHolder?: { legalName: string };
  licenseTerms?: Array<{
    territoryCode: string;
    exclusivity: string;
    platforms: string[];
  }>;
}

export interface Contract {
  id: string;
  number: string;
  status: string;
  territory: string;
  termEndAt: string;
  amount: string;
  currency: string;
  deal?: { title: string };
}

export interface Payout {
  id: string;
  amountGross: string;
  withholdingTaxAmount: string;
  amountNet: string;
  currency: string;
  rightsHolder?: { legalName: string };
}

export interface TaskRow {
  id: string;
  title: string | null;
  status: string;
  priority: string;
  dueAt: string;
  description?: string | null;
  linkedEntityType: string;
  linkedEntityId: string;
  primaryPath?: string | null;
  linkedLabel?: string | null;
  assignee?: { email: string; displayName?: string | null };
}

export interface HealthResponse {
  status: string;
  service: string;
}
