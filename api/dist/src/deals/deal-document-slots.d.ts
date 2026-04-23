export declare const DEAL_DOCUMENT_SLOT_KEYS: readonly ["charter", "bank_details", "registration_cert", "director_order", "chain_director", "chain_operator", "chain_screenwriter", "chain_composer", "chain_art_director"];
export type DealDocumentSlot = (typeof DEAL_DOCUMENT_SLOT_KEYS)[number];
export declare function isDealDocumentSlot(s: string): s is DealDocumentSlot;
export type DealDocumentStored = {
    storedFileName: string;
    originalName: string;
    mimeType: string;
    size: number;
    uploadedAt: string;
};
