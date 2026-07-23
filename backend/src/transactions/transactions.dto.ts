import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, Min, Max } from 'class-validator';

/**
 * Pagination query parameters for transaction history.
 */
export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100) // Maximum 100 events per page (Req 12.3)
  limit?: number = 50;
}

/**
 * Transaction event from cached blockchain data.
 */
export interface TransactionEventDto {
  id: string;
  contractAddress: string;
  eventName: string;
  transactionHash: string;
  blockNumber: bigint;
  blockHash: string;
  logIndex: number;
  payload: any; // JSON payload of event arguments
  createdAt: Date;
}

/**
 * Pagination metadata for response.
 */
export interface PaginationMetadata {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Transaction history response with pagination.
 */
export interface TransactionHistoryResponseDto {
  events: TransactionEventDto[];
  pagination: PaginationMetadata;
}