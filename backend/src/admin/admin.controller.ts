import { Controller, Get, Param, HttpCode, HttpStatus, Request, Query } from '@nestjs/common';

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
    return this.adminService.getUsers(req.user, {
      search,
      role: role as 'USER' | 'VERIFIER' | 'ADMIN',
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
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
    return this.adminService.getTransactions(req.user, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      status,
    });
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
   * Get system status and health metrics (Req 14.9).
   */
  @Get('system')
  @HttpCode(HttpStatus.OK)
  getSystemStatus(@Request() req: AuthenticatedRequest): Promise<AdminSystemResponse> {
    return this.adminService.getSystemStatus(req.user);
  }
}