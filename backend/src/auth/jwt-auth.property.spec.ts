import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import * as fc from 'fast-check';
import type { Request } from 'express';

import { EnvService } from '../config/env.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { TokenService } from './token.service';
import type { ExecutionContext } from '@nestjs/common';
import type { AuthenticatedUser, Role } from './auth.types';

/**
 * Property 5: Sessions are accepted iff the JWT is valid and unexpired
 * **Validates: Requirements 2.7, 2.9, 14.1, 14.2**
 *
 * This test validates that JWT session acceptance follows strict security rules:
 * - Valid, unexpired JWTs are accepted and establish authenticated sessions
 * - Invalid, malformed, or expired JWTs are rejected with authentication errors
 * - Missing JWTs are rejected for non-public endpoints
 * - Public endpoints bypass JWT validation entirely
 */
describe('Property 5: Session JWT acceptance', () => {
  let jwtAuthGuard: JwtAuthGuard;
  let tokenService: TokenService;
  let reflector: Reflector;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        TokenService,
        Reflector,
        {
          provide: EnvService,
          useValue: {
            jwtSecret: 'a'.repeat(32), // Valid 32-char secret
            jwtExpiresIn: '24h',
          } as EnvService,
        },
      ],
    }).compile();

    jwtAuthGuard = moduleRef.get<JwtAuthGuard>(JwtAuthGuard);
    tokenService = moduleRef.get<TokenService>(TokenService);
    reflector = moduleRef.get<Reflector>(Reflector);
  });

  /**
   * Property: Valid, unexpired JWTs are accepted and establish authenticated sessions
   * Requirements: 14.1, 14.2 (valid JWT acceptance)
   */
  it('accepts valid, unexpired JWTs for protected endpoints', () => {
    fc.assert(
      fc.property(
        // Generate valid wallet addresses and roles
        fc.record({
          address: fc.hexaString({ minLength: 40, maxLength: 40 }).map(s => `0x${s}`),
          role: fc.constantFrom<Role>('USER', 'VERIFIER', 'ADMIN'),
          expiresInSeconds: fc.integer({ min: 1, max: 24 * 60 * 60 }), // 1 second to 24 hours (Req 2.7)
        }),
        ({ address, role, expiresInSeconds }) => {
          // Sign a valid JWT
          const token = tokenService.sign({ sub: address, role }, expiresInSeconds);
          
          // Create mock execution context for protected endpoint
          const context = createMockContext(`Bearer ${token}`, false);

          // JWT should be accepted
          const result = jwtAuthGuard.canActivate(context);
          
          expect(result).toBe(true);
          
          // Verify user is attached to request
          const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
          expect(request.user).toBeDefined();
          expect(request.user!.address).toBe(address.toLowerCase());
          expect(request.user!.role).toBe(role);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Expired JWTs are rejected with authentication errors
   * Requirements: 2.9, 14.2 (expired JWT rejection)
   */
  it('rejects expired JWTs with authentication error', () => {
    fc.assert(
      fc.property(
        fc.record({
          address: fc.hexaString({ minLength: 40, maxLength: 40 }).map(s => `0x${s}`),
          role: fc.constantFrom<Role>('USER', 'VERIFIER', 'ADMIN'),
          pastSeconds: fc.integer({ min: 1, max: 3600 }), // 1 second to 1 hour in the past
        }),
        ({ address, role, pastSeconds }) => {
          // Create an expired JWT by manipulating time
          const originalDateNow = Date.now;
          
          // Sign token in the past
          Date.now = () => originalDateNow() - (pastSeconds + 1) * 1000;
          const token = tokenService.sign({ sub: address, role }, pastSeconds);
          
          // Restore current time
          Date.now = originalDateNow;
          
          // Create mock execution context for protected endpoint
          const context = createMockContext(`Bearer ${token}`, false);

          // Expired JWT should be rejected
          expect(() => jwtAuthGuard.canActivate(context)).toThrow(UnauthorizedException);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Malformed or invalid JWTs are rejected with authentication errors
   * Requirements: 14.1, 14.2 (malformed JWT rejection)
   */
  it('rejects malformed or invalid JWTs with authentication error', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          // Missing token
          fc.constant(''),
          fc.constant(undefined),
          // Malformed tokens
          fc.string().filter(s => !s.includes('.')), // No dots
          fc.string().filter(s => s.split('.').length !== 3), // Wrong number of parts
          fc.constantFrom('not.a.jwt', 'invalid', 'Bearer', 'malformed.jwt.token'),
          // Wrong scheme
          fc.string().map(s => `Basic ${s}`),
          fc.string().map(s => `Token ${s}`),
        ),
        (invalidAuth) => {
          // Create mock execution context for protected endpoint
          const context = createMockContext(invalidAuth, false);

          // Invalid JWT should be rejected
          expect(() => jwtAuthGuard.canActivate(context)).toThrow(UnauthorizedException);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Tampered JWTs are rejected with authentication errors
   * Requirements: 14.1, 14.2 (tampered JWT rejection)
   */
  it('rejects tampered JWTs with authentication error', () => {
    fc.assert(
      fc.property(
        fc.record({
          address: fc.hexaString({ minLength: 40, maxLength: 40 }).map(s => `0x${s}`),
          role: fc.constantFrom<Role>('USER', 'VERIFIER', 'ADMIN'),
          tamperIndex: fc.integer({ min: 0, max: 10 }), // Index to tamper
          tamperChar: fc.char(),
        }),
        ({ address, role, tamperIndex, tamperChar }) => {
          // Create a valid JWT
          const validToken = tokenService.sign({ sub: address, role }, 3600);
          
          // Tamper with the token
          const tampered = validToken.split('');
          if (tamperIndex < tampered.length) {
            tampered[tamperIndex] = tamperChar;
          }
          const tamperedToken = tampered.join('');
          
          // Skip if tampering didn't actually change anything
          if (tamperedToken === validToken) {
            return;
          }
          
          // Create mock execution context for protected endpoint
          const context = createMockContext(`Bearer ${tamperedToken}`, false);

          // Tampered JWT should be rejected
          expect(() => jwtAuthGuard.canActivate(context)).toThrow(UnauthorizedException);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Public endpoints bypass JWT validation entirely
   * Requirements: 14.1 (public endpoint exception)
   */
  it('allows access to public endpoints regardless of JWT validity', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          // No authorization header
          fc.constant(undefined),
          // Invalid tokens
          fc.constantFrom('', 'invalid', 'malformed.jwt.token'),
          // Valid tokens
          fc.record({
            address: fc.hexaString({ minLength: 40, maxLength: 40 }).map(s => `0x${s}`),
            role: fc.constantFrom<Role>('USER', 'VERIFIER', 'ADMIN'),
          }).map(({ address, role }) => `Bearer ${tokenService.sign({ sub: address, role }, 3600)}`),
        ),
        (authHeader) => {
          // Create mock execution context for PUBLIC endpoint
          const context = createMockContext(authHeader, true);

          // Public endpoints should always allow access
          const result = jwtAuthGuard.canActivate(context);
          expect(result).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Missing authorization header is rejected for protected endpoints
   * Requirements: 14.1, 14.2 (missing JWT rejection)
   */
  it('rejects requests with missing authorization for protected endpoints', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(undefined, '', '   ', 'Bearer', 'Bearer ', 'Basic token'),
        (invalidAuth) => {
          // Create mock execution context for protected endpoint
          const context = createMockContext(invalidAuth, false);

          // Missing/invalid authorization should be rejected
          expect(() => jwtAuthGuard.canActivate(context)).toThrow(UnauthorizedException);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Helper to create mock ExecutionContext
   */
  function createMockContext(authorizationHeader: string | undefined, isPublic: boolean): ExecutionContext {
    const request: Partial<Request> = {
      headers: {
        authorization: authorizationHeader,
      },
    };

    const httpContext = {
      getRequest: () => request,
    };

    const context = {
      switchToHttp: () => httpContext,
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;

    // Mock reflector to return whether endpoint is public
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(isPublic);

    return context;
  }
});