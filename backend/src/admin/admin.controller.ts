import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminService } from './admin.service';
import { 
  AdminUserUpdateDto, 
  AdminSystemHealthDto, 
  AdminAnalyticsDto,
  AdminUserListDto 
} from './admin.dto';

/**
 * Admin controller - Administrative operations with role-based access control
 * 
 * Implements Task 21.11 requirements:
 * - Admin-only operations gated by role with unauthorized access blocked
 * - Requirements: 14.9, 11.7
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /**
   * Get system health metrics
   */
  @Get('system/health')
  async getSystemHealth(): Promise<AdminSystemHealthDto> {
    try {
      return await this.adminService.getSystemHealth();
    } catch (error) {
      throw new HttpException(
        'Failed to retrieve system health',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get admin analytics
   */
  @Get('analytics')
  async getAdminAnalytics(
    @Query('period') period?: string,
    @Query('metric') metric?: string,
  ): Promise<AdminAnalyticsDto> {
    try {
      return await this.adminService.getAnalytics(period, metric);
    } catch (error) {
      throw new HttpException(
        'Failed to retrieve analytics',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get user list with filters
   */
  @Get('users')
  async getUsers(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
  ): Promise<AdminUserListDto> {
    try {
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      
      if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
        throw new HttpException('Invalid pagination parameters', HttpStatus.BAD_REQUEST);
      }

      return await this.adminService.getUsers({
        page: pageNum,
        limit: limitNum,
        search,
        role,
        status,
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to retrieve users',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Update user details (admin only)
   */
  @Put('users/:id')
  async updateUser(
    @Param('id') userId: string,
    @Body() updateData: AdminUserUpdateDto,
  ) {
    try {
      const user = await this.adminService.updateUser(userId, updateData);
      return { 
        message: 'User updated successfully', 
        user: {
          id: user.id,
          walletAddress: user.walletAddress,
          role: user.role,
          isActive: user.isActive,
          updatedAt: user.updatedAt,
        }
      };
    } catch (error) {
      if (error.message === 'User not found') {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }
      throw new HttpException(
        'Failed to update user',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Deactivate/suspend user account
   */
  @Put('users/:id/deactivate')
  async deactivateUser(@Param('id') userId: string) {
    try {
      await this.adminService.updateUser(userId, { isActive: false });
      return { message: 'User deactivated successfully' };
    } catch (error) {
      if (error.message === 'User not found') {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }
      throw new HttpException(
        'Failed to deactivate user',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Reactivate user account
   */
  @Put('users/:id/activate')
  async activateUser(@Param('id') userId: string) {
    try {
      await this.adminService.updateUser(userId, { isActive: true });
      return { message: 'User activated successfully' };
    } catch (error) {
      if (error.message === 'User not found') {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }
      throw new HttpException(
        'Failed to activate user',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Delete user (permanent)
   */
  @Delete('users/:id')
  async deleteUser(@Param('id') userId: string) {
    try {
      await this.adminService.deleteUser(userId);
      return { message: 'User deleted successfully' };
    } catch (error) {
      if (error.message === 'User not found') {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }
      throw new HttpException(
        'Failed to delete user',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get audit log
   */
  @Get('audit')
  async getAuditLog(
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('action') action?: string,
    @Query('userId') userId?: string,
  ) {
    try {
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      
      return await this.adminService.getAuditLog({
        page: pageNum,
        limit: limitNum,
        action,
        userId,
      });
    } catch (error) {
      throw new HttpException(
        'Failed to retrieve audit log',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * System maintenance mode toggle
   */
  @Put('system/maintenance')
  async toggleMaintenanceMode(@Body('enabled') enabled: boolean) {
    try {
      await this.adminService.setMaintenanceMode(enabled);
      return { 
        message: `Maintenance mode ${enabled ? 'enabled' : 'disabled'}`,
        maintenanceMode: enabled 
      };
    } catch (error) {
      throw new HttpException(
        'Failed to toggle maintenance mode',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}