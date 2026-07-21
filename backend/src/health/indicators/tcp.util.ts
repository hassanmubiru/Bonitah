import { connect } from 'node:net';

/**
 * Attempt a lightweight TCP connection to `host:port`, resolving `true` when
 * the socket connects within `timeoutMs` and `false` otherwise.
 *
 * This is a transport-level reachability probe used by the DB and Redis health
 * indicators until their full clients (Prisma, Redis) are wired in later tasks.
 * It performs a genuine connectivity check rather than a mocked result.
 */
export function tcpProbe(host: string, port: number, timeoutMs = 2000): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const socket = connect({ host, port });
    let settled = false;

    const finish = (ok: boolean): void => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      resolve(ok);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

/**
 * Parse a connection URL into host/port, applying a default port when the URL
 * omits one. Returns `null` for unparseable input.
 */
export function hostPortFromUrl(
  url: string,
  defaultPort: number,
): { host: string; port: number } | null {
  try {
    const parsed = new URL(url);
    const port = parsed.port ? Number.parseInt(parsed.port, 10) : defaultPort;
    if (!parsed.hostname || Number.isNaN(port)) {
      return null;
    }
    return { host: parsed.hostname, port };
  } catch {
    return null;
  }
}
