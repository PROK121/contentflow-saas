"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEAL_DOCUMENT_SLOT_KEYS = void 0;
exports.isDealDocumentSlot = isDealDocumentSlot;
exports.DEAL_DOCUMENT_SLOT_KEYS = [
    'charter',
    'bank_details',
    'registration_cert',
    'director_order',
    'chain_director',
    'chain_operator',
    'chain_screenwriter',
    'chain_composer',
    'chain_art_director',
];
function isDealDocumentSlot(s) {
    return exports.DEAL_DOCUMENT_SLOT_KEYS.includes(s);
}
//# sourceMappingURL=deal-document-slots.js.map