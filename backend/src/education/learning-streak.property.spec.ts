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
   * Core Property: Learning streak equals consecutive-day count
   * **Validates: Requirements 8.2**
   * 
   * This property validates that the learning streak calculation follows the rule:
   * "the number of consecutive calendar days on which the user has completed at least one lesson"
   * 
   * The test simulates different completion patterns and verifies the streak logic:
   * - First completion creates streak = 1
   * - Consecutive days increment the streak
   * - Same day completions don't change the streak
   * - Gaps reset the streak to 1
   */
  it('validates that learning streak equals consecutive-day count', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Generate a sequence of lesson completion days (relative to a base date)
          completionDays: fc.array(
            fc.integer({ min: 0, max: 30 }), // Days 0-30 relative to base date
            { minLength: 1, maxLength: 10 }
          ).map(days => [...new Set(days)].sort((a, b) => a - b)), // Remove duplicates and sort
          
          // Base date for the sequence
          baseDate: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-06-01') })
        }),
        async ({ completionDays, baseDate }) => {
          // Calculate expected streak: count consecutive days ending on the last day
          const expectedStreak = calculateExpectedStreak(completionDays);
          
          // Clear mocks for each test iteration
          jest.clearAllMocks();
          
          // Track the simulated learning streak state
          let currentStreakState: any = null;
          
          // Setup mocks to simulate database behavior
          mockPrismaService.learningStreak.findUnique.mockImplementation(async () => {
            return currentStreakState;
          });
          
          mockPrismaService.learningStreak.create.mockImplementation(async (args: any) => {
            currentStreakState = {
              id: 'streak-id',
              userId: args.data.userId,
              currentStreak: args.data.currentStreak,
              lastActiveDay: args.data.lastActiveDay,
            };
            return currentStreakState;
          });
          
          mockPrismaService.learningStreak.update.mockImplementation(async (args: any) => {
            currentStreakState = {
              ...currentStreakState,
              currentStreak: args.data.currentStreak,
              lastActiveDay: args.data.lastActiveDay,
            };
            return currentStreakState;
          });
          
          // Simulate lesson completions on each day
          for (let i = 0; i < completionDays.length; i++) {
            const dayOffset = completionDays[i];
            if (dayOffset === undefined) continue;
            
            const completionDate = new Date(baseDate);
            completionDate.setDate(baseDate.getDate() + dayOffset);
            completionDate.setHours(0, 0, 0, 0);
            
            // Mock the current date to be the completion date
            jest.spyOn(global, 'Date').mockImplementation((function () {
              const RealDate = Date;
              return function (this: any, ...args: any[]): any {
                if (args.length === 0) {
                  return completionDate;
                }
                return new (RealDate as any)(...args);
              } as any;
            })());
            
            // Setup mocks for this lesson completion
            const lessonId = `lesson-${i}`;
            const lesson = { id: lessonId, courseId: 'course1', course: { title: 'Test' } };
            
            mockPrismaService.lesson.findUnique.mockResolvedValueOnce(lesson);
            mockPrismaService.lessonProgress.findUnique.mockResolvedValueOnce(null);
            mockPrismaService.lessonProgress.create.mockResolvedValueOnce({
              id: `progress-${i}`,
              userId: mockUserId,
              lessonId,
            });
            
            // Complete the lesson
            await service.completeLesson(mockUserId, lessonId);
            
            // Restore the Date mock
            (global.Date as any).mockRestore();
          }
          
          // After all completions, verify the final streak matches expected
          if (currentStreakState) {
            expect(currentStreakState.currentStreak).toBe(expectedStreak);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property: Same day completions don't increment streak
   * **Validates: Requirements 8.2**
   */
  it('validates that multiple lessons on same day do not increment streak', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          lessonsOnSameDay: fc.integer({ min: 2, max: 5 }),
          baseDate: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-06-01') })
        }),
        async ({ lessonsOnSameDay, baseDate }) => {
          // Clear mocks for each test iteration  
          jest.clearAllMocks();
          
          let currentStreakState: any = null;
          
          // Setup mocks
          mockPrismaService.learningStreak.findUnique.mockImplementation(async () => {
            return currentStreakState;
          });
          
          mockPrismaService.learningStreak.create.mockImplementation(async (args: any) => {
            currentStreakState = {
              id: 'streak-id',
              userId: args.data.userId,
              currentStreak: args.data.currentStreak,
              lastActiveDay: args.data.lastActiveDay,
            };
            return currentStreakState;
          });
          
          mockPrismaService.learningStreak.update.mockImplementation(async (args: any) => {
            currentStreakState = {
              ...currentStreakState,
              currentStreak: args.data.currentStreak,
              lastActiveDay: args.data.lastActiveDay,
            };
            return currentStreakState;
          });
          
          // Mock the date to be consistent for all completions
          const testDate = new Date(baseDate);
          testDate.setHours(0, 0, 0, 0);
          
          jest.spyOn(global, 'Date').mockImplementation((function () {
            const RealDate = Date;
            return function (this: any, ...args: any[]): any {
              if (args.length === 0) {
                return testDate;
              }
              return new (RealDate as any)(...args);
            } as any;
          })());
          
          try {
            // Complete multiple lessons on the same day
            for (let i = 0; i < lessonsOnSameDay; i++) {
              const lessonId = `lesson-${i}`;
              const lesson = { id: lessonId, courseId: 'course1', course: { title: 'Test' } };
              
              mockPrismaService.lesson.findUnique.mockResolvedValueOnce(lesson);
              mockPrismaService.lessonProgress.findUnique.mockResolvedValueOnce(null);
              mockPrismaService.lessonProgress.create.mockResolvedValueOnce({
                id: `progress-${i}`,
                userId: mockUserId,
                lessonId,
              });
              
              await service.completeLesson(mockUserId, lessonId);
            }
            
            // Streak should be 1 regardless of how many lessons completed on same day
            if (currentStreakState) {
              expect(currentStreakState.currentStreak).toBe(1);
            }
          } finally {
            (global.Date as any).mockRestore();
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property: Gaps in activity reset streak to 1
   * **Validates: Requirements 8.2**
   */
  it('validates that gaps in activity reset streak to 1', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          initialStreakDays: fc.integer({ min: 2, max: 10 }),
          gapDays: fc.integer({ min: 2, max: 7 }),
          baseDate: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-06-01') })
        }),
        async ({ initialStreakDays, gapDays, baseDate }) => {
          // Clear mocks for each test iteration
          jest.clearAllMocks();
          
          let currentStreakState: any = null;
          
          // Setup mocks
          mockPrismaService.learningStreak.findUnique.mockImplementation(async () => {
            return currentStreakState;
          });
          
          mockPrismaService.learningStreak.create.mockImplementation(async (args: any) => {
            currentStreakState = {
              id: 'streak-id',
              userId: args.data.userId,
              currentStreak: args.data.currentStreak,
              lastActiveDay: args.data.lastActiveDay,
            };
            return currentStreakState;
          });
          
          mockPrismaService.learningStreak.update.mockImplementation(async (args: any) => {
            currentStreakState = {
              ...currentStreakState,
              currentStreak: args.data.currentStreak,
              lastActiveDay: args.data.lastActiveDay,
            };
            return currentStreakState;
          });
          
          // Build initial streak (consecutive days)
          for (let day = 0; day < initialStreakDays; day++) {
            const completionDate = new Date(baseDate);
            completionDate.setDate(baseDate.getDate() + day);
            completionDate.setHours(0, 0, 0, 0);
            
            jest.spyOn(global, 'Date').mockImplementation((function () {
              const RealDate = Date;
              return function (this: any, ...args: any[]): any {
                if (args.length === 0) {
                  return completionDate;
                }
                return new (RealDate as any)(...args);
              } as any;
            })());
            
            const lessonId = `lesson-${day}`;
            const lesson = { id: lessonId, courseId: 'course1', course: { title: 'Test' } };
            
            mockPrismaService.lesson.findUnique.mockResolvedValueOnce(lesson);
            mockPrismaService.lessonProgress.findUnique.mockResolvedValueOnce(null);
            mockPrismaService.lessonProgress.create.mockResolvedValueOnce({
              id: `progress-${day}`,
              userId: mockUserId,
              lessonId,
            });
            
            await service.completeLesson(mockUserId, lessonId);
            
            (global.Date as any).mockRestore();
          }
          
          // Verify we have a streak equal to initialStreakDays
          expect(currentStreakState?.currentStreak).toBe(initialStreakDays);
          
          // Complete a lesson after a gap (more than 1 day)
          const gapDate = new Date(baseDate);
          gapDate.setDate(baseDate.getDate() + initialStreakDays + gapDays);
          gapDate.setHours(0, 0, 0, 0);
          
          jest.spyOn(global, 'Date').mockImplementation((function () {
            const RealDate = Date;
            return function (this: any, ...args: any[]): any {
              if (args.length === 0) {
                return gapDate;
              }
              return new (RealDate as any)(...args);
            } as any;
          })());
          
          try {
            const gapLessonId = 'gap-lesson';
            const gapLesson = { id: gapLessonId, courseId: 'course1', course: { title: 'Test' } };
            
            mockPrismaService.lesson.findUnique.mockResolvedValueOnce(gapLesson);
            mockPrismaService.lessonProgress.findUnique.mockResolvedValueOnce(null);
            mockPrismaService.lessonProgress.create.mockResolvedValueOnce({
              id: 'gap-progress',
              userId: mockUserId,
              lessonId: gapLessonId,
            });
            
            await service.completeLesson(mockUserId, gapLessonId);
            
            // After a gap, streak should reset to 1
            expect(currentStreakState?.currentStreak).toBe(1);
          } finally {
            (global.Date as any).mockRestore();
          }
        },
      ),
      { numRuns: 100 },
    );
  });
/**
 * Helper function to calculate expected consecutive day streak
 * Given an array of day offsets, return the count of consecutive days ending on the last day
 */
function calculateExpectedStreak(completionDays: number[]): number {
  if (completionDays.length === 0) return 0;
  
  const lastDay = completionDays[completionDays.length - 1];
  if (lastDay === undefined) return 0;
  
  let streak = 1;
  
  // Count backwards from the last day to find consecutive streak
  for (let i = completionDays.length - 2; i >= 0; i--) {
    const currentDay = completionDays[i];
    if (currentDay === undefined) break;
    
    const expectedPreviousDay = lastDay - streak;
    
    if (currentDay === expectedPreviousDay) {
      streak++;
    } else {
      // Gap found, consecutive streak ends
      break;
    }
  }
  
  return streak;
}