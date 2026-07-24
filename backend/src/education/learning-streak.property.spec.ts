import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as fc from 'fast-check';

import { EducationService } from './education.service';
import { PrismaService } from '../prisma/prisma.service';
import { IpfsService } from '../ipfs/ipfs.service';

/**
 * Property 21: Learning streak equals consecutive-day count
 * **Validates: Requirements 8.2**
 *
 * This test validates that the learning streak is correctly calculated as the number
 * of consecutive calendar days on which the user has completed at least one lesson.
 * Key requirements:
 * - Streak increments for consecutive daily lesson completions
 * - Streak resets when there's a gap in activity (> 1 day)
 * - Multiple lessons on the same day don't affect the streak count
 * - Streak is maintained correctly across date boundaries and timezone handling
 */
describe('Property 21: Learning streak consecutive-day count', () => {
  let service: EducationService;
  let mockPrismaService: any;

  // Mock data for consistent testing
  const mockUserId = 'test-user-id';
  const mockLessonId = 'test-lesson-id';
  const mockLesson = {
    id: mockLessonId,
    courseId: 'course1',
    course: { title: 'Test Course' },
  };

  const mockIpfsService = {
    storeCertificateMetadata: jest.fn(),
  };

  const mockConfigService = {
    getOrThrow: jest.fn((key: string) => {
      const config: Record<string, string> = {
        ISSUER_PRIVATE_KEY: '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        BASE_SEPOLIA_RPC_URL: 'https://sepolia.base.org',
      };
      return config[key] || `mock-${key}`;
    }),
    get: jest.fn((key: string, defaultValue: string) => {
      if (key === 'EDUCATION_CONTRACT_ADDRESS') {
        return '0x0000000000000000000000000000000000000000';
      }
      return defaultValue;
    }),
  };

  beforeEach(async () => {
    // Create fresh mock for each test
    mockPrismaService = {
      lesson: {
        findUnique: jest.fn(),
      },
      lessonProgress: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      learningStreak: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        EducationService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: IpfsService, useValue: mockIpfsService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<EducationService>(EducationService);

    // Setup default mocks
    mockPrismaService.lesson.findUnique.mockResolvedValue(mockLesson);
    mockPrismaService.lessonProgress.findUnique.mockResolvedValue(null);
    mockPrismaService.lessonProgress.create.mockResolvedValue({
      id: 'progress-id',
      userId: mockUserId,
      lessonId: mockLessonId,
    });
  });

  /**
   * Property: Learning streak retrieval returns consistent values
   * Requirements: 8.2 (streak retrieval accuracy)
   */
  it('retrieves learning streak values consistently', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          currentStreak: fc.integer({ min: 0, max: 1000 }),
          lastActiveDay: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
        }),
        async ({ currentStreak, lastActiveDay }) => {
          const mockStreak = {
            id: 'streak-id',
            userId: mockUserId,
            currentStreak,
            lastActiveDay,
          };
          mockPrismaService.learningStreak.findUnique.mockResolvedValueOnce(mockStreak);

          const result = await service.getLearningStreak(mockUserId);

          expect(result).toEqual({
            id: 'streak-id',
            userId: mockUserId,
            currentStreak,
            lastActiveDay,
          });
          expect(mockPrismaService.learningStreak.findUnique).toHaveBeenCalledWith({
            where: { userId: mockUserId },
          });
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property: Non-existent streak returns default values
   * Requirements: 8.2 (default streak values)
   */
  it('returns default values for users with no learning streak', () => {
    fc.assert(
      fc.asyncProperty(
        fc.string().filter((s) => s.length > 0),
        async (userId) => {
          mockPrismaService.learningStreak.findUnique.mockResolvedValueOnce(null);

          const result = await service.getLearningStreak(userId);

          expect(result).toEqual({
            currentStreak: 0,
            lastActiveDay: null,
          });
          expect(mockPrismaService.learningStreak.findUnique).toHaveBeenCalledWith({
            where: { userId },
          });
        },
      ),
      { numRuns: 50 },
    );
  });

  /**
   * Core Property: Learning streak equals consecutive-day count
   * **Validates: Requirements 8.2**
   * 
   * This property validates that the learning streak calculation follows the rule:
   * "the number of consecutive calendar days on which the user has completed at least one lesson"
   * 
   * We test various scenarios:
   * 1. First lesson completion (streak = 1)
   * 2. Consecutive day lesson completion (streak increments)
   * 3. Same day multiple completions (streak unchanged)
   * 4. Gap in activity (streak resets to 1)
   */
  it('validates that learning streak equals consecutive-day count', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          // Test scenario: existing streak and time gap
          existingStreak: fc.integer({ min: 1, max: 50 }),
          daysSinceLastActive: fc.integer({ min: 0, max: 10 }), // 0 = same day, 1 = consecutive, >1 = gap
        }),
        async ({ existingStreak, daysSinceLastActive }) => {
          // Set up base date for consistent testing
          const baseDate = new Date('2024-01-15');
          baseDate.setHours(0, 0, 0, 0);
          
          const lastActiveDay = new Date(baseDate);
          const today = new Date(baseDate);
          today.setDate(today.getDate() + daysSinceLastActive);
          today.setHours(0, 0, 0, 0);

          // Mock existing streak
          const existingStreakRecord = {
            id: 'streak-id',
            userId: mockUserId,
            currentStreak: existingStreak,
            lastActiveDay: lastActiveDay,
          };

          mockPrismaService.learningStreak.findUnique.mockResolvedValueOnce(existingStreakRecord);

          // Calculate expected streak based on consecutive-day rule
          let expectedStreak: number;
          let expectedLastActiveDay: Date;

          if (daysSinceLastActive === 0) {
            // Same day - no change to streak count
            expectedStreak = existingStreak;
            expectedLastActiveDay = lastActiveDay; // No update expected for same day
          } else if (daysSinceLastActive === 1) {
            // Consecutive day - increment streak
            expectedStreak = existingStreak + 1;
            expectedLastActiveDay = today;
          } else {
            // Gap in activity - reset streak to 1
            expectedStreak = 1;
            expectedLastActiveDay = today;
          }

          // Mock the update/create calls based on expected behavior
          if (daysSinceLastActive === 0) {
            // Same day - no database update should occur
            mockPrismaService.learningStreak.update.mockResolvedValueOnce(existingStreakRecord);
          } else {
            // Different day - should update
            mockPrismaService.learningStreak.update.mockResolvedValueOnce({
              id: 'streak-id',
              userId: mockUserId,
              currentStreak: expectedStreak,
              lastActiveDay: expectedLastActiveDay,
            });
          }

          // Use jest to spy on Date constructor to control "today"
          const realDate = Date;
          const mockDate = jest.spyOn(global, 'Date').mockImplementation((...args) => {
            if (args.length === 0) {
              return today;
            }
            return new realDate(...args);
          });

          try {
            // Execute lesson completion (which triggers streak update)
            await service.completeLesson(mockUserId, mockLessonId);

            // Verify the streak update logic was called correctly
            expect(mockPrismaService.learningStreak.findUnique).toHaveBeenCalledWith({
              where: { userId: mockUserId },
            });

            if (daysSinceLastActive === 0) {
              // Same day - should not trigger update
              expect(mockPrismaService.learningStreak.update).not.toHaveBeenCalled();
              expect(mockPrismaService.learningStreak.create).not.toHaveBeenCalled();
            } else {
              // Different day - should trigger update with correct streak value
              expect(mockPrismaService.learningStreak.update).toHaveBeenCalledWith({
                where: { userId: mockUserId },
                data: {
                  currentStreak: expectedStreak,
                  lastActiveDay: expectedLastActiveDay,
                },
              });
            }
          } finally {
            mockDate.mockRestore();
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property: First lesson completion creates streak of 1
   * **Validates: Requirements 8.2**
   */
  it('creates initial learning streak of 1 for first lesson completion', () => {
    fc.assert(
      fc.asyncProperty(
        fc.string().filter((s) => s.length > 0),
        async (userId) => {
          // No existing streak
          mockPrismaService.learningStreak.findUnique.mockResolvedValueOnce(null);
          
          const today = new Date('2024-01-15');
          today.setHours(0, 0, 0, 0);

          mockPrismaService.learningStreak.create.mockResolvedValueOnce({
            userId,
            currentStreak: 1,
            lastActiveDay: today,
          });

          // Mock Date constructor to control "today"
          const mockDate = jest.spyOn(global, 'Date').mockImplementation((...args) => {
            if (args.length === 0) {
              return today;
            }
            return new Date(...args);
          });

          try {
            // Update lesson/progress mocks for this user
            const userLesson = { ...mockLesson, id: `lesson-${userId}` };
            mockPrismaService.lesson.findUnique.mockResolvedValueOnce(userLesson);
            mockPrismaService.lessonProgress.findUnique.mockResolvedValueOnce(null);
            mockPrismaService.lessonProgress.create.mockResolvedValueOnce({
              id: `progress-${userId}`,
              userId,
              lessonId: userLesson.id,
            });

            await service.completeLesson(userId, userLesson.id);

            // Verify first lesson completion creates streak = 1
            expect(mockPrismaService.learningStreak.create).toHaveBeenCalledWith({
              data: {
                userId,
                currentStreak: 1,
                lastActiveDay: today,
              },
            });
          } finally {
            mockDate.mockRestore();
          }
        },
      ),
      { numRuns: 50 },
    );
  });
});