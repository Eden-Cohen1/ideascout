import { z, type ZodTypeAny } from 'zod';

/**
 * Deterministically build a value that satisfies a Zod schema. Used by the mock
 * LLM provider to produce schema-valid structured output with no network/key,
 * so the whole research pipeline runs in mock mode and tests stay deterministic.
 *
 * Supports the Zod constructs our domain/DTO schemas use (object, string [url/min],
 * number [int/min/max], boolean, enum, literal, array [min], optional, nullable,
 * default, record, union).
 */
export function synthFromSchema<T>(schema: z.ZodType<T>): T {
  return synth(schema as unknown as ZodTypeAny) as T;
}

interface ZodCheck {
  kind: string;
  value?: number;
}

function synth(schema: ZodTypeAny): unknown {
  const def = schema._def as {
    typeName: string;
    checks?: ZodCheck[];
    values?: unknown[];
    value?: unknown;
    type?: ZodTypeAny;
    innerType?: ZodTypeAny;
    options?: ZodTypeAny[];
    minLength?: { value: number } | null;
  };

  switch (def.typeName) {
    case 'ZodObject': {
      const shape = (schema as z.ZodObject<z.ZodRawShape>).shape;
      const out: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(shape)) {
        out[key] = synth(child as ZodTypeAny);
      }
      return out;
    }
    case 'ZodString': {
      const checks = def.checks ?? [];
      if (checks.some((c) => c.kind === 'url')) return 'https://example.com/mock';
      if (checks.some((c) => c.kind === 'email')) return 'mock@example.com';
      const min = checks.find((c) => c.kind === 'min')?.value ?? 0;
      let s = 'mock';
      while (s.length < min) s += 'x';
      return s;
    }
    case 'ZodNumber': {
      const checks = def.checks ?? [];
      const isInt = checks.some((c) => c.kind === 'int');
      const min = checks.find((c) => c.kind === 'min')?.value;
      const max = checks.find((c) => c.kind === 'max')?.value;
      let n = min ?? max ?? 1;
      if (max !== undefined && n > max) n = max;
      return isInt ? Math.round(n) : n;
    }
    case 'ZodBoolean':
      return true;
    case 'ZodEnum':
      return def.values?.[0];
    case 'ZodNativeEnum':
      return Object.values(def.values ?? {})[0];
    case 'ZodLiteral':
      return def.value;
    case 'ZodArray': {
      const min = def.minLength?.value ?? 0;
      const count = Math.max(min, 1);
      return Array.from({ length: count }, () => synth(def.type as ZodTypeAny));
    }
    case 'ZodOptional':
    case 'ZodNullable':
    case 'ZodDefault':
      return synth(def.innerType as ZodTypeAny);
    case 'ZodUnion':
      return synth((def.options as ZodTypeAny[])[0]);
    case 'ZodRecord':
      return {};
    case 'ZodUnknown':
    case 'ZodAny':
      return null;
    default:
      return null;
  }
}
