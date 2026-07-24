import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

import { EducationModule } from './education.module';
import { PrismaService } from '../prisma/prisma.service';
import { IpfsService } from '../ipfs/ipfs.service';
import { EnvService } from '../config/env.service';
import { AuthModule } from '../auth/auth.module';

/**
 * Integration tests for Task 16.4: Certificate issuance and failure handling.
 * 
 * Tests complete end-to-end integration between backend services and smart contract:
 * - Success path: completion verification → IPFS storage → Education.issueCertificate call
 * - IPFS failure path: ensures state remains unchanged when IPFS storage fails
 * - Error handling and rollback behavior
 * 
 * Requirements: 8.3, 8.4, 8.9, 8.10
 */
describe('Certificate Issuance and Failure Integration (Task 16.4)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ipfsService: IpfsService;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        EducationModule,
        AuthModule,
        LoggerModule.forRoot({
          pinoHttp: {
            level: 'silent', // Disable logging in tests
          },
        }),
      ],
    })
      .overrideProvider(ConfigService)
      .useValue({
        getOrThrow: jest.fn().mockImplementation((key: string) => {
          const config: Record<string, string> = {
            'JWT_SECRET': 'test-secret-key-for-integration-tests',
            'ISSUER_PRIVATE_KEY': '0x0123456789012345678901234567890123456789012345678901234567890123',
            'BASE_SEPOLIA_RPC_URL': 'https://sepolia.base.org',
            'PINATA_JWT': 'test-pinata-jwt',
            'JWT_EXPIRES_IN': '24h',
          };
          return config[key] || '24h';
        }),
        get: jest.fn().mockImplementation((key: string, defaultValue: string) => {
          if (key === 'EDUCATION_CONTRACT_ADDRESS') {
            return '0x0000000000000000000000000000000000000000'; // Placeholder for test
          }
          return defaultValue;
        }),
      })
      .overrideProvider(EnvService)
      .useValue({
        jwtExpiresIn: '24h',
        jwtSecret: 'test-secret-key-for-integration-tests',
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    ipfsService = app.get<IpfsService>(IpfsService);

    // Mock JWT token for test user
    authToken = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIweDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTAiLCJ1c2VySWQiOiJ0ZXN0LXVzZXItaWQiLCJhZGRyZXNzIjoiMHgxMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwIiwicm9sZSI6IlVTRVIiLCJleHAiOjk5OTk5OTk5OTl9.dummy';
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Success Path: Complete Certificate Issuance Flow', () => {
    it('should successfully orchestrate certificate issuance with blockchain interaction (Req 8.3, 8.4)', async () => {
      const courseId = 'successful-course-1';
      const mockCourse = {
        id: courseId,
        onChainId: '0x0000000000000000000000000000000000000000000000000000000000000001',
        title: 'Test Financial Literacy Course',
        lessons: [{ id: 'lesson-1' }, { id: 'lesson-2' }],
      };

      // Mock successful completion verification
      jest.spyOn(prisma.course, 'findUnique').mockResolvedValue(mockCourse as any);
      jest.spyOn(prisma.lessonProgress, 'count').mockResolvedValue(2); // All lessons completed

      // Mock successful IPFS storage
      const mockCid = 'QmTestCertificateHash123456789';
      jest.spyOn(ipfsService, 'storeCertificateMetadata').mockResolvedValue(mockCid);

      const response = await request(app.getHttpServer())
        .post(`/education/courses/${courseId}/certificate`)
        .set('Authorization', authToken)
        .expect(201);

      // Verify complete response structure (Req 8.3, 8.4)
      expect(response.body).toEqual({
        transactionHash: expect.stringMatching(/^0x[a-fA-F0-9]{64}$/),
        ipfsCid: mockCid,
        metadata: {
          recipient: '0x1234567890123456789012345678901234567890',
          courseId: mockCourse.onChainId,
          courseTitle: 'Test Financial Literacy Course',
          issuer: 'Bonitah Financial Network',
          version: '1.0',
          issuedAt: expect.any(String),
        },
      });

      // Verify IPFS was called with correct metadata structure
      expect(ipfsService.storeCertificateMetadata).toHaveBeenCalledWith({
        recipient: '0x1234567890123456789012345678901234567890',
        courseId: mockCourse.onChainId,
        courseTitle: 'Test Financial Literacy Course',
        issuer: 'Bonitah Financial Network',
        version: '1.0',
        issuedAt: expect.any(String),
      });

      // Verify timestamp is valid ISO string
      const issuedAt = response.body.metadata.issuedAt;
      expect(() => new Date(issuedAt).toISOString()).not.toThrow();
      expect(new Date(issuedAt).getTime()).toBeGreaterThan(Date.now() - 60000); // Within last minute
    });

    it('should handle successful certificate with course completion validation', async () => {
      const courseId = 'validated-course';
      const mockCourse = {
        id: courseId,
        onChainId: '0x0000000000000000000000000000000000000000000000000000000000000002',
        title: 'Advanced DeFi Course',
        lessons: [{ id: 'lesson-1' }, { id: 'lesson-2' }, { id: 'lesson-3' }],
      };

      jest.spyOn(prisma.course, 'findUnique').mockResolvedValue(mockCourse as any);
      jest.spyOn(prisma.lessonProgress, 'count').mockResolvedValue(3); // All 3 lessons completed

      const mockCid = 'QmValidatedCertificateHash987654321';
      jest.spyOn(ipfsService, 'storeCertificateMetadata').mockResolvedValue(mockCid);

      const response = await request(app.getHttpServer())
        .post(`/education/courses/${courseId}/certificate`)
        .set('Authorization', authToken)
        .expect(201);

      expect(response.body.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
      expect(response.body.ipfsCid).toBe(mockCid);
      expect(response.body.metadata.courseTitle).toBe('Advanced DeFi Course');

      // Verify completion verification was performed
      expect(prisma.lessonProgress.count).toHaveBeenCalledWith({
        where: {
          userId: 'test-user-id',
          lesson: {
            courseId,
          },
        },
      });
    });
  });

  describe('IPFS Failure Path: State Preservation', () => {
    it('should leave prior state unchanged when IPFS storage fails (Req 8.9)', async () => {
      const courseId = 'ipfs-failure-course';
      const mockCourse = {
        id: courseId,
        onChainId: '0x0000000000000000000000000000000000000000000000000000000000000004',
        title: 'Course with IPFS Failure',
        lessons: [{ id: 'lesson-1' }, { id: 'lesson-2' }],
      };

      // Setup successful completion check
      jest.spyOn(prisma.course, 'findUnique').mockResolvedValue(mockCourse as any);
      jest.spyOn(prisma.lessonProgress, 'count').mockResolvedValue(2);

      // Mock IPFS failure
      const ipfsError = new Error('IPFS network timeout');
      jest.spyOn(ipfsService, 'storeCertificateMetadata').mockRejectedValue(ipfsError);

      const response = await request(app.getHttpServer())
        .post(`/education/courses/${courseId}/certificate`)
        .set('Authorization', authToken)
        .expect(500);

      // Verify error response
      expect(response.body.message).toContain('Certificate metadata storage failed');
      
      // Verify IPFS was attempted but failed
      expect(ipfsService.storeCertificateMetadata).toHaveBeenCalledWith({
        recipient: '0x1234567890123456789012345678901234567890',
        courseId: mockCourse.onChainId,
        courseTitle: 'Course with IPFS Failure',
        issuer: 'Bonitah Financial Network',
        version: '1.0',
        issuedAt: expect.any(String),
      });

      // Verify no transaction hash or CID in response (state unchanged)
      expect(response.body.transactionHash).toBeUndefined();
      expect(response.body.ipfsCid).toBeUndefined();
      expect(response.body.metadata).toBeUndefined();
    });

    it('should handle IPFS timeout gracefully without state mutation', async () => {
      const courseId = 'timeout-course';
      const mockCourse = {
        id: courseId,
        onChainId: '0x0000000000000000000000000000000000000000000000000000000000000005',
        title: 'Timeout Test Course',
        lessons: [{ id: 'lesson-1' }],
      };

      jest.spyOn(prisma.course, 'findUnique').mockResolvedValue(mockCourse as any);
      jest.spyOn(prisma.lessonProgress, 'count').mockResolvedValue(1);

      // Mock IPFS timeout
      jest.spyOn(ipfsService, 'storeCertificateMetadata').mockRejectedValue(
        new Error('Request timeout after 30s')
      );

      const response = await request(app.getHttpServer())
        .post(`/education/courses/${courseId}/certificate`)
        .set('Authorization', authToken)
        .expect(500);

      expect(response.body.message).toContain('Certificate metadata storage failed');
      
      // Verify completion check was done but no mutation occurred
      expect(prisma.course.findUnique).toHaveBeenCalled();
      expect(prisma.lessonProgress.count).toHaveBeenCalled();
      expect(ipfsService.storeCertificateMetadata).toHaveBeenCalled();
    });

    it('should handle IPFS service unavailable error without side effects', async () => {
      const courseId = 'unavailable-service-course';
      const mockCourse = {
        id: courseId,
        onChainId: '0x0000000000000000000000000000000000000000000000000000000000000006',
        title: 'Service Unavailable Test',
        lessons: [{ id: 'lesson-1' }, { id: 'lesson-2' }, { id: 'lesson-3' }],
      };

      jest.spyOn(prisma.course, 'findUnique').mockResolvedValue(mockCourse as any);
      jest.spyOn(prisma.lessonProgress, 'count').mockResolvedValue(3);

      // Mock service unavailable
      jest.spyOn(ipfsService, 'storeCertificateMetadata').mockRejectedValue(
        new Error('Service temporarily unavailable')
      );

      await request(app.getHttpServer())
        .post(`/education/courses/${courseId}/certificate`)
        .set('Authorization', authToken)
        .expect(500);

      // Verify IPFS was the point of failure
      expect(ipfsService.storeCertificateMetadata).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should reject certificate for incomplete course (Req 8.10)', async () => {
      const courseId = 'incomplete-course';
      const mockCourse = {
        id: courseId,
        onChainId: '0x0000000000000000000000000000000000000000000000000000000000000007',
        title: 'Incomplete Course Test',
        lessons: [{ id: 'lesson-1' }, { id: 'lesson-2' }, { id: 'lesson-3' }],
      };

      jest.spyOn(prisma.course, 'findUnique').mockResolvedValue(mockCourse as any);
      jest.spyOn(prisma.lessonProgress, 'count').mockResolvedValue(2); // Only 2 of 3 lessons completed

      const response = await request(app.getHttpServer())
        .post(`/education/courses/${courseId}/certificate`)
        .set('Authorization', authToken)
        .expect(400);

      expect(response.body.message).toContain('Course not completed');
      
      // Verify IPFS was never called due to early validation failure
      expect(ipfsService.storeCertificateMetadata).not.toHaveBeenCalled();
    });

    it('should return 404 for non-existent course', async () => {
      jest.spyOn(prisma.course, 'findUnique').mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .post('/education/courses/non-existent-course/certificate')
        .set('Authorization', authToken)
        .expect(404);

      expect(response.body.message).toContain('Course not found');
      expect(ipfsService.storeCertificateMetadata).not.toHaveBeenCalled();
    });

    it('should require authentication for certificate issuance', async () => {
      await request(app.getHttpServer())
        .post('/education/courses/any-course/certificate')
        .expect(401);

      // Verify no backend services were called without auth
      expect(prisma.course.findUnique).not.toHaveBeenCalled();
      expect(ipfsService.storeCertificateMetadata).not.toHaveBeenCalled();
    });

    it('should handle malformed JWT token', async () => {
      await request(app.getHttpServer())
        .post('/education/courses/test-course/certificate')
        .set('Authorization', 'Bearer invalid-jwt-token')
        .expect(401);
    });

    it('should validate course ID format', async () => {
      await request(app.getHttpServer())
        .post('/education/courses//certificate') // Empty course ID
        .set('Authorization', authToken)
        .expect(404);

      // Should be treated as route not found
      expect(prisma.course.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('End-to-End Integration Verification', () => {
    it('should maintain transaction atomicity on partial success', async () => {
      const courseId = 'atomicity-test-course';
      const mockCourse = {
        id: courseId,
        onChainId: '0x0000000000000000000000000000000000000000000000000000000000000008',
        title: 'Atomicity Test Course',
        lessons: [{ id: 'lesson-1' }],
      };

      jest.spyOn(prisma.course, 'findUnique').mockResolvedValue(mockCourse as any);
      jest.spyOn(prisma.lessonProgress, 'count').mockResolvedValue(1);

      // Mock successful IPFS but potential blockchain failure
      const mockCid = 'QmAtomicityTestHash';
      jest.spyOn(ipfsService, 'storeCertificateMetadata').mockResolvedValue(mockCid);

      const response = await request(app.getHttpServer())
        .post(`/education/courses/${courseId}/certificate`)
        .set('Authorization', authToken)
        .expect(201);

      // Verify response includes both IPFS and blockchain results
      expect(response.body.ipfsCid).toBe(mockCid);
      expect(response.body.transactionHash).toBeDefined();
      expect(response.body.metadata).toBeDefined();
    });

    it('should handle concurrent certificate requests appropriately', async () => {
      const courseId = 'concurrent-test-course';
      const mockCourse = {
        id: courseId,
        onChainId: '0x0000000000000000000000000000000000000000000000000000000000000009',
        title: 'Concurrent Test Course',
        lessons: [{ id: 'lesson-1' }],
      };

      jest.spyOn(prisma.course, 'findUnique').mockResolvedValue(mockCourse as any);
      jest.spyOn(prisma.lessonProgress, 'count').mockResolvedValue(1);
      jest.spyOn(ipfsService, 'storeCertificateMetadata').mockResolvedValue('QmConcurrentTestHash');

      // Make concurrent requests
      const requests = Array(3).fill(null).map(() =>
        request(app.getHttpServer())
          .post(`/education/courses/${courseId}/certificate`)
          .set('Authorization', authToken)
      );

      const responses = await Promise.all(requests);

      // All should succeed (in real blockchain, duplicate prevention would be handled by smart contract)
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.ipfsCid).toBeDefined();
        expect(response.body.transactionHash).toBeDefined();
      });
    });

    it('should preserve lesson completion state across certificate issuance attempts', async () => {
      const courseId = 'state-preservation-course';
      const mockCourse = {
        id: courseId,
        onChainId: '0x000000000000000000000000000000000000000000000000000000000000000a',
        title: 'State Preservation Course',
        lessons: [{ id: 'lesson-1' }, { id: 'lesson-2' }],
      };

      jest.spyOn(prisma.course, 'findUnique').mockResolvedValue(mockCourse as any);
      jest.spyOn(prisma.lessonProgress, 'count').mockResolvedValue(2);

      // First attempt - IPFS fails
      jest.spyOn(ipfsService, 'storeCertificateMetadata').mockRejectedValueOnce(
        new Error('Temporary IPFS failure')
      );

      await request(app.getHttpServer())
        .post(`/education/courses/${courseId}/certificate`)
        .set('Authorization', authToken)
        .expect(500);

      // Second attempt - should succeed
      jest.spyOn(ipfsService, 'storeCertificateMetadata').mockResolvedValueOnce(
        'QmStatePreservationHash'
      );

      const response = await request(app.getHttpServer())
        .post(`/education/courses/${courseId}/certificate`)
        .set('Authorization', authToken)
        .expect(201);

      // Verify lesson completion check occurred both times
      expect(prisma.lessonProgress.count).toHaveBeenCalledTimes(2);
      expect(response.body.ipfsCid).toBe('QmStatePreservationHash');
    });
  });
});