import {
  Controller,
  Post,
  UploadedFiles,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IpfsService } from './ipfs.service';

interface MulterFile {
  originalname: string;
  size: number;
  buffer: Buffer;
  mimetype: string;
}

/**
 * IPFS controller for profile document uploads.
 *
 * Provides REST endpoints for uploading profile documents to IPFS with
 * size/count limits and PII validation (Req 3.5, 3.8, 3.9). All endpoints
 * require JWT authentication.
 */
@Controller('ipfs')
@UseGuards(JwtAuthGuard)
export class IpfsController {
  constructor(private readonly ipfsService: IpfsService) {}

  /**
   * Upload profile documents to IPFS.
   *
   * POST /ipfs/profile-docs
   * Accepts up to 10 files, each max 10MB. Returns array of IPFS content hashes.
   *
   * @param files Uploaded files from multipart form
   * @returns Array of IPFS content hashes (CIDs)
   */
  @Post('profile-docs')
  @UseInterceptors(FilesInterceptor('files', 10, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB per file
      files: 10, // Max 10 files per request
    },
  }))
  async uploadProfileDocuments(@UploadedFiles() files: MulterFile[]) {
    const cids = await this.ipfsService.uploadProfileDocuments(files);
    return { cids };
  }
}