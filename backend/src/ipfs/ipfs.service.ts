import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface MulterFile {
  originalname: string;
  size: number;
  buffer: Buffer;
  mimetype: string;
}

/**
 * IPFS service for BFN profile documents and certificate metadata storage.
 *
 * Handles document upload, PII validation/exclusion, and content pinning
 * via Pinata service (Req 3.5, 3.8, 3.9, 8.4). Returns CID on success or
 * error on failure (never returns a CID when storage fails, Req 3.9, 8.9).
 */
@Injectable()
export class IpfsService {
  private readonly logger = new Logger(IpfsService.name);
  private readonly pinataJwt: string;

  constructor(private readonly configService: ConfigService) {
    this.pinataJwt = this.configService.getOrThrow<string>('PINATA_JWT');
  }

  /**
   * Upload and pin certificate metadata to IPFS.
   *
   * Accepts certificate metadata as JSON object, validates for PII exclusion,
   * uploads to IPFS via Pinata, and returns the content hash (CID) on success.
   * On storage failure, throws InternalServerErrorException and returns no CID (Req 8.9).
   *
   * @param metadata The certificate metadata object to store
   * @returns Promise resolving to the IPFS content hash (CID)
   * @throws BadRequestException if metadata contains PII
   * @throws InternalServerErrorException if IPFS storage fails
   */
  async storeCertificateMetadata(metadata: Record<string, unknown>): Promise<string> {
    // Validate metadata for PII exclusion (Req 3.8)
    this.validateNoPII(metadata);

    try {
      const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.pinataJwt}`,
        },
        body: JSON.stringify({
          pinataContent: metadata,
          pinataMetadata: {
            name: `BFN Certificate Metadata - ${Date.now()}`,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Pinata API error: ${response.status} ${errorText}`);
        throw new InternalServerErrorException('IPFS storage failed');
      }

      const result = (await response.json()) as { IpfsHash?: string };
      const cid = result.IpfsHash;

      if (!cid) {
        this.logger.error('No IPFS hash returned from Pinata');
        throw new InternalServerErrorException('IPFS storage failed - no hash returned');
      }

      this.logger.log(`Certificate metadata stored to IPFS: ${cid}`);
      return cid;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof InternalServerErrorException) {
        throw error;
      }

      this.logger.error('IPFS storage error:', error);
      throw new InternalServerErrorException('IPFS storage failed');
    }
  }

  /**
   * Upload multiple profile documents to IPFS with size and count limits.
   *
   * Accepts up to 10 documents per request, each no larger than 10MB (Req 3.5).
   * Validates for PII exclusion before storage (Req 3.8). Returns array of CIDs
   * on success or throws on validation/storage failure (Req 3.9).
   *
   * @param files Array of files to upload (max 10, max 10MB each)
   * @returns Promise resolving to array of IPFS content hashes (CIDs)
   * @throws BadRequestException if limits exceeded or PII detected
   * @throws InternalServerErrorException if IPFS storage fails
   */
  async uploadProfileDocuments(files: MulterFile[]): Promise<string[]> {
    // Validate count limit (Req 3.5)
    if (files.length > 10) {
      throw new BadRequestException('Maximum 10 documents per request');
    }

    const cids: string[] = [];

    for (const file of files) {
      // Validate size limit (Req 3.5)
      if (file.size > 10 * 1024 * 1024) {
        throw new BadRequestException(`File ${file.originalname} exceeds 10MB limit`);
      }

      // Validate for PII exclusion (Req 3.8)
      this.validateFilePII(file);

      try {
        const formData = new FormData();
        const blob = new Blob([new Uint8Array(file.buffer)], { type: file.mimetype });
        formData.append('file', blob, file.originalname);
        formData.append(
          'pinataMetadata',
          JSON.stringify({
            name: `BFN Profile Document - ${file.originalname}`,
          }),
        );

        const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.pinataJwt}`,
          },
          body: formData,
        });

        if (!response.ok) {
          const errorText = await response.text();
          this.logger.error(`Pinata file upload error: ${response.status} ${errorText}`);
          throw new InternalServerErrorException('IPFS storage failed');
        }

        const result = (await response.json()) as { IpfsHash?: string };
        const cid = result.IpfsHash;

        if (!cid) {
          this.logger.error(`No IPFS hash returned for file ${file.originalname}`);
          throw new InternalServerErrorException('IPFS storage failed - no hash returned');
        }

        cids.push(cid);
        this.logger.log(`Profile document stored to IPFS: ${file.originalname} -> ${cid}`);
      } catch (error) {
        if (error instanceof BadRequestException || error instanceof InternalServerErrorException) {
          throw error;
        }

        this.logger.error(`IPFS storage error for file ${file.originalname}:`, error);
        throw new InternalServerErrorException('IPFS storage failed');
      }
    }

    return cids;
  }

  /**
   * Validates metadata object for PII exclusion (Req 3.8).
   *
   * Checks for government IDs, addresses, phone numbers, email addresses,
   * and financial account credentials. Throws BadRequestException if found.
   */
  private validateNoPII(metadata: Record<string, unknown>): void {
    const piiPatterns = [
      // Government ID numbers (SSN, passport, driver's license patterns)
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN format
      /\b\d{9}\b/, // 9-digit numbers (could be SSN without dashes)

      // Email addresses
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,

      // Phone numbers (various formats)
      /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/,
      /\b\(\d{3}\)\s?\d{3}[-.]?\d{4}\b/,

      // Financial account patterns (credit card, bank account)
      /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/, // Credit card format
    ];

    const piiKeywords = [
      'ssn',
      'social',
      'passport',
      'license',
      'address',
      'street',
      'city',
      'zip',
      'postal',
      'phone',
      'email',
      'account',
      'routing',
      'credit',
      'debit',
      'card',
      'password',
    ];

    const checkValue = (value: unknown, path: string = ''): void => {
      if (typeof value === 'string') {
        // Check for PII patterns
        for (const pattern of piiPatterns) {
          if (pattern.test(value)) {
            throw new BadRequestException(`PII detected in metadata at ${path}: pattern match`);
          }
        }

        // Check for PII keywords (case insensitive)
        const lowerValue = value.toLowerCase();
        for (const keyword of piiKeywords) {
          if (lowerValue.includes(keyword)) {
            throw new BadRequestException(
              `PII detected in metadata at ${path}: keyword '${keyword}'`,
            );
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value)) {
          value.forEach((item, index) => checkValue(item, `${path}[${index}]`));
        } else {
          Object.entries(value as Record<string, unknown>).forEach(([key, val]) => {
            // Check key names for PII keywords
            const lowerKey = key.toLowerCase();
            for (const keyword of piiKeywords) {
              if (lowerKey.includes(keyword)) {
                throw new BadRequestException(`PII detected in metadata key: '${key}'`);
              }
            }
            checkValue(val, path ? `${path}.${key}` : key);
          });
        }
      }
    };

    checkValue(metadata);
  }

  /**
   * Validates uploaded file for PII exclusion (Req 3.8).
   *
   * Basic validation for file names and detectable text content.
   * More sophisticated PII detection would require specialized libraries.
   */
  private validateFilePII(file: MulterFile): void {
    // Check filename for PII keywords
    const filename = file.originalname.toLowerCase();
    const piiKeywords = ['ssn', 'passport', 'license', 'tax', 'bank', 'account'];

    for (const keyword of piiKeywords) {
      if (filename.includes(keyword)) {
        throw new BadRequestException(`Potential PII detected in filename: '${file.originalname}'`);
      }
    }

    // For text files, do basic content checks
    if (file.mimetype.startsWith('text/') || file.mimetype === 'application/json') {
      const content = file.buffer.toString('utf8').toLowerCase();
      const piiPatterns = [
        /\b\d{3}-\d{2}-\d{4}\b/, // SSN format
        /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/, // Email
      ];

      for (const pattern of piiPatterns) {
        if (pattern.test(content)) {
          throw new BadRequestException(`PII detected in file content: '${file.originalname}'`);
        }
      }
    }
  }
}
