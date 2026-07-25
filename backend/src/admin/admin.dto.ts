import { IsBoolean, IsOptional, IsString, IsIn } from 'class-validator';

/**
 * Admin DTOs for API request/response validation
 */

export class AdminUserUpdateDto {
  @IsOptional()
  @IsIn(['USER', 'ADMIN', 'VERIFIER'])
  role?: string;

  // Note: isActive field removed as it doesn't exist in the Prisma schema
}

export interface AdminSystemHealthDto {
  status: 'healthy' | 'warning' | 'critical';
  uptime: number;
  users: {
    total: number;
    active: number;
    growth: number;
  };
  transactions: {
    total: number;
    recent: number;
    volume: number;
  };
  system: {
    memory: NodeJS.MemoryUsage;
    cpu: number;
    database: string;
  };
  errors: {
    recent: number;
    rate: number;
  };
}

export interface AdminAnalyticsDto {
  period: string;
  userGrowth: Array<{
    date: string;
    count: number;
  }>;
  transactionVolume: Array<{
    date: string;
    volume: number;
  }>;
  revenue: Array<{
    date: string;
    amount: number;
  }>;
  engagement: {
    dailyActiveUsers: number;
    averageSessionDuration: number;
    bounceRate: number;
  };
}

export interface AdminUserListDto {
  users: Array<{
    id: string;
    walletAddress: string;
    role: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}