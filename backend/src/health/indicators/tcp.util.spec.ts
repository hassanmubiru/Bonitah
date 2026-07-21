import { hostPortFromUrl } from './tcp.util';

describe('hostPortFromUrl', () => {
  it('parses host and explicit port', () => {
    expect(hostPortFromUrl('postgresql://user:pass@db.internal:5433/app', 5432)).toEqual({
      host: 'db.internal',
      port: 5433,
    });
  });

  it('applies the default port when none is present', () => {
    expect(hostPortFromUrl('redis://cache.internal/0', 6379)).toEqual({
      host: 'cache.internal',
      port: 6379,
    });
  });

  it('returns null for unparseable input', () => {
    expect(hostPortFromUrl('not a url', 5432)).toBeNull();
  });
});
