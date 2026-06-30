import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiResponse } from '@nestjs/swagger';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ZodType } from 'zod';

// zod-to-json-schema's generic return type is too deep for tsc (TS2589) when given
// our nested schemas; call it through a simplified signature.
type ZodToJson = (
  schema: ZodType,
  options: { target: 'openApi3'; $refStrategy: 'none' },
) => Record<string, unknown>;
const convert = zodToJsonSchema as unknown as ZodToJson;

/**
 * Convert a shared Zod schema into an inlined OpenAPI 3 schema. This keeps the
 * Swagger docs derived from the SAME schemas we validate against (single source),
 * so the docs can't drift from the contract as we add endpoints.
 */
export function zodToOpenApi(schema: ZodType): Record<string, unknown> {
  return convert(schema, { target: 'openApi3', $refStrategy: 'none' });
}

/** Document a request body from a Zod schema. */
export function ApiZodBody(schema: ZodType) {
  return applyDecorators(
    ApiBody({ schema: zodToOpenApi(schema) } as Parameters<typeof ApiBody>[0]),
  );
}

/** Document a response from a Zod schema. */
export function ApiZodResponse(status: number, schema: ZodType, description?: string) {
  return applyDecorators(
    ApiResponse({ status, description, schema: zodToOpenApi(schema) } as Parameters<
      typeof ApiResponse
    >[0]),
  );
}
