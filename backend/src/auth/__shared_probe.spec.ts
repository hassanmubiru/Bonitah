import { nonceRequestSchema } from '@bfn/shared/schemas';

describe('shared import probe', () => {
  it('imports a shared zod schema', () => {
    expect(nonceRequestSchema.safeParse({ address: '0x' + '1'.repeat(40) }).success).toBe(true);
  });
});
