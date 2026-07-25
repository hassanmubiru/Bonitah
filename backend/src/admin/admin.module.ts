import { Module } from '@nestjs/common';

import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

/**
 * Admin module providing role-gated system management capabilities (Req 14.9).
 * 
 * All endpoints require ADMIN role and include comprehensive audit logging.
 * Unauthorized access is blocked by the global RolesGuard.
 */
@Module({
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}