/// Типы данных для запросов материалов. Совпадают по форме с тем, что
/// возвращает API (`/v1/holder/material-requests`, `/v1/material-requests`).

export type MaterialRequestStatus =
  | "pending"
  | "partial"
  | "complete"
  | "rejected"
  | "cancelled";

export type MaterialReviewStatus = "pending" | "approved" | "rejected";

export interface MaterialSlotDef {
  key: string;
  label: string;
  description: string;
  group: "video" | "image" | "localization" | "document";
  maxSizeBytes: number;
  allowedMimePrefixes: string[];
}

export interface MaterialUpload {
  id: string;
  slot: string;
  storedFileName: string;
  originalName: string;
  size: string;
  mimeType: string | null;
  reviewStatus: MaterialReviewStatus;
  reviewerComment: string | null;
  reviewedByUserId: string | null;
  reviewedBy?: {
    id: string;
    displayName: string | null;
    email: string;
  } | null;
  reviewedAt: string | null;
  uploadedAt: string;
}

export interface MaterialRequest {
  id: string;
  catalogItemId: string;
  organizationId: string;
  requestedSlots: string[];
  status: MaterialRequestStatus;
  dueAt: string | null;
  note: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  uploads: MaterialUpload[];
  catalogItem: {
    id: string;
    title: string;
    slug: string;
    assetType: string;
    rightsHolderOrgId: string | null;
  };
  organization: {
    id: string;
    legalName: string;
    type: string;
  };
}

export const STATUS_LABEL: Record<MaterialRequestStatus, string> = {
  pending: "Ожидает материалов",
  partial: "Часть загружена",
  complete: "Все материалы получены",
  rejected: "Отклонён",
  cancelled: "Отменён",
};

export const STATUS_TONE: Record<MaterialRequestStatus, string> = {
  pending: "bg-amber-50 text-amber-700",
  partial: "bg-blue-50 text-blue-700",
  complete: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-700",
  cancelled: "bg-muted text-muted-foreground",
};

export const REVIEW_LABEL: Record<MaterialReviewStatus, string> = {
  pending: "На проверке",
  approved: "Принят",
  rejected: "Отклонён",
};

export const REVIEW_TONE: Record<MaterialReviewStatus, string> = {
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-700",
};

export function formatBytes(bytes: number | string): string {
  const n = typeof bytes === "string" ? Number(bytes) : bytes;
  if (!Number.isFinite(n) || n < 0) return "—";
  const units = ["Б", "КБ", "МБ", "ГБ", "ТБ"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}
