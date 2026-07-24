import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createWalletClient, http, Account, getContract } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

import { PrismaService } from '../prisma/prisma.service';
import { IpfsService } from '../ipfs/ipfs.service';
import { getContractAbi } from '@bfn/shared';

/**
 * Education service for BFN course content and certificate orchestration.
 *
 * Manages off-chain educational content (courses, lessons), tracks lesson
 * completion and learning streaks, and orchestrates certificate issuance:
 * verify completion → store metadata via IPFS → call Education.issueCertificate
 * (Req 8.1, 8.2, 8.3, 8.4, 8.6, 8.8, 8.9).
 */
@Injectable()
export class EducationService {
  private readonly logger = new Logger(EducationService.name);
  private readonly issuerAccount: Account;
  private readonly educationContractAddress: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ipfsService: IpfsService,
    private readonly configService: ConfigService,
  ) {
    // Initialize issuer account for certificate issuance (Req 8.3)
    const privateKey = this.configService.getOrThrow<string>('ISSUER_PRIVATE_KEY');
    this.issuerAccount = privateKeyToAccount(privateKey as `0x${string}`);

    // Get Education contract address (would be loaded from shared package after deployment)
    this.educationContractAddress = this.configService.get<string>(
      'EDUCATION_CONTRACT_ADDRESS',
      '0x0000000000000000000000000000000000000000', // Placeholder until deployed
    );

    this.logger.log(`Education service initialized with issuer: ${this.issuerAccount.address}`);
  }

  /**
   * Get all available courses.
   *
   * @returns Array of courses with basic information
   */
  async getCourses() {
    return this.prisma.course.findMany({
      select: {
        id: true,
        title: true,
        onChainId: true,
        lessons: {
          select: {
            id: true,
            title: true,
            order: true,
            contentType: true,
          },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { title: 'asc' },
    });
  }

  /**
   * Get course details by ID.
   *
   * @param courseId The course ID
   * @returns Course with lessons and progress information
   */
  async getCourseById(courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        lessons: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!course) {
      throw new NotFoundException(`Course not found: ${courseId}`);
    }

    return course;
  }

  /**
   * Mark a lesson as complete for a user.
   *
   * Records lesson completion, updates course progress, and maintains learning
   * streak (consecutive days with at least one lesson completed) (Req 8.2, 8.8).
   * Rejects duplicate completions (Req 8.8).
   *
   * @param userId User ID
   * @param lessonId Lesson ID to mark complete
   * @returns Updated progress information
   */
  async completeLesson(userId: string, lessonId: string) {
    // Check if lesson exists
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { course: true },
    });

    if (!lesson) {
      throw new NotFoundException(`Lesson not found: ${lessonId}`);
    }

    // Check for duplicate completion (Req 8.8)
    const existingProgress = await this.prisma.lessonProgress.findUnique({
      where: {
        userId_lessonId: {
          userId,
          lessonId,
        },
      },
    });

    if (existingProgress) {
      throw new BadRequestException(`Lesson already completed: ${lessonId}`);
    }

    // Record lesson completion
    const progress = await this.prisma.lessonProgress.create({
      data: {
        userId,
        lessonId,
      },
    });

    // Update learning streak (Req 8.2)
    await this.updateLearningStreak(userId);

    this.logger.log(
      `Lesson completed: user=${userId}, lesson=${lessonId}, course=${lesson.course.title}`,
    );

    return {
      progress,
      courseId: lesson.courseId,
      courseTitle: lesson.course.title,
    };
  }

  /**
   * Check if user has completed all lessons in a course.
   *
   * @param userId User ID
   * @param courseId Course ID
   * @returns True if all lessons are completed
   */
  async hasCompletedCourse(userId: string, courseId: string): Promise<boolean> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        lessons: true,
      },
    });

    if (!course) {
      throw new NotFoundException(`Course not found: ${courseId}`);
    }

    const completedCount = await this.prisma.lessonProgress.count({
      where: {
        userId,
        lesson: {
          courseId,
        },
      },
    });

    return completedCount === course.lessons.length;
  }

  /**
   * Issue certificate for course completion.
   *
   * Orchestrates the certificate issuance flow (Req 8.3, 8.4, 8.9):
   * 1. Verify user has completed all lessons in the course
   * 2. Store certificate metadata on IPFS
   * 3. Call Education.issueCertificate with the IPFS hash
   * 4. On IPFS failure, leave prior state unchanged (Req 8.9)
   *
   * @param userId User ID (from JWT)
   * @param walletAddress User's wallet address (from JWT)
   * @param courseId Course ID
   * @returns Certificate details with transaction hash and IPFS CID
   */
  async issueCertificate(userId: string, walletAddress: string, courseId: string) {
    // 1. Verify course completion
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new NotFoundException(`Course not found: ${courseId}`);
    }

    const isCompleted = await this.hasCompletedCourse(userId, courseId);
    if (!isCompleted) {
      throw new BadRequestException(`Course not completed: ${courseId}`);
    }

    // 2. Prepare certificate metadata
    const metadata = {
      recipient: walletAddress,
      courseId: course.onChainId,
      courseTitle: course.title,
      issuedAt: new Date().toISOString(),
      issuer: 'Bonitah Financial Network',
      version: '1.0',
    };

    let cid: string;
    try {
      // 3. Store metadata on IPFS (Req 8.4)
      cid = await this.ipfsService.storeCertificateMetadata(metadata);
    } catch (error) {
      // On IPFS failure, leave prior state unchanged (Req 8.9)
      this.logger.error(
        `IPFS storage failed for certificate: user=${userId}, course=${courseId}`,
        error,
      );
      throw new InternalServerErrorException('Certificate metadata storage failed');
    }

    try {
      // 4. Call Education.issueCertificate on-chain (Req 8.3)
      const walletClient = createWalletClient({
        account: this.issuerAccount,
        chain: baseSepolia,
        transport: http(this.configService.getOrThrow<string>('BASE_SEPOLIA_RPC_URL')),
      });

      // For now, skip the actual on-chain call if contract address is not set
      if (this.educationContractAddress === '0x0000000000000000000000000000000000000000') {
        this.logger.warn(
          `Education contract not deployed, skipping on-chain issuance for user=${userId}, course=${courseId}`,
        );
        return {
          transactionHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
          ipfsCid: cid,
          metadata,
        };
      }

      const educationContract = getContract({
        address: this.educationContractAddress as `0x${string}`,
        abi: getContractAbi('Education'),
        client: walletClient,
      });

      if (!educationContract.write) {
        throw new InternalServerErrorException('Contract write methods not available');
      }

      interface ContractWrite {
        issueCertificate: (args: [string, string, string]) => Promise<string>;
      }

      const txHash = await (educationContract.write as ContractWrite).issueCertificate([
        walletAddress as `0x${string}`,
        course.onChainId as `0x${string}`,
        cid,
      ]);

      this.logger.log(
        `Certificate issued: user=${userId}, course=${courseId}, tx=${txHash}, cid=${cid}`,
      );

      return {
        transactionHash: txHash,
        ipfsCid: cid,
        metadata,
      };
    } catch (error) {
      // If on-chain call fails, the IPFS metadata is already stored but that's acceptable
      // The user can retry certificate issuance with the same metadata
      this.logger.error(
        `On-chain certificate issuance failed: user=${userId}, course=${courseId}`,
        error,
      );
      throw new InternalServerErrorException('Certificate issuance failed');
    }
  }

  /**
   * Get user's course progress.
   *
   * @param userId User ID
   * @param courseId Course ID (optional, if provided returns progress for that course)
   * @returns Progress information
   */
  async getUserProgress(userId: string, courseId?: string) {
    const whereClause = courseId ? { userId, lesson: { courseId } } : { userId };

    const progress = await this.prisma.lessonProgress.findMany({
      where: whereClause,
      include: {
        lesson: {
          include: {
            course: true,
          },
        },
      },
      orderBy: {
        completedAt: 'desc',
      },
    });

    return progress;
  }

  /**
   * Get user's learning streak.
   *
   * @param userId User ID
   * @returns Current learning streak information
   */
  async getLearningStreak(userId: string) {
    const streak = await this.prisma.learningStreak.findUnique({
      where: { userId },
    });

    return streak || { currentStreak: 0, lastActiveDay: null };
  }

  /**
   * Update user's learning streak (Req 8.2).
   *
   * Maintains consecutive calendar days with at least one lesson completion.
   * Resets streak if there's a gap in activity.
   */
  private async updateLearningStreak(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of day

    const streak = await this.prisma.learningStreak.findUnique({
      where: { userId },
    });

    if (!streak) {
      // First lesson completion
      await this.prisma.learningStreak.create({
        data: {
          userId,
          currentStreak: 1,
          lastActiveDay: today,
        },
      });
      return;
    }

    const lastActiveDay = new Date(streak.lastActiveDay);
    lastActiveDay.setHours(0, 0, 0, 0);

    const diffTime = today.getTime() - lastActiveDay.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let newStreak: number;
    if (diffDays === 0) {
      // Already completed a lesson today, no change to streak
      return;
    } else if (diffDays === 1) {
      // Consecutive day, increment streak
      newStreak = streak.currentStreak + 1;
    } else {
      // Gap in activity, reset streak
      newStreak = 1;
    }

    await this.prisma.learningStreak.update({
      where: { userId },
      data: {
        currentStreak: newStreak,
        lastActiveDay: today,
      },
    });
  }
}
