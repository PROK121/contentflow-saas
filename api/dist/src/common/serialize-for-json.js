"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeForJson = serializeForJson;
const client_1 = require("@prisma/client");
function isDecimalLike(value) {
    if (value instanceof client_1.Prisma.Decimal)
        return true;
    const name = value.constructor?.name;
    if (name === 'Decimal')
        return true;
    return ('toFixed' in value &&
        typeof value.toFixed === 'function' &&
        'toString' in value);
}
function serializeForJson(data) {
    const seen = new WeakSet();
    function walk(value) {
        if (value === null || value === undefined)
            return value;
        if (typeof value === 'bigint')
            return value.toString();
        if (typeof value !== 'object')
            return value;
        if (value instanceof Date)
            return value.toISOString();
        if (Array.isArray(value)) {
            if (seen.has(value))
                return '[Circular]';
            seen.add(value);
            return value.map(walk);
        }
        if (isDecimalLike(value)) {
            return String(value);
        }
        if (seen.has(value))
            return '[Circular]';
        seen.add(value);
        const out = {};
        for (const [k, v] of Object.entries(value)) {
            out[k] = walk(v);
        }
        return out;
    }
    try {
        return walk(data);
    }
    catch (e) {
        console.error('[serializeForJson] failed', e);
        throw e;
    }
}
//# sourceMappingURL=serialize-for-json.js.map