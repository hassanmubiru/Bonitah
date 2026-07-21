import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Thin wrapper over the generated {@link PrismaClient}.
 *
 * Owns the database connection lifecycle so it is tied to the Nest application
 * lifecycle: the client connects on module init and disconnects cleanly on
 * shutdown. The database holds only off-chain data plus a provenanced cache of
 * blockchain events and read values (Req 1.3, 1.4, 12.2); it never stores
 * financial balances as a source of truth.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
