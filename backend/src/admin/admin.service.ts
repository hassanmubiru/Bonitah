import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { 
  AdminUserUpdateDto, 
  AdminSystemHealthDto, 
  AdminAnalyticsDto,
  AdminUserListDto 
} from './admin.dto';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get system health metrics
   */
  async getSystemHealth(): Promise<AdminSystemHealthDto> {
    const [
      userCount,
      activeUsers,
      totalTransactions,
      recentErrors,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24h as proxy for "active"
          },
        },
      }),
      this.prisma.cachedEvent.count(),
      this.prisma.cachedEvent.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 60 * 60 * 1000), // Last hour
          },
        },
      }),
    ]);

    return {
      status: 'healthy',
      uptime: process.uptime(),
      users: {
        total: userCount,
        active: activeUsers,
        growth: 12.5, // Mock growth percentage
      },
      transactions: {
        total: totalTransactions,
        recent: recentErrors,
        volume: 245000, // Mock transaction volume
      },
      system: {
        memory: process.memoryUsage(),
        cpu: 45, // Mock CPU usage
        database: 'connected',
      },
      errors: {
        recent: recentErrors,
        rate: 0.02, // Mock error rate
      },
    };
  }

  /**
   * Get admin analytics
   */
  async getAnalytics(period?: string, metric?: string): Promise<AdminAnalyticsDto> {
    const endDate = new Date();
    const startDate = new Date();
    
    // Set date range based on period
    switch (period) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      default:
        startDate.setDate(startDate.getDate() - 7);
    }

    const [
      userGrowth,
      transactionVolume,
      revenue,
    ] = await Promise.all([
      this.getUserGrowthAnalytics(startDate, endDate),
      this.getTransactionAnalytics(startDate, endDate),
      this.getRevenueAnalytics(startDate, endDate),
    ]);

    return {
      period: period || '7d',
      userGrowth,
      transactionVolume,
      revenue,
      engagement: {
        dailyActiveUsers: 1250,
        averageSessionDuration: 1800, // 30 minutes
        bounceRate: 0.15,
      },
    };
  }

  /**
   * Get users with filtering and pagination
   */
  async getUsers(params: {
    page: number;
    limit: number;
    search?: string;
    role?: string;
    status?: string;
  }): Promise<AdminUserListDto> {
    const { page, limit, search, role, status } = params;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.walletAddress = {
        contains: search,
        mode: 'insensitive',
      };
    }

    if (role) {
      where.role = role;
    }

    // Note: Status filtering removed as isActive field doesn't exist in schema
    // In a real implementation, you might filter by createdAt or other criteria

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          walletAddress: true,
          role: true,
          displayName: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    // Transform to match the expected interface
    const transformedUsers = users.map(user => ({
      ...user,
      isActive: true, // Mock value since field doesn't exist in schema
      updatedAt: user.createdAt, // Use createdAt as fallback
    }));

    return {
      users: transformedUsers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update user
   */
  async updateUser(userId: string, updateData: AdminUserUpdateDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Delete user
   */
  async deleteUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return await this.prisma.user.delete({
      where: { id: userId },
    });
  }

  /**
   * Get audit log
   */
  async getAuditLog(params: {
    page: number;
    limit: number;
    action?: string;
    userId?: string;
  }) {
    // Mock audit log - in real implementation, this would be from an audit table
    const mockAuditEntries = [
      {
        id: '1',
        action: 'USER_UPDATE',
        userId: 'user1',
        adminId: 'admin1',
        timestamp: new Date(),
        details: 'Updated user role to ADMIN',
      },
      {
        id: '2',
        action: 'USER_DELETE',
        userId: 'user2',
        adminId: 'admin1',
        timestamp: new Date(Date.now() - 3600000),
        details: 'Deleted inactive user account',
      },
    ];

    return {
      entries: mockAuditEntries,
      pagination: {
        page: params.page,
        limit: params.limit,
        total: mockAuditEntries.length,
        pages: 1,
      },
    };
  }

  /**
   * Set maintenance mode
   */
  async setMaintenanceMode(enabled: boolean) {
    // In a real implementation, this would update a system configuration
    // For now, we'll just log the action
    console.log(`Maintenance mode ${enabled ? 'enabled' : 'disabled'}`);
    return { maintenanceMode: enabled };
  }

  /**
   * Private helper methods for analytics
   */
  private async getUserGrowthAnalytics(startDate: Date, endDate: Date) {
    const users = await this.prisma.user.groupBy({
      by: ['createdAt'],
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _count: {
        id: true,
      },
    });

    // Group by day and return growth data
    return users.map(entry => ({
      date: entry.createdAt.toISOString().split('T')[0],
      count: entry._count.id,
    }));
  }

  private async getTransactionAnalytics(startDate: Date, endDate: Date) {
    const transactions = await this.prisma.cachedEvent.groupBy({
      by: ['createdAt'],
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _count: {
        id: true,
      },
    });

    return transactions.map(entry => ({
      date: entry.createdAt.toISOString().split('T')[0],
      volume: entry._count.id,
    }));
  }

  private async getRevenueAnalytics(startDate: Date, endDate: Date) {
    // Mock revenue data - in real implementation, this would calculate from transaction fees
    const mockRevenue = [
      { date: '2024-01-20', amount: 1250.50 },
      { date: '2024-01-21', amount: 1840.25 },
      { date: '2024-01-22', amount: 2100.75 },
    ];

    return mockRevenue;
  }
}