import { Prisma } from '@prisma/client';

function isDecimalLike(value: object): boolean {
  if (value instanceof Prisma.Decimal) return true;
  const name = value.constructor?.name;
  if (name === 'Decimal') return true;
  return (
    'toFixed' in value &&
    typeof (value as { toFixed?: unknown }).toFixed === 'function' &&
    'toString' in value
  );
}

/**
 * Обходит дерево без JSON.stringify (Decimal/bigint → строки, циклы → [Circular]).
 */
export function serializeForJson<T>(data: T): T {
  const seen = new WeakSet<object>();

  function walk(value: unknown): unknown {
    if (value === null || value === undefined) return value;
    if (typeof value === 'bigint') return value.toString();
    if (typeof value !== 'object') return value;
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) {
      if (seen.has(value)) return '[Circular]';
      seen.add(value);
      return value.map(walk);
    }
    if (isDecimalLike(value)) {
      return String(value);
    }
    if (seen.has(value)) return '[Circular]';
    seen.add(value);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = walk(v);
    }
    return out;
  }

  try {
    return walk(data) as T;
  } catch (e) {
    console.error('[serializeForJson] failed', e);
    throw e;
  }
}
