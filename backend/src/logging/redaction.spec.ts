import { REDACTION_PLACEHOLDER, redactSensitive } from './redaction';

describe('redactSensitive', () => {
  it('redacts sensitive keys at the top level', () => {
    const result = redactSensitive({
      username: 'alice',
      password: 'hunter2',
      authorization: 'Bearer abc.def',
    }) as Record<string, unknown>;

    expect(result['username']).toBe('alice');
    expect(result['password']).toBe(REDACTION_PLACEHOLDER);
    expect(result['authorization']).toBe(REDACTION_PLACEHOLDER);
  });

  it('redacts sensitive keys nested in objects and arrays', () => {
    const result = redactSensitive({
      user: { email: 'a@b.com', displayName: 'Alice' },
      sessions: [{ jwt: 'x.y.z' }],
    }) as { user: Record<string, unknown>; sessions: Array<Record<string, unknown>> };

    expect(result.user['email']).toBe(REDACTION_PLACEHOLDER);
    expect(result.user['displayName']).toBe('Alice');
    expect(result.sessions[0]?.['jwt']).toBe(REDACTION_PLACEHOLDER);
  });

  it('redacts PII fields (phone, address, government id)', () => {
    const result = redactSensitive({
      phone: '+254700000000',
      residentialAddress: '1 Main St',
      nationalId: '123456',
    }) as Record<string, unknown>;

    expect(result['phone']).toBe(REDACTION_PLACEHOLDER);
    expect(result['residentialAddress']).toBe(REDACTION_PLACEHOLDER);
    expect(result['nationalId']).toBe(REDACTION_PLACEHOLDER);
  });

  it('matches key fragments regardless of case or separators', () => {
    const result = redactSensitive({
      API_KEY: 'k',
      'private-key': 'pk',
      AccessToken: 't',
    }) as Record<string, unknown>;

    expect(result['API_KEY']).toBe(REDACTION_PLACEHOLDER);
    expect(result['private-key']).toBe(REDACTION_PLACEHOLDER);
    expect(result['AccessToken']).toBe(REDACTION_PLACEHOLDER);
  });

  it('passes through primitives unchanged', () => {
    expect(redactSensitive('plain')).toBe('plain');
    expect(redactSensitive(42)).toBe(42);
    expect(redactSensitive(null)).toBeNull();
  });

  it('handles circular references without infinite recursion', () => {
    const cyclic: Record<string, unknown> = { name: 'root' };
    cyclic['self'] = cyclic;

    const result = redactSensitive(cyclic) as Record<string, unknown>;

    expect(result['name']).toBe('root');
    expect(result['self']).toBe(REDACTION_PLACEHOLDER);
  });
});
