"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLOSED_DEAL_STAGES = void 0;
exports.territoryCoveredByLicenseTerm = territoryCoveredByLicenseTerm;
exports.parseRightsSelection = parseRightsSelection;
exports.territoriesOverlap = territoriesOverlap;
exports.isBlockingRightsConflict = isBlockingRightsConflict;
const client_1 = require("@prisma/client");
const CIS = new Set([
    'KZ',
    'RU',
    'BY',
    'KG',
    'AM',
    'AZ',
    'TJ',
    'UZ',
    'TM',
    'MD',
]);
function expandTerritoryCode(t) {
    const u = t.toUpperCase();
    if (u === 'WW' || u === 'WORLD')
        return 'WW';
    if (u === 'CIS')
        return new Set(CIS);
    if (u === 'CIS_EX_KZ') {
        const s = new Set(CIS);
        s.delete('KZ');
        return s;
    }
    if (u === 'CIS_EX_RU') {
        const s = new Set(CIS);
        s.delete('RU');
        return s;
    }
    if (u === 'CIS_EX_KG') {
        const s = new Set(CIS);
        s.delete('KG');
        return s;
    }
    if (CIS.has(u))
        return new Set([u]);
    return new Set([u]);
}
function selectionCoveredByLicense(sel, lic) {
    if (sel === 'WW')
        return lic === 'WW';
    if (lic === 'WW')
        return true;
    for (const x of sel) {
        if (!lic.has(x))
            return false;
    }
    return true;
}
function territoryCoveredByLicenseTerm(code, licenseTerritory) {
    return selectionCoveredByLicense(expandTerritoryCode(code), expandTerritoryCode(licenseTerritory));
}
function parseRightsSelection(raw) {
    if (raw === null || raw === undefined)
        return null;
    if (typeof raw !== 'object' || Array.isArray(raw))
        return null;
    const o = raw;
    if (!Array.isArray(o.territoryCodes))
        return null;
    const territoryCodes = o.territoryCodes.map((t) => String(t).toUpperCase());
    const exclusivity = o.exclusivity;
    if (!Object.values(client_1.Exclusivity).includes(exclusivity))
        return null;
    const platforms = Array.isArray(o.platforms)
        ? o.platforms.filter((p) => Object.values(client_1.Platform).includes(p))
        : [];
    const startAt = typeof o.startAt === 'string'
        ? new Date(o.startAt)
        : o.startAt instanceof Date
            ? o.startAt
            : null;
    const endAt = typeof o.endAt === 'string'
        ? new Date(o.endAt)
        : o.endAt instanceof Date
            ? o.endAt
            : null;
    return { territoryCodes, startAt, endAt, platforms, exclusivity };
}
function territoriesOverlap(a, b) {
    const setB = new Set(b.map((x) => x.toUpperCase()));
    return [...new Set(a.map((x) => x.toUpperCase()))].filter((x) => setB.has(x));
}
function isExclusive(e) {
    return e === client_1.Exclusivity.exclusive || e === client_1.Exclusivity.sole;
}
function isBlockingRightsConflict(existing, proposed) {
    const overlap = territoriesOverlap(existing.territoryCodes, proposed.territoryCodes);
    if (overlap.length === 0)
        return false;
    return isExclusive(existing.exclusivity) || isExclusive(proposed.exclusivity);
}
exports.CLOSED_DEAL_STAGES = [
    client_1.DealStage.contract,
    client_1.DealStage.paid,
];
//# sourceMappingURL=rights-validation.js.map