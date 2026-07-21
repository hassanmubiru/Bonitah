import 'express';

import type { AuthenticatedUser } from '../auth/auth.types';

declare module 'http' {
  interface IncomingMessage {
    /** Correlation id assigned by the HTTP logger (pino-http `genReqId`). */
    id: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      /** Correlation id assigned by the HTTP logger. */
      id: string;
      /**
       * Authenticated principal attached by the JWT auth guard after a valid
       * session token is verified. `undefined` on public (unauthenticated)
       * routes.
       */
      user?: AuthenticatedUser;
    }
  }
}

export {};
