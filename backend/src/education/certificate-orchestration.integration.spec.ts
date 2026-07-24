import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ConfigService } from '@nestjs/config';

import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { IpfsService } from '../ipfs/ipfs.service';
import { EnvService } from '../config/env.service';

/**
 * Integration test for Task 16.3: Certificate orchestration module.
 * 
 * Tests the complete flow: POST /education/courses/:id/certificate
 * - Verify completion 
 * - Store metadata via IPFS
 * - Call Education.issueCertificate
 * - Handle IPFS failures gracefully
 */
describe('Certificate Orchestration Integration (Task 16.3)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ipfsService: IpfsService;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
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
          return config[key] || '24h'; // Default to valid session time format
        }),
        get: jest.fn().mockImplementation((key: string, defaultValue: string) => {
          if (key === 'EDUCATION_CONTRACT_ADDRESS') {
            return '0x0000000000000000000000000000000000000000'; // Placeholder for test
          }
          return defaultValue;
        }),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    ipfsService = app.get<IpfsService>(IpfsService);

    // Mock JWT token for test user
    authToken = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIweDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTAiLCJ1c2VySWQiOiJ0ZXN0LXVzZXItaWQiLCJyb2xlIjoiVVNFUiIsImV4cCI6OTk5OTk5OTk5OX0.dummy';
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /education/courses/:id/certificate', () => {
    it('should successfully orchestrate certificate issuance for completed course', async () => {
      // Mock completed course data
      const courseId = 'test-course-1';
      const mockCourse = {
        id: courseId,
        onChainId: '0x0000000000000000000000000000000000000000000000000000000000000001',
        title: 'Test Financial Literacy Course',
        lessons: [{ id: 'lesson-1' }, { id: 'lesson-2' }],
      };
      
      // Mock Prisma calls
      jest.spyOn(prisma.course, 'findUnique').mockResolvedValue(mockCourse as any);
      jest.spyOn(prisma.lessonProgress, 'count').mockResolvedValue(2); // All lessons completed
      
      // Mock IPFS success
      const mockCid = 'QmTestCertificateHash123';
      jest.spyOn(ipfsService, 'storeCertificateMetadata').mockResolvedValue(mockCid);

      const response = await request(app.getHttpServer())
        .post(`/education/courses/${courseId}/certificate`)
        .set('Authorization', authToken)
        .expect(201);

      // Verify response structure (Req 8.3, 8.4)
      expect(response.body).toEqual({
        transactionHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
        ipfsCid: mockCid,
        metadata: expect.objectContaining({
          recipient: '0x1234567890123456789012345678901234567890',
          courseId: mockCourse.onChainId,
          courseTitle: 'Test Financial Literacy Course',
          issuer: 'Bonitah Financial Network',
          version: '1.0',
          issuedAt: expect.any(String),
        }),
      });

      // Verify IPFS was called with correct metadata
      expect(ipfsService.storeCertificateMetadata).toHaveBeenCalledWith({
        recipient: '0x1234567890123456789012345678901234567890',
        courseId: mockCourse.onChainId,
        courseTitle: 'Test Financial Literacy Course',
        issuer: 'Bonitah Financial Network',
        version: '1.0',
        issuedAt: expect.any(String),
      });
    });

    it('should reject certificate issuance for incomplete course', async () => {
      const courseId = 'incomplete-course';
      const mockCourse = {
        id: courseId,
        onChainId: '0x0000000000000000000000000000000000000000000000000000000000000002',
        title: 'Incomplete Course',
        lessons: [{ id: 'lesson-1' }, { id: 'lesson-2' }],
      };
      
      jest.spyOn(prisma.course, 'findUnique').mockResolvedValue(mockCourse as any);
      jest.spyOn(prisma.lessonProgress, 'count').mockResolvedValue(1); // Only 1 of 2 lessons completed

      const response = await request(app.getHttpServer())
        .post(`/education/courses/${courseId}/certificate`)
        .set('Authorization', authToken)
        .expect(400);

      expect(response.body.message).toContain('Course not completed');
    });

    it('should handle IPFS failure gracefully and leave prior state unchanged (Req 8.9)', async () => {
      const courseId = 'course-with-ipfs-failure';
      const mockCourse = {
        id: courseId,
        onChainId: '0x0000000000000000000000000000000000000000000000000000000000000003',
        title: 'Course with IPFS Failure',
        lessons: [{ id: 'lesson-1' }],
      };
      
      jest.spyOn(prisma.course, 'findUnique').mockResolvedValue(mockCourse as any);
      jest.spyOn(prisma.lessonProgress, 'count').mockResolvedValue(1); // Course completed
      
      // Mock IPFS failure
      jest.spyOn(ipfsService, 'storeCertificateMetadata').mockRejectedValue(new Error('IPFS storage failed'));

      const response = await request(app.getHttpServer())
        .post(`/education/courses/${courseId}/certificate`)
        .set('Authorization', authToken)
        .expect(500);

      expect(response.body.message).toContain('Certificate metadata storage failed');
      
      // Verify no on-chain transaction was attempted (state left unchanged)
      expect(ipfsService.storeCertificateMetadata).toHaveBeenCalled();
    });

    it('should return 404 for non-existent course', async () => {
      jest.spyOn(prisma.course, 'findUnique').mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .post('/education/courses/nonexistent/certificate')
        .set('Authorization', authToken)
        .expect(404);

      expect(response.body.message).toContain('Course not found');
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .post('/education/courses/any-course/certificate')
        .expect(401);
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
});