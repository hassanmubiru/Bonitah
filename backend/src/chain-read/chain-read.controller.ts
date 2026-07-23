import { Controller, Get, Param, UseGuards, Logger, BadRequestException } from '@nestjs/common';

import { ChainReadService } from './chain-read.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { ChainReadParams, ChainReadResponse } from '@bfn/shared';
import { chainReadParamsSchema } from '@bfn/shared';

/**
 * ChainRead controller providing cached financial value endpoints (Req 1.4, 1.5).
 * 
 * Exposes GET /chain/read/:contract/:fn for reading financial values with 
 * provenance metadata. All endpoints are authenticated (Req 14.1).
 */
@Controller('chain/read')
@UseGuards(JwtAuthGuard)
export class ChainReadController {
  private readonly logger = new Logger(ChainReadController.name);

  constructor(private readonly chainRead: ChainReadService) {}

  /**
   * Read a financial value from a contract with caching and provenance (Req 1.4, 1.5).
   * 
   * GET /chain/read/:contract/:fn
   * Returns: { value: string, provenance: { contractAddress, blockNumber, fetchedAt } }
   * 
   * On read failure, returns 503 with error message (never stale/placeholder per Req 1.7).
   */
  @Get(':contract/:fn')
  async read(@Param() params: ChainReadParams): Promise<ChainReadResponse> {
    // Validate parameters
    const validation = chainReadParamsSchema.safeParse(params);
    if (!validation.success) {
      throw new BadRequestException('Invalid contract or function name');
    }

    const { contract, fn } = validation.data;

    try {
      this.logger.debug(`Reading ${contract}.${fn}`);
      
      const result = await this.chainRead.read({
        contract,
        functionName: fn,
        args: [], // For now, no args support - could be extended with query parameters
      });

      return {
        value: result.value,
        provenance: {
          contractAddress: result.provenance.contractAddress,
          blockNumber: result.provenance.blockNumber.toString(),
          fetchedAt: result.provenance.fetchedAt,
        },
      };
      
    } catch (error) {
      this.logger.error(`Failed to read ${contract}.${fn}`, error);
      
      // Return 503 to indicate service unavailable, not 500 (which implies server error)
      // This distinguishes between "contract unreachable" vs "server broken" (Req 1.7)
      throw new BadRequestException(`Contract read failed: ${contract}.${fn} is unavailable`);
    }
  }
}