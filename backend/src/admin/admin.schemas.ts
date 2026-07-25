import { z } from 'zod';

/**
 * Admin API request/response schemas (Req 14.9).
 * 
 * These schemas define the shape of data returned by admin endpoints
 * for comprehensive system management and oversight.
 */

/** User summary for admin user management. */
export const adminUserSummarySchema = z.object({
  id: z.string().cuid(),
  walletAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  role: z.enum(['USER', 'VERIFIER', 'ADMIN']),
  verified: z.boolean(),
  reputation: z.number().int().nonnegative(),
  createdAt: z.date(),
  lastActiveAt: z.date().nullable(),
});

export type AdminUserSummary = z.infer<typeof adminUserSummarySchema>;

/** Transaction summary for admin oversight. */
export const adminTransactionSummarySchema = z.object({
  id: z.string(),
  type: z.enum(['DEPOSIT', 'WITHDRAWAL', 'GOAL_CONTRIBUTION', 'CIRCLE_CONTRIBUTION', 'POOL_CONTRIBUTION']),
  amount: z.string(), // BigNumber as string
  status: z.enum(['PENDING', 'CONFIRMED', 'FAILED']),
  userAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  txHash: z.string().optional(),
  createdAt: z.date(),
  confirmedAt: z.date().nullable(),
});

export type AdminTransactionSummary = z.infer<typeof adminTransactionSummarySchema>;

/** Community data summary for admin oversight. */
export const adminCommunitySummarySchema = z.object({
  totalCircles: z.number().int().nonnegative(),
  activeCircles: z.number().int().nonnegative(),
  totalPools: z.number().int().nonnegative(),
  activePools: z.number().int().nonnegative(),
  totalCommunityValue: z.string(), // BigNumber as string
  recentActivity: z.array(z.object({
    type: z.enum(['CIRCLE_CREATED', 'POOL_CREATED', 'CONTRIBUTION_MADE', 'VOTE_CAST']),
    description: z.string(),
    timestamp: z.date(),
    userAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  })),
});

export type AdminCommunitySummary = z.infer<typeof adminCommunitySummarySchema>;

/** System health and metrics for admin monitoring. */
export const adminSystemStatusSchema = z.object({
  uptime: z.number().positive(), // seconds
  version: z.string(),
  environment: z.enum(['development', 'production', 'test']),
  database: z.object({
    status: z.enum(['healthy', 'warning', 'error']),
    connections: z.number().int().nonnegative(),
    responseTime: z.number().positive(), // milliseconds
  }),
  blockchain: z.object({
    status: z.enum(['healthy', 'warning', 'error']),
    latestBlock: z.number().int().positive(),
    syncStatus: z.enum(['synced', 'syncing', 'behind']),
  }),
  redis: z.object({
    status: z.enum(['healthy', 'warning', 'error']),
    memory: z.number().nonnegative(),
    connections: z.number().int().nonnegative(),
  }),
  metrics: z.object({
    totalUsers: z.number().int().nonnegative(),
    activeUsers24h: z.number().int().nonnegative(),
    totalTransactions: z.number().int().nonnegative(),
    transactions24h: z.number().int().nonnegative(),
    totalValue: z.string(), // BigNumber as string
  }),
});

export type AdminSystemStatus = z.infer<typeof adminSystemStatusSchema>;

/** Response from GET /admin/dashboard. */
export const adminDashboardResponseSchema = z.object({
  systemHealth: z.object({
    overall: z.enum(['healthy', 'warning', 'critical']),
    services: z.record(z.enum(['healthy', 'warning', 'error'])),
  }),
  metrics: z.object({
    totalUsers: z.number().int().nonnegative(),
    activeUsers24h: z.number().int().nonnegative(),
    newUsers24h: z.number().int().nonnegative(),
    totalTransactions: z.number().int().nonnegative(),
    transactions24h: z.number().int().nonnegative(),
    totalValue: z.string(), // BigNumber as string
    value24h: z.string(), // BigNumber as string
  }),
  alerts: z.array(z.object({
    id: z.string(),
    type: z.enum(['INFO', 'WARNING', 'ERROR', 'CRITICAL']),
    message: z.string(),
    timestamp: z.date(),
    resolved: z.boolean(),
  })),
  recentActivity: z.array(z.object({
    type: z.string(),
    description: z.string(),
    timestamp: z.date(),
    userAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  })),
});

export type AdminDashboardResponse = z.infer<typeof adminDashboardResponseSchema>;

/** Response from GET /admin/users. */
export const adminUsersResponseSchema = z.object({
  users: z.array(adminUserSummarySchema),
  pagination: z.object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    pages: z.number().int().nonnegative(),
  }),
  filters: z.object({
    search: z.string().optional(),
    role: z.enum(['USER', 'VERIFIER', 'ADMIN']).optional(),
  }),
});

export type AdminUsersResponse = z.infer<typeof adminUsersResponseSchema>;

/** Response from GET /admin/users/:userId. */
export const adminUserDetailsResponseSchema = z.object({
  user: adminUserSummarySchema.extend({
    email: z.string().email().optional(),
    profileData: z.record(z.any()).optional(),
    transactionHistory: z.array(adminTransactionSummarySchema),
    communityActivity: z.array(z.object({
      type: z.enum(['CIRCLE_JOINED', 'POOL_CONTRIBUTION', 'VOTE_CAST', 'GOAL_CREATED']),
      description: z.string(),
      timestamp: z.date(),
      amount: z.string().optional(), // BigNumber as string
    })),
  }),
});

export type AdminUserDetailsResponse = z.infer<typeof adminUserDetailsResponseSchema>;

/** Response from GET /admin/transactions. */
export const adminTransactionsResponseSchema = z.object({
  transactions: z.array(adminTransactionSummarySchema),
  pagination: z.object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    pages: z.number().int().nonnegative(),
  }),
  summary: z.object({
    totalValue: z.string(), // BigNumber as string
    pendingCount: z.number().int().nonnegative(),
    confirmedCount: z.number().int().nonnegative(),
    failedCount: z.number().int().nonnegative(),
  }),
});

export type AdminTransactionsResponse = z.infer<typeof adminTransactionsResponseSchema>;

/** Response from GET /admin/community. */
export const adminCommunityResponseSchema = adminCommunitySummarySchema;

export type AdminCommunityResponse = z.infer<typeof adminCommunityResponseSchema>;

/** Response from GET /admin/system. */
export const adminSystemResponseSchema = adminSystemStatusSchema;

export type AdminSystemResponse = z.infer<typeof adminSystemResponseSchema>;

/** Request for updating user role. */
export const updateUserRoleRequestSchema = z.object({
  role: z.enum(['USER', 'VERIFIER', 'ADMIN']),
});

export type UpdateUserRoleRequest = z.infer<typeof updateUserRoleRequestSchema>;

/** Request for admin actions. */
export const adminActionRequestSchema = z.object({
  targetUserId: z.string().cuid().optional(),
  parameters: z.record(z.any()).optional(),
});

export type AdminActionRequest = z.infer<typeof adminActionRequestSchema>;