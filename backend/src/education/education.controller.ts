import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EducationService } from './education.service';

/**
 * Education controller for BFN courses, lessons, and certificates.
 *
 * Provides REST endpoints for course content access, lesson completion
 * tracking, and certificate issuance (Req 8.1, 8.2, 8.3, 8.4). All
 * endpoints require JWT authentication.
 */
@Controller('education')
@UseGuards(JwtAuthGuard)
export class EducationController {
  constructor(private readonly educationService: EducationService) {}

  /**
   * Get all available courses.
   *
   * GET /education/courses
   * Returns array of courses with basic lesson information.
   */
  @Get('courses')
  async getCourses() {
    return this.educationService.getCourses();
  }

  /**
   * Get course details by ID.
   *
   * GET /education/courses/:id
   * Returns course with full lesson details.
   */
  @Get('courses/:id')
  async getCourseById(@Param('id') courseId: string) {
    return this.educationService.getCourseById(courseId);
  }

  /**
   * Mark a lesson as completed.
   *
   * POST /education/lessons/:id/complete
   * Records lesson completion for the authenticated user.
   */
  @Post('lessons/:id/complete')
  async completeLesson(@Param('id') lessonId: string, @Request() req: any) {
    const userId = req.user.userId; // From JWT payload
    return this.educationService.completeLesson(userId, lessonId);
  }

  /**
   * Issue certificate for completed course.
   *
   * POST /education/courses/:id/certificate
   * Orchestrates certificate issuance: verify completion → IPFS storage →
   * on-chain issuance. Returns transaction hash and IPFS CID (Req 8.3, 8.4).
   */
  @Post('courses/:id/certificate')
  async issueCertificate(@Param('id') courseId: string, @Request() req: any) {
    const { userId, address } = req.user; // From JWT payload
    return this.educationService.issueCertificate(userId, address, courseId);
  }

  /**
   * Get user's course progress.
   *
   * GET /education/progress
   * GET /education/progress/:courseId
   * Returns lesson completion progress for the authenticated user.
   */
  @Get('progress')
  async getUserProgress(@Request() req: any) {
    const userId = req.user.userId;
    return this.educationService.getUserProgress(userId);
  }

  @Get('progress/:courseId')
  async getCourseProgress(@Param('courseId') courseId: string, @Request() req: any) {
    const userId = req.user.userId;
    return this.educationService.getUserProgress(userId, courseId);
  }

  /**
   * Get user's learning streak.
   *
   * GET /education/streak
   * Returns current consecutive-day learning streak.
   */
  @Get('streak')
  async getLearningStreak(@Request() req: any) {
    const userId = req.user.userId;
    return this.educationService.getLearningStreak(userId);
  }
}