import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { SiweMessage } from 'siwe';
import { generatePrivateKey, privateKeyToAccount, privateKeyToAddress } from 'viem/accounts';
import * as fc from 'fast-check';

import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { PrismaService } from '../prisma/prisma.service';
import { EnvService } from '../config/env.service';
import { DEFAULT_ROLE, Role } from './auth.types';

/**
 * Property-Based Test for Least-Privilege Default Role Assignment
 * 
 * **Property 6: New wallets default to least-privilege role**
 * **Validates: Requirements 2.10**
 * 
 * This property test verifies that the Backend assigns each authenticated wallet
 * a role from a defined set of roles, defaulting to a least-privilege 
 * non-administrative role, for authorization decisions.
 * 
 * The property ensures that:
 * 1. New wallet addresses are assigned the DEFAULT_ROLE (USER) which is least-privilege
 * 2. Existing wallet addresses retain their previously assigned role
 * 3. No wallet is ever assigned an undefined or invalid role
 * 4. The role assignment is consistent across multiple authentication attempts
 */
describe('Property Test: Least-Privilege Default Role Assignment', () => {
  let module: TestingModule;
  let authService: AuthService;
  let mockUsers: Map<string, { walletAddress: string; role: Role }>;
  let mockNonces: Map<string, { nonce: string; address: string; used: boolean; expiresAt: Date }>;

  beforeAll(async () => {
    // Create simple mock functions that TypeScript can understand
    const mockPrismaService = {
      user: {
        deleteMany: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      authNonce: {
        deleteMany: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    // Create mock EnvService
    const mockEnvService = {
      jwtExpiresIn: '24h',
      jwtSecret: 'x'.repeat(32),
    };

    module = await Test.createTestingModule({
      providers: [
        AuthService,
        TokenService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: EnvService, useValue: mockEnvService },
      ],
    })
      .setLogger(new Logger())
      .compile();

    authService = module.get<AuthService>(AuthService);
  });

  afterAll(async () => {
    await module?.close();
  });

  beforeEach(async () => {
    // Reset mock data structures
    mockUsers = new Map();
    mockNonces = new Map();
    
    // Get mock instances
    const mockPrisma = module.get(PrismaService) as any;
    
    // Reset mock implementations
    jest.clearAllMocks();
    
    // Setup mock implementations with proper typing
    mockPrisma.user.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.authNonce.deleteMany.mockResolvedValue({ count: 0 });
    
    // Mock nonce creation
    mockPrisma.authNonce.create.mockImplementation(async (args: any) => {
      const { data: _data } = args;
      const record = {
        id: 'test-id',
        nonce: data.nonce,
        address: data.address,
        used: false,
        expiresAt: data.expiresAt,
        createdAt: new Date(),
      };
      mockNonces.set(data.nonce, record);
      return record;
    });
    
    // Mock nonce lookup
    mockPrisma.authNonce.findUnique.mockImplementation(async (args: any) => {
      const { where } = args;
      const record = mockNonces.get(where.nonce);
      return record || null;
    });
    
    // Mock nonce update (consuming)
    mockPrisma.authNonce.updateMany.mockImplementation(async (args: any) => {
      const { where } = args;
      const record = mockNonces.get(where.nonce);
      if (record && !record.used && where.used === false) {
        record.used = true;
        return { count: 1 };
      }
      return { count: 0 };
    });
    
    // Mock user upsert
    mockPrisma.user.upsert.mockImplementation(async (args: any) => {
      const { where, create } = args;
      const existing = mockUsers.get(where.walletAddress);
      if (existing) {
        // Update case - keep existing role
        return { 
          id: 'test-id', 
          walletAddress: existing.walletAddress, 
          role: existing.role,
          displayName: null,
          createdAt: new Date(),
        };
      } else {
        // Create case - use default role
        const user = { 
          id: 'test-id',
          walletAddress: create.walletAddress,
          role: create.role as Role,
          displayName: null,
          createdAt: new Date(),
        };
        mockUsers.set(create.walletAddress, user);
        return user;
      }
    });
    
    // Mock user creation
    mockPrisma.user.create.mockImplementation(async (args: any) => {
      const { data } = args;
      const user = {
        id: 'test-id',
        walletAddress: data.walletAddress,
        role: data.role as Role,
        displayName: data.displayName || null,
        createdAt: new Date(),
      };
      mockUsers.set(data.walletAddress, user);
      return user;
    });
    
    // Mock user find
    mockPrisma.user.findUnique.mockImplementation(async (args: any) => {
      const { where } = args;
      const user = mockUsers.get(where.walletAddress);
      return user ? {
        id: user.walletAddress,
        walletAddress: user.walletAddress,
        role: user.role,
        displayName: null,
        createdAt: new Date(),
      } : null;
    });
    
    // Mock user updateMany for role changes
    mockPrisma.user.updateMany.mockImplementation(async (args: any) => {
      const { where, data: update } = args;
      const user = Array.from(mockUsers.values()).find(u => u.walletAddress === where.walletAddress);
      if (user) {
        mockUsers.set(data.walletAddress, { ...user, walletAddress: data.walletAddress });
        return { count: 1 };
      }
      return { count: 0 };
    });
  });

  /**
   * Simple unit test to debug the core functionality
   */
  it('Debug: Single wallet authentication should work', async () => {
    // Generate a valid private key and account for signing
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    const signerAddress = privateKeyToAddress(privateKey);
    const _testAddress = signerAddress; // Use checksum case, not lowercase
    
    // Step 1: Issue nonce for the wallet
    const nonceResponse = await authService.issueNonce({ address: testAddress });
    expect(nonceResponse.nonce).toBeDefined();
    
    // Step 2: Create and sign a SIWE message
    const siweMessage = new SiweMessage({
      domain: 'localhost',
      address: testAddress,
      statement: 'Sign in to BFN',
      uri: 'http://localhost:3000',
      version: '1',
      chainId: 84532, // Base Sepolia
      nonce: nonceResponse.nonce,
      issuedAt: new Date().toISOString(),
    });
    
    const messageString = siweMessage.prepareMessage();
    const signature = await account.signMessage({ message: messageString });
    
    // Step 3: Verify the SIWE message (this creates/updates the user)
    const verifyResponse = await authService.verify({
      message: messageString,
      signature,
    });
    
    // Assertions
    expect(verifyResponse.role).toBe(DEFAULT_ROLE);
    expect(verifyResponse.role).toBe('USER');
    
    // Check mock database (backend stores addresses in lowercase)
    const user = mockUsers.get(testAddress.toLowerCase());
    expect(user).toBeTruthy();
    expect(user!.role).toBe('USER');
  });

  /**
   * Property: New wallets always receive the least-privilege default role
   */
  it('Property 6: New wallets default to least-privilege role', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }), // Just use a simple integer to vary the test
        async (_testSeed) => {
          // Generate a valid private key and account for signing
          const privateKey = generatePrivateKey();
          const account = privateKeyToAccount(privateKey);
          const signerAddress = privateKeyToAddress(privateKey);
          
          // Use the generated signer address with proper checksum case
          const testAddress = signerAddress;
          
          // Step 1: Issue nonce for the wallet
          const nonceResponse = await authService.issueNonce({ address: testAddress });
          if (!nonceResponse.nonce) {
            throw new Error('Nonce not generated');
          }
          
          // Step 2: Create and sign a SIWE message
          const siweMessage = new SiweMessage({
            domain: 'localhost',
            address: testAddress,
            statement: 'Sign in to BFN',
            uri: 'http://localhost:3000',
            version: '1',
            chainId: 84532, // Base Sepolia
            nonce: nonceResponse.nonce,
            issuedAt: new Date().toISOString(),
          });
          
          const messageString = siweMessage.prepareMessage();
          const signature = await account.signMessage({ message: messageString });
          
          // Step 3: Verify the SIWE message (this creates/updates the user)
          const verifyResponse = await authService.verify({
            message: messageString,
            signature,
          });
          
          // Property assertions that should never fail:
          if (verifyResponse.role !== DEFAULT_ROLE) {
            throw new Error(`Expected role ${DEFAULT_ROLE}, got ${verifyResponse.role}`);
          }
          
          if (verifyResponse.role !== 'USER') {
            throw new Error(`Expected USER role, got ${verifyResponse.role}`);
          }
          
          // Verify in mock database (addresses are stored in lowercase)
          const user = mockUsers.get(testAddress.toLowerCase());
          if (!user) {
            throw new Error('User not found in mock database');
          }
          
          if (user.role !== DEFAULT_ROLE) {
            throw new Error(`Database role mismatch: expected ${DEFAULT_ROLE}, got ${user.role}`);
          }
          
          // Clear this user for the next iteration to ensure isolation
          mockUsers.delete(testAddress.toLowerCase());
        }
      ),
      { 
        numRuns: 100, // Minimum 100 iterations as specified in requirements
        verbose: false, // Reduce verbosity to see actual errors
      }
    );
  });

  /**
   * Property: Existing wallets retain their assigned role (not overwritten to default)
   */
  it('Property 6b: Existing wallets retain their assigned role', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('VERIFIER' as const, 'ADMIN' as const), // Test with non-default roles
        fc.hexaString({ minLength: 40, maxLength: 40 }),
        async (existingRole: Role, _addressSuffix) => {
          // Generate signing capability for this address
          const privateKey = generatePrivateKey();
          const account = privateKeyToAccount(privateKey);
          const signerAddress = privateKeyToAddress(privateKey);
          
          // Pre-create user with existing role using the signer address
          mockUsers.set(signerAddress.toLowerCase(), {
            walletAddress: signerAddress.toLowerCase(),
            role: existingRole,
          });
          
          // Issue nonce and verify authentication
          const nonceResponse = await authService.issueNonce({ address: signerAddress });
          
          const siweMessage = new SiweMessage({
            domain: 'localhost',
            address: signerAddress,
            statement: 'Sign in to BFN',
            uri: 'http://localhost:3000',
            version: '1',
            chainId: 84532,
            nonce: nonceResponse.nonce,
            issuedAt: new Date().toISOString(),
          });
          
          const messageString = siweMessage.prepareMessage();
          const signature = await account.signMessage({ message: messageString });
          
          const verifyResponse = await authService.verify({
            message: messageString,
            signature,
          });
          
          // Property assertions:
          // 1. The existing wallet should retain its previously assigned role
          expect(verifyResponse.role).toBe(existingRole);
          
          // 2. The role should NOT be changed to the default role
          if (existingRole !== DEFAULT_ROLE) {
            expect(verifyResponse.role).not.toBe(DEFAULT_ROLE);
          }
          
          // 3. Verify in database that role was preserved
          const user = mockUsers.get(signerAddress.toLowerCase());
          expect(user!.role).toBe(existingRole);
        }
      ),
      {
        numRuns: 100,
        verbose: true,
      }
    );
  });

  /**
   * Property: Role assignment is deterministic and consistent
   */
  it('Property 6c: Role assignment is deterministic for the same wallet', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.hexaString({ minLength: 40, maxLength: 40 }),
        async (_addressSuffix) => {
          const privateKey = generatePrivateKey();
          const account = privateKeyToAccount(privateKey);
          const testAddress = privateKeyToAddress(privateKey);
          
          const authResults: Role[] = [];
          
          // Authenticate the same wallet multiple times
          for (let i = 0; i < 3; i++) {
            // Clean nonces to allow re-authentication
            mockNonces.clear();
            
            const nonceResponse = await authService.issueNonce({ address: testAddress });
            
            const siweMessage = new SiweMessage({
              domain: 'localhost',
              address: testAddress,
              statement: 'Sign in to BFN',
              uri: 'http://localhost:3000',
              version: '1',
              chainId: 84532,
              nonce: nonceResponse.nonce,
              issuedAt: new Date().toISOString(),
            });
            
            const messageString = siweMessage.prepareMessage();
            const signature = await account.signMessage({ message: messageString });
            
            const verifyResponse = await authService.verify({
              message: messageString,
              signature,
            });
            
            authResults.push(verifyResponse.role);
          }
          
          // Property assertions:
          // 1. All authentication attempts should return the same role
          const firstRole = authResults[0];
          for (const role of authResults) {
            expect(role).toBe(firstRole);
          }
          
          // 2. For new wallets, this should consistently be the default role
          expect(firstRole).toBe(DEFAULT_ROLE);
        }
      ),
      {
        numRuns: 50, // Fewer runs since we do multiple auth attempts per run
        verbose: true,
      }
    );
  });
});