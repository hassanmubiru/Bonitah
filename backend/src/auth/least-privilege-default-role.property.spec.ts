import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { SiweMessage } from 'siwe';
import { generatePrivateKey, privateKeyToAccount, privateKeyToAddress } from 'viem/accounts';
import * as fc from 'fast-check';

import { AuthService } from './auth.service';
import { AuthModule } from './auth.module';
import { PrismaService } from '../prisma/prisma.service';
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
  let prisma: PrismaService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [AuthModule],
    })
      .setLogger(new Logger())
      .compile();

    authService = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await module?.close();
  });

  beforeEach(async () => {
    // Clean up users table for each test to ensure isolation
    await prisma.user.deleteMany();
    await prisma.authNonce.deleteMany();
  });

  /**
   * Property: New wallets always receive the least-privilege default role
   */
  it('Property 6: New wallets default to least-privilege role', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.hexaString({ minLength: 40, maxLength: 40 }), { minLength: 1, maxLength: 10 }),
        async (addressSuffixes) => {
          // Generate unique wallet addresses for this test run
          const walletAddresses = addressSuffixes.map(suffix => `0x${suffix.padStart(40, '0')}`);
          
          for (const walletAddress of walletAddresses) {
            // Generate a valid private key and account for signing
            const privateKey = generatePrivateKey();
            const account = privateKeyToAccount(privateKey);
            const signerAddress = privateKeyToAddress(privateKey);
            
            // Use the generated signer address (ensuring we have signing capability)
            const testAddress = signerAddress.toLowerCase();
            
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
            
            // Property assertions:
            // 1. The wallet received a role assignment
            expect(verifyResponse.role).toBeDefined();
            
            // 2. For new wallets, the role must be the least-privilege default role
            expect(verifyResponse.role).toBe(DEFAULT_ROLE);
            
            // 3. The role must be a valid role from the defined set
            const validRoles: Role[] = ['USER', 'VERIFIER', 'ADMIN'];
            expect(validRoles).toContain(verifyResponse.role);
            
            // 4. The default role must be 'USER' (least-privilege, non-administrative)
            expect(DEFAULT_ROLE).toBe('USER');
            
            // 5. Verify the user exists in the database with the correct role
            const user = await prisma.user.findUnique({
              where: { walletAddress: testAddress },
            });
            expect(user).toBeTruthy();
            expect(user!.role).toBe(DEFAULT_ROLE);
            expect(user!.role).toBe('USER');
          }
        }
      ),
      { 
        numRuns: 100, // Minimum 100 iterations as specified in requirements
        verbose: true,
      }
    );
  });

  /**
   * Property: Existing wallets retain their assigned role (not overwritten to default)
   */
  it('Property 6b: Existing wallets retain their assigned role', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('VERIFIER', 'ADMIN'), // Test with non-default roles
        fc.hexaString({ minLength: 40, maxLength: 40 }),
        async (existingRole: Role, addressSuffix) => {
          const testAddress = `0x${addressSuffix.padStart(40, '0')}`;
          
          // Pre-create a user with a non-default role
          await prisma.user.create({
            data: {
              walletAddress: testAddress.toLowerCase(),
              role: existingRole,
            },
          });
          
          // Generate signing capability for this address
          const privateKey = generatePrivateKey();
          const account = privateKeyToAccount(privateKey);
          const signerAddress = privateKeyToAddress(privateKey);
          
          // Update the pre-created user to use the signer address
          await prisma.user.updateMany({
            where: { walletAddress: testAddress.toLowerCase() },
            data: { walletAddress: signerAddress.toLowerCase() },
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
          const user = await prisma.user.findUnique({
            where: { walletAddress: signerAddress.toLowerCase() },
          });
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
        async (addressSuffix) => {
          const privateKey = generatePrivateKey();
          const account = privateKeyToAccount(privateKey);
          const testAddress = privateKeyToAddress(privateKey);
          
          const authResults: Role[] = [];
          
          // Authenticate the same wallet multiple times
          for (let i = 0; i < 3; i++) {
            // Clean nonces to allow re-authentication
            await prisma.authNonce.deleteMany({
              where: { address: testAddress.toLowerCase() },
            });
            
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