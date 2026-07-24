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
  let prismaService: PrismaService;

  // Mock data for consistent testing
  const mockUserId = 'test-user-id';
  const mockLessonId = 'test-lesson-id';
  const mockLesson = {
    id: mockLessonId,
    courseId: 'course1',
    course: { title: 'Test Course' },
  };

  const mockPrismaService = {
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

  const mockIpfsService = {
    storeCertificateMetadata: jest.fn(),
  };

  const mockConfigService = {
    getOrThrow: jest.fn(),
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        EducationService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: IpfsService, useValue: mockIpfsService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<EducationService>(EducationService);
    prismaService = module.get<PrismaService>(PrismaService);

    // Setup mock config values
    mockConfigService.getOrThrow.mockImplementation((key: string) => {
      const config: Record<string, string> = {
        'ISSUER_PRIVATE_KEY': '0x' + 'a'.repeat(64), // Valid 32-byte private key
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

    // Setup default mocks
    mockPrismaService.lesson.findUnique.mockResolvedValue(mockLesson);
    mockPrismaService.lessonProgress.findUnique.mockResolvedValue(null); // No existing progress
    mockPrismaService.lessonProgress.create.mockResolvedValue({
      id: 'progress-id',
      userId: mockUserId,
      lessonId: mockLessonId,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property: First lesson completion initializes streak to 1
   * Requirements: 8.2 (learning streak initialization)
   */
  it('initializes streak to 1 on first lesson completion', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
        async (today) => {
          // Mock no existing streak
          mockPrismaService.learningStreak.findUnique.mockResolvedValueOnce(null);
          
          // Mock streak creation
          const expectedStreakData = {
            userId: mockUserId,
            currentStreak: 1,
            lastActiveDay: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
          };
          mockPrismaService.learningStreak.create.mockResolvedValueOnce(expectedStreakData);

          // Mock current date
          const originalDateNow = Date.now;
          Date.now = () => today.getTime();

          try {
            await service.completeLesson(mockUserId, mockLessonId);

            // Verify streak was created with count 1
            expect(mockPrismaService.learningStreak.create).toHaveBeenCalledWith({
              data: {
                userId: mockUserId,
                currentStreak: 1,
                lastActiveDay: expect.any(Date),
              },
            });
          } finally {
            Date.now = originalDateNow;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Consecutive day completions increment streak
   * Requirements: 8.2 (consecutive day streak increment)
   */
  it('increments streak for consecutive daily lesson completions', () => {
    fc.assert(
      fc.property(
        fc.record({
          startDate: fc.date({ min: new Date('2020-01-01'), max: new Date('2029-12-01') }),
          initialStreak: fc.integer({ min: 1, max: 100 }),
        }),
        async ({ startDate, initialStreak }) => {
          const yesterday = new Date(startDate);
          yesterday.setDate(yesterday.getDate() - 1);
          yesterday.setHours(0, 0, 0, 0);

          const today = new Date(startDate);
          today.setHours(0, 0, 0, 0);

          // Mock existing streak from yesterday
          mockPrismaService.learningStreak.findUnique.mockResolvedValueOnce({
            id: 'streak-id',
            userId: mockUserId,
            currentStreak: initialStreak,
            lastActiveDay: yesterday,
          });

          // Mock streak update
          mockPrismaService.learningStreak.update.mockResolvedValueOnce({
            currentStreak: initialStreak + 1,
            lastActiveDay: today,
          });

          // Mock current date
          const originalDateNow = Date.now;
          Date.now = () => startDate.getTime();

          try {
            await service.completeLesson(mockUserId, mockLessonId);

            // Verify streak was incremented
            expect(mockPrismaService.learningStreak.update).toHaveBeenCalledWith({
              where: { userId: mockUserId },
              data: {
                currentStreak: initialStreak + 1,
                lastActiveDay: expect.any(Date),
              },
            });
          } finally {
            Date.now = originalDateNow;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Multiple lessons on same day don't change streak
   * Requirements: 8.2 (same day completion handling)
   */
  it('does not change streak for multiple lessons on the same day', () => {
    fc.assert(
      fc.property(
        fc.record({
          date: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
          currentStreak: fc.integer({ min: 1, max: 100 }),
        }),
        async ({ date, currentStreak }) => {
          const today = new Date(date);
          today.setHours(0, 0, 0, 0);

          // Mock existing streak for today (already completed a lesson today)
          mockPrismaService.learningStreak.findUnique.mockResolvedValueOnce({
            id: 'streak-id',
            userId: mockUserId,
            currentStreak,
            lastActiveDay: today,
          });

          // Mock current date
          const originalDateNow = Date.now;
          Date.now = () => date.getTime();

          try {
            await service.completeLesson(mockUserId, mockLessonId);

            // Verify no streak update was called (same day completion)
            expect(mockPrismaService.learningStreak.update).not.toHaveBeenCalled();
            expect(mockPrismaService.learningStreak.create).not.toHaveBeenCalled();
          } finally {
            Date.now = originalDateNow;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Gap in activity resets streak to 1
   * Requirements: 8.2 (streak reset on gap)
   */
  it('resets streak to 1 when there is a gap in activity', () => {
    fc.assert(
      fc.property(
        fc.record({
          lastActiveDate: fc.date({ min: new Date('2020-01-01'), max: new Date('2029-01-01') }),
          gapDays: fc.integer({ min: 2, max: 365 }), // Gap of 2 or more days
          currentStreak: fc.integer({ min: 2, max: 100 }),
        }),
        async ({ lastActiveDate, gapDays, currentStreak }) => {
          const today = new Date(lastActiveDate);
          today.setDate(today.getDate() + gapDays);
          today.setHours(0, 0, 0, 0);

          const lastActive = new Date(lastActiveDate);
          lastActive.setHours(0, 0, 0, 0);

          // Mock existing streak from several days ago
          mockPrismaService.learningStreak.findUnique.mockResolvedValueOnce({
            id: 'streak-id',
            userId: mockUserId,
            currentStreak,
            lastActiveDay: lastActive,
          });

          // Mock streak reset
          mockPrismaService.learningStreak.update.mockResolvedValueOnce({
            currentStreak: 1,
            lastActiveDay: today,
          });

          // Mock current date
          const originalDateNow = Date.now;
          Date.now = () => today.getTime();

          try {
            await service.completeLesson(mockUserId, mockLessonId);

            // Verify streak was reset to 1
            expect(mockPrismaService.learningStreak.update).toHaveBeenCalledWith({
              where: { userId: mockUserId },
              data: {
                currentStreak: 1,
                lastActiveDay: expect.any(Date),
              },
            });
          } finally {
            Date.now = originalDateNow;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Streak calculation is based on calendar days, not 24-hour periods
   * Requirements: 8.2 (calendar day basis)
   */
  it('calculates streak based on calendar days, not 24-hour periods', () => {
    fc.assert(
      fc.property(
        fc.record({
          baseDate: fc.date({ min: new Date('2020-01-01'), max: new Date('2029-12-30') }),
          hour1: fc.integer({ min: 0, max: 23 }),
          hour2: fc.integer({ min: 0, max: 23 }),
          initialStreak: fc.integer({ min: 1, max: 50 }),
        }),
        async ({ baseDate, hour1, hour2, initialStreak }) => {
          // Set up yesterday and today with different hours
          const yesterday = new Date(baseDate);
          yesterday.setHours(hour1, 30, 0, 0);
          
          const today = new Date(baseDate);
          today.setDate(today.getDate() + 1);
          today.setHours(hour2, 30, 0, 0);

          // Even if less than 24 hours apart, should still increment if different calendar days
          const timeDiff = today.getTime() - yesterday.getTime();
          
          // Skip test if same calendar day (edge case)
          if (yesterday.toDateString() === today.toDateString()) {
            return;
          }

          const yesterdayStart = new Date(yesterday);
          yesterdayStart.setHours(0, 0, 0, 0);

          const todayStart = new Date(today);
          todayStart.setHours(0, 0, 0, 0);

          // Mock existing streak from yesterday
          mockPrismaService.learningStreak.findUnique.mockResolvedValueOnce({
            id: 'streak-id',
            userId: mockUserId,
            currentStreak: initialStreak,
            lastActiveDay: yesterdayStart,
          });

          // Mock streak update
          mockPrismaService.learningStreak.update.mockResolvedValueOnce({
            currentStreak: initialStreak + 1,
            lastActiveDay: todayStart,
          });

          // Mock current date
          const originalDateNow = Date.now;
          Date.now = () => today.getTime();

          try {
            await service.completeLesson(mockUserId, mockLessonId);

            // Should increment streak regardless of hours if different calendar days
            if (timeDiff < 24 * 60 * 60 * 1000) {
              // Less than 24 hours but different calendar days - should still increment
              expect(mockPrismaService.learningStreak.update).toHaveBeenCalledWith({
                where: { userId: mockUserId },
                data: {
                  currentStreak: initialStreak + 1,
                  lastActiveDay: expect.any(Date),
                },
              });
            }
          } finally {
            Date.now = originalDateNow;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Streak persists correctly across date boundaries
   * Requirements: 8.2 (date boundary handling)
   */
  it('handles streak calculation correctly across date boundaries', () => {
    fc.assert(
      fc.property(
        fc.record({
          year: fc.integer({ min: 2020, max: 2030 }),
          month: fc.integer({ min: 0, max: 11 }), // 0-indexed months
          day: fc.integer({ min: 1, max: 28 }), // Safe day range for all months
          initialStreak: fc.integer({ min: 1, max: 365 }),
        }),
        async ({ year, month, day, initialStreak }) => {
          // Test end of month, end of year boundaries
          const yesterday = new Date(year, month, day);
          yesterday.setHours(0, 0, 0, 0);

          const today = new Date(yesterday);
          today.setDate(today.getDate() + 1);
          today.setHours(0, 0, 0, 0);

          // Mock existing streak from yesterday
          mockPrismaService.learningStreak.findUnique.mockResolvedValueOnce({
            id: 'streak-id',
            userId: mockUserId,
            currentStreak: initialStreak,
            lastActiveDay: yesterday,
          });

          // Mock streak update
          mockPrismaService.learningStreak.update.mockResolvedValueOnce({
            currentStreak: initialStreak + 1,
            lastActiveDay: today,
          });

          // Mock current date
          const originalDateNow = Date.now;
          Date.now = () => today.getTime();

          try {
            await service.completeLesson(mockUserId, mockLessonId);

            // Verify streak incremented correctly across date boundary
            expect(mockPrismaService.learningStreak.update).toHaveBeenCalledWith({
              where: { userId: mockUserId },
              data: {
                currentStreak: initialStreak + 1,
                lastActiveDay: expect.any(Date),
              },
            });
          } finally {
            Date.now = originalDateNow;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Streak retrieval returns correct current streak
   * Requirements: 8.2 (streak retrieval)
   */
  it('retrieves correct current streak and last active day', () => {
    fc.assert(
      fc.property(
        fc.record({
          currentStreak: fc.integer({ min: 0, max: 1000 }),
          lastActiveDay: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
        }),
        async ({ currentStreak, lastActiveDay }) => {
          // Mock existing streak
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
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Non-existent streak returns default values
   * Requirements: 8.2 (default streak values)
   */
  it('returns default values for users with no learning streak', () => {
    fc.assert(
      fc.property(
        fc.string().filter(s => s.length > 0), // Non-empty user ID
        async (userId) => {
          // Mock no existing streak
          mockPrismaService.learningStreak.findUnique.mockResolvedValueOnce(null);

          const result = await service.getLearningStreak(userId);

          expect(result).toEqual({
            currentStreak: 0,
            lastActiveDay: null,
          });
          expect(mockPrismaService.learningStreak.findUnique).toHaveBeenCalledWith({
            where: { userId },
          });
        }
      ),
      { numRuns: 50 }
    );
  });
});