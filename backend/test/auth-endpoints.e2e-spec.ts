import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import request from 'supertest';
import { SiweMessage } from 'siwe';
import { privateKeyToAccount } from 'viem/accounts';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { TokenService } from '../src/auth/token.service';

/**
 * Integration tests for auth endpoints (Task 11.6)
 *
 * Tests the complete nonce → verify → JWT flow and rejection paths:
 * - Invalid signature, reused/expired nonce, expired JWT
 * 
 * **Validates: Requirements 2.5, 2.6, 2.8, 2.9**
 */
describe('Auth Endpoints (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenService: TokenService;

  // Test wallets with known private keys for signing
  const testWallet = privateKeyToAccount('0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');
  const testWallet2 = privateKeyToAccount('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');

  beforeAll(async () => {
    // Set up test environment
    Object.assign(process.env, {
      NODE_ENV: 'test',
      PORT: '3998',
      LOG_LEVEL: 'silent',
      DATABASE_URL: 'postgresql://bfn:bfn@localhost:5432/bfn_test?schema=public',
      REDIS_URL: 'redis://localhost:6379/1', // Use different DB for tests
      BASE_SEPOLIA_RPC_URL: 'https://sepolia.base.org',
      CHAIN_ID: '84532',
      JWT_SECRET: 'test-secret-32-chars-long-enough-for-hmac',
      JWT_EXPIRES_IN: '24h',
      PINATA_JWT: 'test-pinata-jwt-token-for-testing', // Add required IPFS config
      ISSUER_PRIVATE_KEY: 'test-issuer-private-key-placeholder', // Add required education config
      OPENAI_API_KEY: 'test-openai-api-key-for-testing', // Add OpenAI config if needed
    });

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication({ bufferLogs: true });
    app.useLogger(app.get(Logger));
    
    prisma = app.get<PrismaService>(PrismaService);
    tokenService = app.get<TokenService>(TokenService);
    
    await app.init();

    // Clean up test data before starting
    await prisma.authNonce.deleteMany({});
    await prisma.user.deleteMany({});
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.authNonce.deleteMany({});
    await prisma.user.deleteMany({});
    await app?.close();
  });

  beforeEach(async () => {
    // Clean up test data between tests
    await prisma.authNonce.deleteMany({});
    await prisma.user.deleteMany({});
  });

  describe('Successful SIWE Authentication Flow', () => {
    it('should complete nonce → verify → JWT flow successfully', async () => {
      const walletAddress = testWallet.address;

      // Step 1: Request a nonce
      const nonceResponse = await request(app.getHttpServer())
        .post('/auth/nonce')
        .send({ address: walletAddress })
        .expect(200);

      expect(nonceResponse.body).toMatchObject({
        nonce: expect.stringMatching(/^[0-9a-f]{32}$/), // 32 hex chars
      });

      const { nonce } = nonceResponse.body;

      // Step 2: Create and sign SIWE message
      const siweMessage = new SiweMessage({
        domain: 'app.bfn.test',
        address: walletAddress,
        statement: 'Sign in to Bonitah Financial Network',
        uri: 'https://app.bfn.test',
        version: '1',
        chainId: 84532, // Base Sepolia
        nonce,
      });

      const message = siweMessage.prepareMessage();
      const signature = await testWallet.signMessage({ message });

      // Step 3: Verify the signature and get JWT
      const verifyResponse = await request(app.getHttpServer())
        .post('/auth/verify')
        .send({ message, signature })
        .expect(200);

      expect(verifyResponse.body).toMatchObject({
        jwt: expect.any(String),
        address: walletAddress.toLowerCase(),
        role: 'USER', // Default role for new wallets (Req 2.10)
        expiresAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      });

      // Verify JWT is valid and contains correct claims
      const { jwt } = verifyResponse.body;
      const decoded = tokenService.verify(jwt);
      expect(decoded.sub).toBe(walletAddress.toLowerCase());
      expect(decoded.address).toBe(walletAddress.toLowerCase());
      expect(decoded.role).toBe('USER');
      expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));

      // Verify user record was created in database
      const user = await prisma.user.findUnique({
        where: { walletAddress: walletAddress.toLowerCase() },
      });
      expect(user).toMatchObject({
        walletAddress: walletAddress.toLowerCase(),
        role: 'USER',
      });

      // Verify nonce was marked as used
      const usedNonce = await prisma.authNonce.findUnique({
        where: { nonce },
      });
      expect(usedNonce?.used).toBe(true);
    });

    it('should preserve existing user role on re-authentication', async () => {
      const walletAddress = testWallet.address;

      // Create user with non-default role
      await prisma.user.create({
        data: {
          walletAddress: walletAddress.toLowerCase(),
          role: 'ADMIN',
        },
      });

      // Go through auth flow
      const nonceResponse = await request(app.getHttpServer())
        .post('/auth/nonce')
        .send({ address: walletAddress })
        .expect(200);

      const { nonce } = nonceResponse.body;

      const siweMessage = new SiweMessage({
        domain: 'app.bfn.test',
        address: walletAddress,
        statement: 'Sign in to Bonitah Financial Network',
        uri: 'https://app.bfn.test',
        version: '1',
        chainId: 84532,
        nonce,
      });

      const message = siweMessage.prepareMessage();
      const signature = await testWallet.signMessage({ message });

      const verifyResponse = await request(app.getHttpServer())
        .post('/auth/verify')
        .send({ message, signature })
        .expect(200);

      // Should preserve existing ADMIN role, not default to USER
      expect(verifyResponse.body.role).toBe('ADMIN');
    });
  });

  describe('Invalid Signature Rejection', () => {
    it('should reject verification with invalid signature', async () => {
      const walletAddress = testWallet.address;

      // Get a valid nonce
      const nonceResponse = await request(app.getHttpServer())
        .post('/auth/nonce')
        .send({ address: walletAddress })
        .expect(200);

      const { nonce } = nonceResponse.body;

      // Create valid SIWE message
      const siweMessage = new SiweMessage({
        domain: 'app.bfn.test',
        address: walletAddress,
        statement: 'Sign in to Bonitah Financial Network',
        uri: 'https://app.bfn.test',
        version: '1',
        chainId: 84532,
        nonce,
      });

      const message = siweMessage.prepareMessage();
      
      // Use INVALID signature (from different wallet)
      const wrongSignature = await testWallet2.signMessage({ message });

      // Should reject with authentication error
      const verifyResponse = await request(app.getHttpServer())
        .post('/auth/verify')
        .send({ message, signature: wrongSignature })
        .expect(401);

      expect(verifyResponse.body).toMatchObject({
        statusCode: 401,
        message: 'Authentication failed',
      });

      // Verify nonce was NOT marked as used
      const nonceRecord = await prisma.authNonce.findUnique({
        where: { nonce },
      });
      expect(nonceRecord?.used).toBe(false);

      // Verify no user record was created
      const user = await prisma.user.findUnique({
        where: { walletAddress: walletAddress.toLowerCase() },
      });
      expect(user).toBeNull();
    });

    it('should reject verification with malformed signature', async () => {
      const walletAddress = testWallet.address;

      const nonceResponse = await request(app.getHttpServer())
        .post('/auth/nonce')
        .send({ address: walletAddress })
        .expect(200);

      const { nonce } = nonceResponse.body;

      const siweMessage = new SiweMessage({
        domain: 'app.bfn.test',
        address: walletAddress,
        statement: 'Sign in to Bonitah Financial Network',
        uri: 'https://app.bfn.test',
        version: '1',
        chainId: 84532,
        nonce,
      });

      const message = siweMessage.prepareMessage();

      // Use malformed signature
      const malformedSignature = '0xinvalid';

      await request(app.getHttpServer())
        .post('/auth/verify')
        .send({ message, signature: malformedSignature })
        .expect(401);
    });
  });

  describe('Nonce Reuse and Expiry Rejection', () => {
    it('should reject reused nonce (single-use constraint)', async () => {
      const walletAddress = testWallet.address;

      // Get a nonce and complete successful auth
      const nonceResponse = await request(app.getHttpServer())
        .post('/auth/nonce')
        .send({ address: walletAddress })
        .expect(200);

      const { nonce } = nonceResponse.body;

      const siweMessage = new SiweMessage({
        domain: 'app.bfn.test',
        address: walletAddress,
        statement: 'Sign in to Bonitah Financial Network',
        uri: 'https://app.bfn.test',
        version: '1',
        chainId: 84532,
        nonce,
      });

      const message = siweMessage.prepareMessage();
      const signature = await testWallet.signMessage({ message });

      // First verification should succeed
      await request(app.getHttpServer())
        .post('/auth/verify')
        .send({ message, signature })
        .expect(200);

      // Second verification with same nonce should fail
      await request(app.getHttpServer())
        .post('/auth/verify')
        .send({ message, signature })
        .expect(401);
    });

    it('should reject expired nonce', async () => {
      const walletAddress = testWallet.address;

      // Manually create expired nonce in database
      const expiredNonce = 'deadbeefdeadbeefdeadbeefdeadbeef';
      const expiredDate = new Date(Date.now() - 60000); // 1 minute ago

      await prisma.authNonce.create({
        data: {
          nonce: expiredNonce,
          address: walletAddress.toLowerCase(),
          expiresAt: expiredDate,
          used: false,
        },
      });

      // Try to use expired nonce
      const siweMessage = new SiweMessage({
        domain: 'app.bfn.test',
        address: walletAddress,
        statement: 'Sign in to Bonitah Financial Network',
        uri: 'https://app.bfn.test',
        version: '1',
        chainId: 84532,
        nonce: expiredNonce,
      });

      const message = siweMessage.prepareMessage();
      const signature = await testWallet.signMessage({ message });

      // Should reject expired nonce
      await request(app.getHttpServer())
        .post('/auth/verify')
        .send({ message, signature })
        .expect(401);

      // Verify nonce was not marked as used (since it was rejected)
      const nonceRecord = await prisma.authNonce.findUnique({
        where: { nonce: expiredNonce },
      });
      expect(nonceRecord?.used).toBe(false);
    });

    it('should reject unknown nonce', async () => {
      const walletAddress = testWallet.address;
      const unknownNonce = 'cafebabecafebabecafebabecafebabe';

      // Try to use nonce that was never issued
      const siweMessage = new SiweMessage({
        domain: 'app.bfn.test',
        address: walletAddress,
        statement: 'Sign in to Bonitah Financial Network',
        uri: 'https://app.bfn.test',
        version: '1',
        chainId: 84532,
        nonce: unknownNonce,
      });

      const message = siweMessage.prepareMessage();
      const signature = await testWallet.signMessage({ message });

      // Should reject unknown nonce
      await request(app.getHttpServer())
        .post('/auth/verify')
        .send({ message, signature })
        .expect(401);
    });

    it('should reject nonce issued for different address', async () => {
      // Issue nonce for wallet 1
      const nonceResponse = await request(app.getHttpServer())
        .post('/auth/nonce')
        .send({ address: testWallet.address })
        .expect(200);

      const { nonce } = nonceResponse.body;

      // Try to use it with wallet 2
      const siweMessage = new SiweMessage({
        domain: 'app.bfn.test',
        address: testWallet2.address, // Different wallet!
        statement: 'Sign in to Bonitah Financial Network',
        uri: 'https://app.bfn.test',
        version: '1',
        chainId: 84532,
        nonce,
      });

      const message = siweMessage.prepareMessage();
      const signature = await testWallet2.signMessage({ message });

      // Should reject (nonce was issued for different address)
      await request(app.getHttpServer())
        .post('/auth/verify')
        .send({ message, signature })
        .expect(401);
    });
  });

  describe('JWT Validation Integration', () => {
    it('should create valid JWT that can be verified', async () => {
      // Complete auth flow to get valid JWT
      const walletAddress = testWallet.address;

      const nonceResponse = await request(app.getHttpServer())
        .post('/auth/nonce')
        .send({ address: walletAddress })
        .expect(200);

      const { nonce } = nonceResponse.body;

      const siweMessage = new SiweMessage({
        domain: 'app.bfn.test',
        address: walletAddress,
        statement: 'Sign in to Bonitah Financial Network',
        uri: 'https://app.bfn.test',
        version: '1',
        chainId: 84532,
        nonce,
      });

      const message = siweMessage.prepareMessage();
      const signature = await testWallet.signMessage({ message });

      const verifyResponse = await request(app.getHttpServer())
        .post('/auth/verify')
        .send({ message, signature })
        .expect(200);

      const { jwt } = verifyResponse.body;

      // Verify the JWT can be successfully decoded
      const decoded = tokenService.verify(jwt);
      expect(decoded.sub).toBe(walletAddress.toLowerCase());
      expect(decoded.address).toBe(walletAddress.toLowerCase());
      expect(decoded.role).toBe('USER');
      expect(decoded.userId).toBeDefined();
      expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('should reject malformed JWT through token service', async () => {
      const malformedJwt = 'not.a.valid.jwt';

      // Test that the token service rejects malformed JWTs
      expect(() => tokenService.verify(malformedJwt))
        .toThrow('Valid authentication is required');
    });

    it('should have JWT with expiry in the future', async () => {
      // Complete auth to get JWT
      const walletAddress = testWallet.address;

      const nonceResponse = await request(app.getHttpServer())
        .post('/auth/nonce')
        .send({ address: walletAddress })
        .expect(200);

      const { nonce } = nonceResponse.body;

      const siweMessage = new SiweMessage({
        domain: 'app.bfn.test',
        address: walletAddress,
        statement: 'Sign in to Bonitah Financial Network',
        uri: 'https://app.bfn.test',
        version: '1',
        chainId: 84532,
        nonce,
      });

      const message = siweMessage.prepareMessage();
      const signature = await testWallet.signMessage({ message });

      const verifyResponse = await request(app.getHttpServer())
        .post('/auth/verify')
        .send({ message, signature })
        .expect(200);

      const { jwt } = verifyResponse.body;
      const decoded = tokenService.verify(jwt);

      // JWT should not be expired (exp > current time)
      const now = Math.floor(Date.now() / 1000);
      expect(decoded.exp).toBeGreaterThan(now);
      
      // JWT should expire within 24 hours (Req 2.7)
      const maxExpiry = now + (24 * 60 * 60);
      expect(decoded.exp).toBeLessThanOrEqual(maxExpiry);
    });
  });

  describe('Logout Flow', () => {
    it('should handle logout request (stateless JWT)', async () => {
      // Logout is stateless with JWTs - just returns success
      const logoutResponse = await request(app.getHttpServer())
        .post('/auth/logout')
        .expect(200);

      expect(logoutResponse.body).toEqual({
        success: true,
      });
    });
  });

  describe('Input Validation', () => {
    it('should validate nonce request input', async () => {
      // Missing address
      await request(app.getHttpServer())
        .post('/auth/nonce')
        .send({})
        .expect(400);

      // Invalid address format
      await request(app.getHttpServer())
        .post('/auth/nonce')
        .send({ address: 'not-an-address' })
        .expect(400);

      // Non-hex address
      await request(app.getHttpServer())
        .post('/auth/nonce')
        .send({ address: '0xnotavalidhexaddress123456789012345678' })
        .expect(400);
    });

    it('should validate verify request input', async () => {
      // Missing message
      await request(app.getHttpServer())
        .post('/auth/verify')
        .send({ signature: '0xdeadbeef' })
        .expect(400);

      // Missing signature
      await request(app.getHttpServer())
        .post('/auth/verify')
        .send({ message: 'some message' })
        .expect(400);

      // Invalid signature format
      await request(app.getHttpServer())
        .post('/auth/verify')
        .send({ 
          message: 'some message',
          signature: 'not-hex'
        })
        .expect(400);
    });
  });
});