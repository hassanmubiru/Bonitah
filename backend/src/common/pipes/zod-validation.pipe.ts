import { type ArgumentMetadata, BadRequestException, type PipeTransform } from '@nestjs/common';
import type { ZodSchema, ZodTypeDef } from 'zod';

/**
 * Schema-driven request validation pipe (Req 14.3, 14.4).
 *
 * Validates an incoming value (typically a request body, but also query or
 * route params) against a zod schema — the same schemas exported by
 * `@bfn/shared` that form the single API contract between frontend and backend.
 * Validation covers required-field presence, data types, and value bounds as
 * defined by the schema (Req 14.3).
 *
 * On success it returns the parsed, typed value (with any schema coercions and
 * unknown-key stripping applied). On failure it throws a `400 Bad Request`
 * before the route handler executes, so the request is rejected without
 * processing and persisted state is left unchanged (Req 14.4). The error body
 * enumerates the offending fields without echoing the rejected values.
 *
 * @example
 * ```ts
 * import { nonceRequestSchema } from '@bfn/shared/schemas';
 *
 * @Post('nonce')
 * issueNonce(@Body(new ZodValidationPipe(nonceRequestSchema)) body: NonceRequest) { ... }
 * ```
 */
export class ZodValidationPipe<TOutput, TInput = unknown> implements PipeTransform<
  unknown,
  TOutput
> {
  constructor(private readonly schema: ZodSchema<TOutput, ZodTypeDef, TInput>) {}

  transform(value: unknown, _metadata: ArgumentMetadata): TOutput {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));

      throw new BadRequestException({
        error: 'ValidationError',
        message: 'Request input failed schema validation',
        details,
      });
    }

    return result.data;
  }
}

/**
 * Ergonomic factory for {@link ZodValidationPipe}.
 *
 * @example
 * ```ts
 * @Body(zodValidation(updateUserRequestSchema)) body: UpdateUserRequest
 * ```
 */
export function zodValidation<TOutput, TInput = unknown>(
  schema: ZodSchema<TOutput, ZodTypeDef, TInput>,
): ZodValidationPipe<TOutput, TInput> {
  return new ZodValidationPipe(schema);
}
