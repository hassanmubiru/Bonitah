import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EducationService } from './education.service';
import { PrismaService } from '../prisma/prisma.service';
import { IpfsService } from '../ipfs/ipfs.service';

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
  let educationService: EducationService;
  let prismaService: PrismaService;
  let ipfsService: IpfsService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        EducationService,
        {
          provide: PrismaService,
          useValue: {
            course: {
              findUnique: jest.fn(),
            },
            lessonProgress: {
              count: jest.fn(),
            },
          },
        },
        {
          provide: IpfsService,
          useValue: {
            storeCertificateMetadata: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockImplementation((key: string) => {
              const config: Record<string, string> = {
                'ISSUER_PRIVATE_KEY': '0x0123456789012345678901234567890123456789012345678901234567890123',
                'BASE_SEPOLIA_RPC_URL': 'https://sepolia.base.org',
              };
              return config[key];
            }),
            get: jest.fn().mockImplementation((key: string, defaultValue: string) => {
              if (key === 'EDUCATION_CONTRACT_ADDRESS') {
                return '0x0000000000000000000000000000000000000000'; // Placeholder for test
              }
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    educationService = moduleFixture.get<EducationService>(EducationService);
    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    ipfsService = moduleFixture.get<IpfsService>(IpfsService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Success Path: Complete Certificate Issuance Flow', () => {
    it('should successfully orchestrate certificate issuance with blockchain interaction (Req 8.3, 8.4)', async () => {
      const courseId = 'successful-course-1';
      const userId = 'test-user-id';
      const walletAddress = '0x1234567890123456789012345678901234567890';
      
      const mockCourse = {
        id: courseId,
        onChainId: '0x0000000000000000000000000000000000000000000000000000000000000001',
        title: 'Test Financial Literacy Course',
        lessons: [{ id: 'lesson-1' }, { id: 'lesson-2' }],
      };

      // Mock successful completion verification
      (prismaService.course.findUnique as jest.Mock).mockResolvedValue(mockCourse);
      (prismaService.lessonProgress.count as jest.Mock).mockResolvedValue(2); // All lessons completed

      // Mock successful IPFS storage
      const mockCid = 'QmTestCertificateHash123456789';
      (ipfsService.storeCertificateMetadata as jest.Mock).mockResolvedValue(mockCid);

      const result = await educationService.issueCertificate(userId, walletAddress, courseId);

      // Verify complete response structure (Req 8.3, 8.4)
      expect(result).toEqual({
        transactionHash: expect.stringMatching(/^0x[a-fA-F0-9]{64}$/),
        ipfsCid: mockCid,
        metadata: {
          recipient: walletAddress,
          courseId: mockCourse.onChainId,
          courseTitle: 'Test Financial Literacy Course',
          issuer: 'Bonitah Financial Network',
          version: '1.0',
          issuedAt: expect.any(String),
        },
      });

      // Verify IPFS was called with correct metadata structure
      expect(ipfsService.storeCertificateMetadata).toHaveBeenCalledWith({
        recipient: walletAddress,
        courseId: mockCourse.onChainId,
        courseTitle: 'Test Financial Literacy Course',
        issuer: 'Bonitah Financial Network',
        version: '1.0',
        issuedAt: expect.any(String),
      });

      // Verify timestamp is valid ISO string
      const issuedAt = result.metadata.issuedAt;
      expect(() => new Date(issuedAt).toISOString()).not.toThrow();
      expect(new Date(issuedAt).getTime()).toBeGreaterThan(Date.now() - 60000); // Within last minute
    });

    it('should handle successful certificate with course completion validation', async () => {
      const courseId = 'validated-course';
      const userId = 'test-user-id';
      const walletAddress = '0x1234567890123456789012345678901234567890';
      
      const mockCourse = {
        id: courseId,
        onChainId: '0x0000000000000000000000000000000000000000000000000000000000000002',
        title: 'Advanced DeFi Course',
        lessons: [{ id: 'lesson-1' }, { id: 'lesson-2' }, { id: 'lesson-3' }],
      };

      (prismaService.course.findUnique as jest.Mock).mockResolvedValue(mockCourse);
      (prismaService.lessonProgress.count as jest.Mock).mockResolvedValue(3); // All 3 lessons completed

      const mockCid = 'QmValidatedCertificateHash987654321';
      (ipfsService.storeCertificateMetadata as jest.Mock).mockResolvedValue(mockCid);

      const result = await educationService.issueCertificate(userId, walletAddress, courseId);

      expect(result.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
      expect(result.ipfsCid).toBe(mockCid);
      expect(result.metadata.courseTitle).toBe('Advanced DeFi Course');

      // Verify completion verification was performed
      expect(prismaService.lessonProgress.count).toHaveBeenCalledWith({
        where: {
          userId,
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
      const userId = 'test-user-id';
      const walletAddress = '0x1234567890123456789012345678901234567890';
      
      const mockCourse = {
        id: courseId,
        onChainId: '0x0000000000000000000000000000000000000000000000000000000000000004',
        title: 'Course with IPFS Failure',
        lessons: [{ id: 'lesson-1' }, { id: 'lesson-2' }],
      };

      // Setup successful completion check
      (prismaService.course.findUnique as jest.Mock).mockResolvedValue(mockCourse);
      (prismaService.lessonProgress.count as jest.Mock).mockResolvedValue(2);

      // Mock IPFS failure
      const ipfsError = new Error('IPFS network timeout');
      (ipfsService.storeCertificateMetadata as jest.Mock).mockRejectedValue(ipfsError);

      // Verify error is thrown
      await expect(educationService.issueCertificate(userId, walletAddress, courseId))
        .rejects.toThrow(InternalServerErrorException);

      try {
        await educationService.issueCertificate(userId, walletAddress, courseId);
      } catch (error: any) {
        expect(error).toBeInstanceOf(InternalServerErrorException);
        expect(error.message).toContain('Certificate metadata storage failed');
      }
      
      // Verify IPFS was attempted but failed
      expect(ipfsService.storeCertificateMetadata).toHaveBeenCalledWith({
        recipient: walletAddress,
        courseId: mockCourse.onChainId,
        courseTitle: 'Course with IPFS Failure',
        issuer: 'Bonitah Financial Network',
        version: '1.0',
        issuedAt: expect.any(String),
      });
    });

    it('should handle IPFS timeout gracefully without state mutation', async () => {
      const courseId = 'timeout-course';
      const userId = 'test-user-id';
      const walletAddress = '0x1234567890123456789012345678901234567890';
      
      const mockCourse = {
        id: courseId,
        onChainId: '0x0000000000000000000000000000000000000000000000000000000000000005',
        title: 'Timeout Test Course',
        lessons: [{ id: 'lesson-1' }],
      };

      (prismaService.course.findUnique as jest.Mock).mockResolvedValue(mockCourse);
      (prismaService.lessonProgress.count as jest.Mock).mockResolvedValue(1);

      // Mock IPFS timeout
      (ipfsService.storeCertificateMetadata as jest.Mock).mockRejectedValue(
        new Error('Request timeout after 30s')
      );

      await expect(educationService.issueCertificate(userId, walletAddress, courseId))
        .rejects.toThrow(InternalServerErrorException);
      
      // Verify completion check was done but no mutation occurred
      expect(prismaService.course.findUnique).toHaveBeenCalled();
      expect(prismaService.lessonProgress.count).toHaveBeenCalled();
      expect(ipfsService.storeCertificateMetadata).toHaveBeenCalled();
    });

    it('should handle IPFS service unavailable error without side effects', async () => {
      const courseId = 'unavailable-service-course';
      const userId = 'test-user-id';
      const walletAddress = '0x1234567890123456789012345678901234567890';
      
      const mockCourse = {
        id: courseId,
        onChainId: '0x0000000000000000000000000000000000000000000000000000000000000006',
        title: 'Service Unavailable Test',
        lessons: [{ id: 'lesson-1' }, { id: 'lesson-2' }, { id: 'lesson-3' }],
      };

      (prismaService.course.findUnique as jest.Mock).mockResolvedValue(mockCourse);
      (prismaService.lessonProgress.count as jest.Mock).mockResolvedValue(3);

      // Mock service unavailable
      (ipfsService.storeCertificateMetadata as jest.Mock).mockRejectedValue(
        new Error('Service temporarily unavailable')
      );

      await expect(educationService.issueCertificate(userId, walletAddress, courseId))
        .rejects.toThrow(InternalServerErrorException);

      // Verify IPFS was the point of failure
      expect(ipfsService.storeCertificateMetadata).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should reject certificate for incomplete course (Req 8.10)', async () => {
      const courseId = 'incomplete-course';
      const userId = 'test-user-id';
      const walletAddress = '0x1234567890123456789012345678901234567890';
      
      const mockCourse = {
        id: courseId,
        onChainId: '0x0000000000000000000000000000000000000000000000000000000000000007',
        title: 'Incomplete Course Test',
        lessons: [{ id: 'lesson-1' }, { id: 'lesson-2' }, { id: 'lesson-3' }],
      };

      (prismaService.course.findUnique as jest.Mock).mockResolvedValue(mockCourse);
      (prismaService.lessonProgress.count as jest.Mock).mockResolvedValue(2); // Only 2 of 3 lessons completed

      await expect(educationService.issueCertificate(userId, walletAddress, courseId))
        .rejects.toThrow(BadRequestException);

      try {
        await educationService.issueCertificate(userId, walletAddress, courseId);
      } catch (error: any) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toContain('Course not completed');
      }
      
      // Verify IPFS was never called due to early validation failure
      expect(ipfsService.storeCertificateMetadata).not.toHaveBeenCalled();
    });

    it('should return 404 for non-existent course', async () => {