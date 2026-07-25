import { Controller, Get, Put, Post, Delete, Param, HttpCode, HttpStatus, Request, Query, Body } from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { AdminService } from './admin.service';
import {
  type AdminDashboardResponse,
  type AdminUsersResponse,
  type AdminUserDetailsResponse,
  type AdminTransactionsResponse,
  type AdminCommunityResponse,
  type AdminSystemResponse,
  updateUserRoleRequestSchema,
  type UpdateUserRoleRequest,
  adminActionRequestSchema,
  type AdminActionRequest,
} from './admin.schemas';

/**
 * Admin-only endpoints for system management and oversight (Req 14.9, 11.7).
 * 
 * All endpoints in this controller require ADMIN role, enforced by the
 * global RolesGuard. Unauthorized access is blocked with 403 Forbidden.
 */
@Controller('admin')
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /**
   * Get admin dashboard data with system metrics and alerts (Req 14.9).
   */
  @Get('dashboard')
  @HttpCode(HttpStatus.OK)
  getDashboard(@Request() req: AuthenticatedRequest): Promise<AdminDashboardResponse> {
    return this.adminService.getDashboard(req.user);
  }

  /**
   * Get user management data with search and filtering (Req 14.9).
   */
  @Get('users')
  @HttpCode(HttpStatus.OK)
  getUsers(
    @Request() req: AuthenticatedRequest,
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<AdminUsersResponse> {
    const filters = {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    };

    if (search) {
      (filters as any).search = search;
    }

    if (role && ['USER', 'VERIFIER', 'ADMIN'].includes(role)) {
      (filters as any).role = role as 'USER' | 'VERIFIER' | 'ADMIN';
    }

    return this.adminService.getUsers(req.user, filters);
  }

  /**
   * Get detailed user information by user ID (Req 14.9).
   */
  @Get('users/:userId')
  @HttpCode(HttpStatus.OK)
  getUserDetails(
    @Request() req: AuthenticatedRequest,
    @Param('userId') userId: string,
  ): Promise<AdminUserDetailsResponse> {
    return this.adminService.getUserDetails(req.user, userId);
  }

  /**
   * Get transaction oversight data for monitoring (Req 14.9).
   */
  @Get('transactions')
  @HttpCode(HttpStatus.OK)
  getTransactions(
    @Request() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ): Promise<AdminTransactionsResponse> {
    const filters = {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    };

    if (status) {
      (filters as any).status = status;
    }

    return this.adminService.getTransactions(req.user, filters);
  }

  /**
   * Get community management data for circles and pools (Req 14.9).
   */
  @Get('community')
  @HttpCode(HttpStatus.OK)
  getCommunity(@Request() req: AuthenticatedRequest): Promise<AdminCommunityResponse> {
    return this.adminService.getCommunity(req.user);
  }

  /**
   * Update user role - administrative action (Req 14.9).
   */
  @Put('users/:userId/role')
  @HttpCode(HttpStatus.OK)
  updateUserRole(
    @Request() req: AuthenticatedRequest,
    @Param('userId') userId: string,
    @Body() body: UpdateUserRoleRequest,
  ): Promise<{ success: boolean; message: string }> {
    const validatedBody = updateUserRoleRequestSchema.parse(body);
    return this.adminService.updateUserRole(req.user, userId, validatedBody.role);
  }

  /**
   * Verify or unverify user account (Req 14.9).
   */
  @Put('users/:userId/verification')
  @HttpCode(HttpStatus.OK)
  updateUserVerification(
    @Request() req: AuthenticatedRequest,
    @Param('userId') userId: string,
    @Body() body: { verified: boolean },
  ): Promise<{ success: boolean; message: string }> {
    return this.adminService.updateUserVerification(req.user, userId, body.verified);
  }

  /**
   * Execute administrative action (Req 14.9).
   */
  @Post('actions/:action')
  @HttpCode(HttpStatus.OK)
  executeAction(
    @Request() req: AuthenticatedRequest,
    @Param('action') action: string,
    @Body() body: AdminActionRequest,
  ): Promise<{ success: boolean; message: string; data?: any }> {
    const validatedBody = adminActionRequestSchema.parse(body);
    return this.adminService.executeAction(req.user, action, validatedBody);
  }

  /**
   * Get audit logs for admin operations (Req 14.9).
   */
  @Get('audit')
  @HttpCode(HttpStatus.OK)
  getAuditLogs(
    @Request() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('action') action?: string,
    @Query('userId') userId?: string,
  ): Promise<{
    logs: Array<{
      id: string;
      action: string;
      adminAddress: string;
      targetUserId?: string;
      details: any;
      timestamp: Date;
    }>;
    pagination: { page: number; limit: number; total: number; pages: number };
  }> {
    const filters = {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    };

    if (action) (filters as any).action = action;
    if (userId) (filters as any).userId = userId;

    return this.adminService.getAuditLogs(req.user, filters);
  }
}