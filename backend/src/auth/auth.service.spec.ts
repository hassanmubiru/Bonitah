import { UnauthorizedException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { SiweMessage } from 'siwe';
import { privateKeyToAccount } from 'viem/accounts';
import * as fc from 'fast-check';

import { EnvService } from '../config/env.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import type { NonceRequest, VerifyRequest } from './auth.schemas';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        TokenService,
        {
          provide: EnvService,
          useValue: {
            jwtSecret: 'test-secret-32-chars-long-enough',
            jwtExpiresIn: '24h',
          },
        },
        {
          provide: PrismaService,
          useValue: {
            authNonce: {
              create: jest.fn(),
              findUnique: jest.fn(),
              updateMany: jest.fn(),
            },
            user: {
              upsert: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    tokenService = module.get<TokenService>(TokenService);
  });

  afterEach(async () => {
    jest.clearAllMocks();
  });

  describe('Property 4: SIWE nonces are single-use and expiry-bounded', () => {
    /**
     * **Validates: Requirements 2.4, 2.6, 2.7, 2.8**
     *
     * This property test verifies that:
     * 1. Nonces can only be used once (single-use constraint)
     * 2. Expired nonces are rejected
     * 3. Valid nonces within expiry work exactly once
     * 4. Concurrent attempts to use the same nonce only succeed once
     */
    it('nonces are single-use and respect expiry boundaries', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate test data: valid Ethereum addresses and wallet keys
          fc.record({
            address: fc.constantFrom(
              '0x1234567890123456789012345678901234567890',
              '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
              '0x9876543210987654321098765432109876543210',
            ),
            privateKey: fc.constantFrom(
              '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
              '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
              '0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba',
            ) as fc.Arbitrary<`0x${string}`>,
            // Test both expired and valid nonces
            isExpiredNonce: fc.boolean(),
            // Test concurrent usage attempts
            concurrentAttempts: fc.integer({ min: 2, max: 3 }),
          }),
          async ({ address, privateKey, isExpiredNonce, concurrentAttempts }) => {
            // Clear any previous mock state
            jest.clearAllMocks();

            // Set up mock database responses
            const mockNonce = Math.random().toString(36).substring(2).padStart(16, '0'); // At least 8 alphanumeric chars
            const now = new Date();
            const expiresAt = isExpiredNonce
              ? new Date(now.getTime() - 60000) // 1 minute ago (expired)
              : new Date(now.getTime() + 300000); // 5 minutes from now (valid)

            // Mock nonce issuance
            (prisma.authNonce.create as jest.Mock).mockResolvedValueOnce({
              id: 'test-id',
              nonce: mockNonce,
              address: address.toLowerCase(),
              used: false,
              expiresAt,
              createdAt: now,
            });

            // Issue a nonce
            const nonceRequest: NonceRequest = { address };
            await service.issueNonce(nonceRequest);

            // Verify nonce was created with correct properties
            expect(prisma.authNonce.create).toHaveBeenCalledWith({
              data: {
                nonce: expect.stringMatching(/^[0-9a-f]{32}$/), // 32 hex chars
                address: address.toLowerCase(),
                expiresAt: expect.any(Date),
              },
            });

            // Create a valid SIWE message
            const account = privateKeyToAccount(privateKey);
            const domain = 'app.bfn.test';
            const uri = 'https://app.bfn.test';
            const statement = 'Sign in to Bonitah Financial Network';
            const siweMessage = new SiweMessage({
              domain,
              address: account.address,
              statement,
              uri,
              version: '1',
              chainId: 84532, // Base Sepolia
              nonce: mockNonce,
            });

            const message = siweMessage.prepareMessage();
            const signature = await account.signMessage({ message });

            const verifyRequest: VerifyRequest = {
              message,
              signature,
            };

            if (isExpiredNonce) {
              // Mock database to return expired nonce
              (prisma.authNonce.findUnique as jest.Mock).mockResolvedValueOnce({
                id: 'test-id',
                nonce: mockNonce,
                address: account.address.toLowerCase(),
                used: false,
                expiresAt, // This is in the past
                createdAt: now,
              });

              // Expired nonces should be rejected
              await expect(service.verify(verifyRequest)).rejects.toThrow(UnauthorizedException);

              // Note: We don't check updateMany here because the service rejects
              // the nonce before attempting to mark it as used
            } else {
              // Test single-use constraint with concurrent attempts

              const results: Array<Promise<any>> = [];

              for (let i = 0; i < concurrentAttempts; i++) {
                // Mock the database responses for concurrent attempts
                if (i === 0) {
                  // First attempt finds unused nonce
                  (prisma.authNonce.findUnique as jest.Mock).mockResolvedValueOnce({
                    id: 'test-id',
                    nonce: mockNonce,
                    address: account.address.toLowerCase(),
                    used: false,
                    expiresAt, // This is in the future
                    createdAt: now,
                  });

                  // First attempt successfully marks nonce as used
                  (prisma.authNonce.updateMany as jest.Mock).mockResolvedValueOnce({ count: 1 });

                  // Mock user upsert for successful attempt
                  (prisma.user.upsert as jest.Mock).mockResolvedValueOnce({
                    id: 'user-id',
                    walletAddress: account.address.toLowerCase(),
                    role: 'USER',
                    createdAt: now,
                  });
                } else {
                  // Subsequent attempts find already used nonce OR
                  // the updateMany returns count 0 (race condition)
                  if (i % 2 === 1) {
                    // Some attempts find nonce already marked as used
                    (prisma.authNonce.findUnique as jest.Mock).mockResolvedValueOnce({
                      id: 'test-id',
                      nonce: mockNonce,
                      address: account.address.toLowerCase(),
                      used: true, // Already used
                      expiresAt,
                      createdAt: now,
                    });
                  } else {
                    // Some attempts lose the race in updateMany
                    (prisma.authNonce.findUnique as jest.Mock).mockResolvedValueOnce({
                      id: 'test-id',
                      nonce: mockNonce,
                      address: account.address.toLowerCase(),
                      used: false,
                      expiresAt,
                      createdAt: now,
                    });

                    // But updateMany returns count 0 (lost the race)
                    (prisma.authNonce.updateMany as jest.Mock).mockResolvedValueOnce({ count: 0 });
                  }
                }

                // All attempts use the same verify request
                results.push(service.verify(verifyRequest).catch((error) => error));
              }

              const outcomes = await Promise.all(results);

              // Exactly one attempt should succeed
              const successes = outcomes.filter(
                (outcome) =>
                  outcome &&
                  typeof outcome === 'object' &&
                  'jwt' in outcome &&
                  'address' in outcome,
              );

              const failures = outcomes.filter(
                (outcome) => outcome instanceof UnauthorizedException,
              );

              // Property: Exactly one success, the rest are failures
              expect(successes).toHaveLength(1);
              expect(failures).toHaveLength(concurrentAttempts - 1);

              // The successful response should have correct structure
              const successResponse = successes[0];
              expect(successResponse).toEqual({
                jwt: expect.any(String),
                address: account.address.toLowerCase(),
                role: 'USER',
                expiresAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
              });

              // Verify JWT can be decoded and is valid
              expect(successResponse.jwt).toEqual(expect.any(String));
              expect(successResponse.jwt.split('.')).toHaveLength(3); // Valid JWT format
              expect(successResponse.address).toBe(account.address.toLowerCase());
              expect(successResponse.role).toBe('USER');

              // Don't verify JWT decoding in this test since we're testing SIWE nonce logic
              // The JWT verification is tested separately in the JWT auth property tests
            }
          },
        ),
        {
          numRuns: 100, // Minimum 100 iterations as specified
          timeout: 30000, // 30 second timeout
        },
      );
    });

    it('nonce expiry boundary conditions work correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            address: fc.constantFrom(
              '0x1234567890123456789012345678901234567890',
              '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
            ),
            privateKey: fc.constantFrom(
              '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
              '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            ) as fc.Arbitrary<`0x${string}`>,
            // Test edge cases around expiry
            secondsUntilExpiry: fc.integer({ min: -300, max: 300 }), // -5min to +5min
          }),
          async ({ address, privateKey, secondsUntilExpiry }) => {
            // Clear any previous mock state
            jest.clearAllMocks();

            const mockNonce = Math.random().toString(36).substring(2).padStart(16, '0'); // At least 8 alphanumeric chars
            const now = new Date();
            const expiresAt = new Date(now.getTime() + secondsUntilExpiry * 1000);

            // Mock nonce issuance
            (prisma.authNonce.create as jest.Mock).mockResolvedValueOnce({
              id: 'test-id',
              nonce: mockNonce,
              address: address.toLowerCase(),
              used: false,
              expiresAt,
              createdAt: now,
            });

            // Issue nonce
            const nonceRequest: NonceRequest = { address };
            await service.issueNonce(nonceRequest);

            // Create SIWE message and signature
            const account = privateKeyToAccount(privateKey);
            const siweMessage = new SiweMessage({
              domain: 'app.bfn.test',
              address: account.address,
              statement: 'Sign in to Bonitah Financial Network',
              uri: 'https://app.bfn.test',
              version: '1',
              chainId: 84532,
              nonce: mockNonce,
            });

            const message = siweMessage.prepareMessage();
            const signature = await account.signMessage({ message });
            const verifyRequest: VerifyRequest = { message, signature };

            // Mock database response for verification
            (prisma.authNonce.findUnique as jest.Mock).mockResolvedValueOnce({
              id: 'test-id',
              nonce: mockNonce,
              address: account.address.toLowerCase(),
              used: false,
              expiresAt,
              createdAt: now,
            });

            if (secondsUntilExpiry <= 0) {
              // Expired or exactly at expiry should fail
              await expect(service.verify(verifyRequest)).rejects.toThrow(UnauthorizedException);

              expect(prisma.authNonce.updateMany).not.toHaveBeenCalled();
            } else {
              // Not yet expired should succeed
              (prisma.authNonce.updateMany as jest.Mock).mockResolvedValueOnce({ count: 1 });
              (prisma.user.upsert as jest.Mock).mockResolvedValueOnce({
                id: 'user-id',
                walletAddress: account.address.toLowerCase(),
                role: 'USER',
                createdAt: now,
              });

              const result = await service.verify(verifyRequest);
              expect(result).toEqual({
                jwt: expect.any(String),
                address: account.address.toLowerCase(),
                role: 'USER',
                expiresAt: expect.any(String),
              });

              // Verify the nonce was marked as used
              expect(prisma.authNonce.updateMany).toHaveBeenCalledWith({
                where: { nonce: mockNonce, used: false },
                data: { used: true },
              });
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
