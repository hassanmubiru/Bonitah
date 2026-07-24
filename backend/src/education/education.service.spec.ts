import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { EducationService } from './education.service';
import { PrismaService } from '../prisma/prisma.service';
import { IpfsService } from '../ipfs/ipfs.service';

describe('EducationService', () => {
  let service: EducationService;

  const mockPrismaService = {
    course: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    lesson: {
      findUnique: jest.fn(),
    },
    lessonProgress: {
      findUnique: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    learningStreak: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockIpfsService = {
    storeCertificateMetadata: jest.fn(),
  };

  const mockConfigService = {
    getOrThrow: jest.fn(),
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EducationService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: IpfsService, useValue: mockIpfsService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<EducationService>(EducationService);

    // Mock config values
    mockConfigService.getOrThrow.mockImplementation((key: string) => {
      const config: Record<string, string> = {
        'ISSUER_PRIVATE_KEY': '0x0123456789012345678901234567890123456789012345678901234567890123',
        'BASE_SEPOLIA_RPC_URL': 'https://sepolia.base.org',
      };
      return config[key];
    });

    mockConfigService.get.mockImplementation((key: string, defaultValue: string) => {
      if (key === 'EDUCATION_CONTRACT_ADDRESS') {
        return '0x0000000000000000000000000000000000000000'; // Placeholder
      }
      return defaultValue;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('completeLesson', () => {
    it('should complete a lesson successfully', async () => {
      const userId = 'user1';
      const lessonId = 'lesson1';
      const mockLesson = {
        id: lessonId,
        courseId: 'course1',
        course: { title: 'Test Course' },
      };

      mockPrismaService.lesson.findUnique.mockResolvedValue(mockLesson);
      mockPrismaService.lessonProgress.findUnique.mockResolvedValue(null);
      mockPrismaService.lessonProgress.create.mockResolvedValue({
        id: 'progress1',
        userId,
        lessonId,
      });
      mockPrismaService.learningStreak.findUnique.mockResolvedValue(null);
      mockPrismaService.learningStreak.create.mockResolvedValue({
        currentStreak: 1,
      });

      const result = await service.completeLesson(userId, lessonId);

      expect(result).toEqual({
        progress: expect.objectContaining({ userId, lessonId }),
        courseId: 'course1',
        courseTitle: 'Test Course',
      });
      expect(mockPrismaService.lessonProgress.create).toHaveBeenCalledWith({
        data: { userId, lessonId },
      });
    });

    it('should reject duplicate lesson completion', async () => {
      const userId = 'user1';
      const lessonId = 'lesson1';
      const mockLesson = {
        id: lessonId,
        courseId: 'course1',
        course: { title: 'Test Course' },
      };

      mockPrismaService.lesson.findUnique.mockResolvedValue(mockLesson);
      mockPrismaService.lessonProgress.findUnique.mockResolvedValue({
        id: 'existing',
        userId,
        lessonId,
      });

      await expect(service.completeLesson(userId, lessonId))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for non-existent lesson', async () => {
      mockPrismaService.lesson.findUnique.mockResolvedValue(null);

      await expect(service.completeLesson('user1', 'nonexistent'))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('hasCompletedCourse', () => {
    it('should return true when all lessons are completed', async () => {
      const userId = 'user1';
      const courseId = 'course1';
      const mockCourse = {
        id: courseId,
        lessons: [{ id: 'lesson1' }, { id: 'lesson2' }],
      };

      mockPrismaService.course.findUnique.mockResolvedValue(mockCourse);
      mockPrismaService.lessonProgress.count.mockResolvedValue(2);

      const result = await service.hasCompletedCourse(userId, courseId);
      expect(result).toBe(true);
    });

    it('should return false when not all lessons are completed', async () => {
      const userId = 'user1';
      const courseId = 'course1';
      const mockCourse = {
        id: courseId,
        lessons: [{ id: 'lesson1' }, { id: 'lesson2' }],
      };

      mockPrismaService.course.findUnique.mockResolvedValue(mockCourse);
      mockPrismaService.lessonProgress.count.mockResolvedValue(1);

      const result = await service.hasCompletedCourse(userId, courseId);
      expect(result).toBe(false);
    });
  });

  describe('issueCertificate', () => {
    it('should issue certificate when course is completed', async () => {
      const userId = 'user1';
      const walletAddress = '0x1234567890123456789012345678901234567890';
      const courseId = 'course1';
      const mockCourse = {
        id: courseId,
        onChainId: '0x0000000000000000000000000000000000000000000000000000000000000001',
        title: 'Test Course',
        lessons: [{ id: 'lesson1' }, { id: 'lesson2' }],
      };
      const mockCid = 'QmTestHash123';

      mockPrismaService.course.findUnique.mockResolvedValue(mockCourse);
      mockPrismaService.lessonProgress.count.mockResolvedValue(2);
      mockIpfsService.storeCertificateMetadata.mockResolvedValue(mockCid);

      const result = await service.issueCertificate(userId, walletAddress, courseId);

      expect(result).toEqual({
        transactionHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
        ipfsCid: mockCid,
        metadata: expect.objectContaining({
          recipient: walletAddress,
          courseTitle: 'Test Course',
        }),
      });
      expect(mockIpfsService.storeCertificateMetadata).toHaveBeenCalled();
    });

    it('should reject certificate issuance for incomplete course', async () => {
      const userId = 'user1';
      const walletAddress = '0x1234567890123456789012345678901234567890';
      const courseId = 'course1';
      const mockCourse = {
        id: courseId,
        onChainId: '0x0000000000000000000000000000000000000000000000000000000000000001',
        title: 'Test Course',
        lessons: [{ id: 'lesson1' }, { id: 'lesson2' }],
      };

      mockPrismaService.course.findUnique.mockResolvedValue(mockCourse);
      mockPrismaService.lessonProgress.count.mockResolvedValue(1);

      await expect(service.issueCertificate(userId, walletAddress, courseId))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for non-existent course', async () => {
      mockPrismaService.course.findUnique.mockResolvedValue(null);

      await expect(service.issueCertificate('user1', '0x123', 'nonexistent'))
        .rejects.toThrow(NotFoundException);
    });
  });
});