/** Слоты документов сделки (ключ в URL и в JSON dealDocuments). */

export const DEAL_DOCUMENT_SLOT_KEYS = [
  'charter',
  'bank_details',
  'registration_cert',
  'director_order',
  'chain_director',
  'chain_operator',
  'chain_screenwriter',
  'chain_composer',
  'chain_art_director',
] as const;

export type DealDocumentSlot = (typeof DEAL_DOCUMENT_SLOT_KEYS)[number];

export function isDealDocumentSlot(s: string): s is DealDocumentSlot {
  return (DEAL_DOCUMENT_SLOT_KEYS as readonly string[]).includes(s);
}

export type DealDocumentStored = {
  storedFileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
};
