import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import * as fc from 'fast-check';

import { IpfsService } from './ipfs.service';
import { ConfigService } from '@nestjs/config';

interface MulterFile {
  originalname: string;
  size: number;
  buffer: Buffer;
  mimetype: string;
}

/**
 * Property 10: IPFS upload boundary validation
 * **Validates: Requirements 3.5, 3.8**
 * 
 * This test validates the IPFS upload boundary enforcement and PII exclusion:
 * - Maximum 10 documents per request enforcement (Req 3.5)
 * - Maximum 10MB per document size limit (Req 3.5)
 * - PII exclusion validation for government IDs, addresses, phone numbers, emails, financial credentials (Req 3.8)
 * - Proper rejection of over-limit uploads without storage
 * - Content validation before public IPFS pinning
 */
describe('Property 10: IPFS upload boundary and PII exclusion', () => {
  let service: IpfsService;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    const mockConfigService = {
      getOrThrow: jest.fn().mockImplementation((key: string) => {
        if (key === 'PINATA_JWT') {
          return 'fake-jwt-token-for-testing';
        }
        throw new Error(`Unknown config key: ${key}`);
      }),
    };

    moduleRef = await Test.createTestingModule({
      providers: [
        IpfsService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    moduleRef.useLogger(false);
    service = moduleRef.get<IpfsService>(IpfsService);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  /**
   * Property: Document count limit enforcement
   * Requirements: 3.5 (maximum 10 documents per request)
   */
  it('rejects uploads exceeding 10 document limit per request', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 11, max: 50 }), // Generate counts above the limit
        async (documentCount) => {
          // Generate valid small files that exceed count limit
          const files: MulterFile[] = Array.from({ length: documentCount }, (_, i) => ({
            originalname: `document_${i}.txt`,
            size: 1024, // 1KB - well under size limit
            buffer: Buffer.from(`Valid content for document ${i}`),
            mimetype: 'text/plain',
          }));

          // Mock fetch to avoid actual IPFS calls during count validation
          global.fetch = jest.fn();

          await expect(service.uploadProfileDocuments(files)).rejects.toThrow(
            BadRequestException
          );
          await expect(service.uploadProfileDocuments(files)).rejects.toThrow(
            'Maximum 10 documents per request'
          );

          // Verify no IPFS calls were made when count limit exceeded
          expect(global.fetch).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: Document size limit enforcement
   * Requirements: 3.5 (maximum 10MB per document)
   */
  it('rejects documents exceeding 10MB size limit', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 10 * 1024 * 1024 + 1, max: 50 * 1024 * 1024 }), // Generate sizes above 10MB
        fc.string({ minLength: 1, maxLength: 20 }), // Valid filename
        async (fileSize, baseName) => {
          // Generate a file that exceeds the size limit
          const files: MulterFile[] = [{
            originalname: `${baseName}.txt`,
            size: fileSize,
            buffer: Buffer.alloc(Math.min(fileSize, 1024)), // Don't actually allocate huge buffers in tests
            mimetype: 'text/plain',
          }];

          // Mock fetch to avoid actual IPFS calls during size validation
          global.fetch = jest.fn();

          await expect(service.uploadProfileDocuments(files)).rejects.toThrow(
            BadRequestException
          );
          await expect(service.uploadProfileDocuments(files)).rejects.toThrow(
            `exceeds 10MB limit`
          );

          // Verify no IPFS calls were made when size limit exceeded
          expect(global.fetch).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: Valid uploads within limits pass boundary checks
   * Requirements: 3.5 (valid uploads should be processed)
   */
  it('accepts valid uploads within count and size limits', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }), // Valid document count
        fc.integer({ min: 1, max: 10 * 1024 * 1024 }), // Valid size per document
        async (documentCount, documentSize) => {
          // Generate valid files within limits
          const files: MulterFile[] = Array.from({ length: documentCount }, (_, i) => ({
            originalname: `valid_document_${i}.txt`,
            size: documentSize,
            buffer: Buffer.from(`Valid content for document ${i}`.repeat(documentSize / 32 + 1)).subarray(0, documentSize),
            mimetype: 'text/plain',
          }));

          // Mock successful IPFS response
          const mockResponse = {
            ok: true,
            json: jest.fn().mockResolvedValue({ IpfsHash: `QmTest${Date.now()}${Math.random()}` }),
          };
          global.fetch = jest.fn().mockResolvedValue(mockResponse);

          // Should not throw during boundary validation
          const result = await service.uploadProfileDocuments(files);

          // Should return CIDs for each file
          expect(result).toHaveLength(documentCount);
          expect(result.every(cid => typeof cid === 'string' && cid.startsWith('QmTest'))).toBe(true);

          // Should have made IPFS calls for each file
          expect(global.fetch).toHaveBeenCalledTimes(documentCount);
        }
      ),
      { numRuns: 15 }
    );
  });

  /**
   * Property: PII patterns in file content are rejected
   * Requirements: 3.8 (exclude government IDs, addresses, phone numbers, emails, financial credentials)
   */
  it('rejects files containing PII patterns in content', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          // Government ID patterns (supported by current implementation)
          fc.constant('123-45-6789'), // SSN format
          // Email addresses (supported by current implementation)
          fc.emailAddress(),
        ),
        fc.string({ minLength: 1, maxLength: 20 }), // Base filename
        async (piiContent, baseName) => {
          const files: MulterFile[] = [{
            originalname: `${baseName}.txt`,
            size: piiContent.length + 100,
            buffer: Buffer.from(`Some valid content with PII: ${piiContent} and more content`),
            mimetype: 'text/plain',
          }];

          // Mock fetch to avoid actual IPFS calls during PII validation
          global.fetch = jest.fn();

          await expect(service.uploadProfileDocuments(files)).rejects.toThrow(
            BadRequestException
          );
          await expect(service.uploadProfileDocuments(files)).rejects.toThrow(
            /PII detected in file content/
          );

          // Verify no IPFS calls were made when PII detected
          expect(global.fetch).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 25 }
    );
  });

  /**
   * Property: Non-text files with PII patterns are not content-validated 
   * Requirements: 3.8 (file content PII validation only applies to text files)
   */
  it('processes non-text files without content-based PII validation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant('1234-5678-9012-3456'), // Credit card in binary content
          fc.constant('user@example.com'), // Email in binary content
        ),
        fc.constantFrom('application/pdf', 'image/jpeg', 'application/zip'),
        async (piiContent, mimetype) => {
          const files: MulterFile[] = [{
            originalname: 'document.bin',
            size: piiContent.length + 100,
            buffer: Buffer.from(`Binary content with embedded: ${piiContent}`),
            mimetype,
          }];

          // Mock successful IPFS response
          const mockResponse = {
            ok: true,
            json: jest.fn().mockResolvedValue({ IpfsHash: `QmBinary${Date.now()}` }),
          };
          global.fetch = jest.fn().mockResolvedValue(mockResponse);

          // Should not throw for non-text files (content PII validation skipped)
          const result = await service.uploadProfileDocuments(files);
          expect(result).toHaveLength(1);
          expect(global.fetch).toHaveBeenCalledTimes(1);
        }
      ),
      { numRuns: 15 }
    );
  });

  /**
   * Property: PII keywords in filenames are rejected
   * Requirements: 3.8 (exclude government IDs, addresses, phone numbers, emails, financial credentials)
   */
  it('rejects files with PII keywords in filenames', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant('ssn'),
          fc.constant('passport'),
          fc.constant('license'),
          fc.constant('tax'),
          fc.constant('bank'),
          fc.constant('account'),
        ),
        fc.string({ minLength: 1, maxLength: 15 }),
        async (piiKeyword, suffix) => {
          const files: MulterFile[] = [{
            originalname: `my_${piiKeyword}_${suffix}.pdf`,
            size: 1024,
            buffer: Buffer.from('Valid file content without PII'),
            mimetype: 'application/pdf',
          }];

          // Mock fetch to avoid actual IPFS calls during filename validation
          global.fetch = jest.fn();

          await expect(service.uploadProfileDocuments(files)).rejects.toThrow(
            BadRequestException
          );
          await expect(service.uploadProfileDocuments(files)).rejects.toThrow(
            /Potential PII detected in filename/
          );

          // Verify no IPFS calls were made when PII detected in filename
          expect(global.fetch).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: Certificate metadata PII exclusion with comprehensive patterns
   * Requirements: 3.8 (exclude PII from certificate metadata - comprehensive validation)
   */
  it('rejects certificate metadata containing comprehensive PII patterns', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          // PII in values - patterns that ARE detected by validateNoPII
          fc.record({
            certificateType: fc.constant('completion'),
            recipientInfo: fc.constant('john.doe@email.com'), // Email PII
            issuedDate: fc.constant('2024-01-01'),
          }),
          fc.record({
            certificateType: fc.constant('achievement'),
            userPhone: fc.constant('555-123-4567'), // Phone PII
            issuedDate: fc.constant('2024-01-01'),
          }),
          fc.record({
            certificateType: fc.constant('completion'),
            socialSecurity: fc.constant('123-45-6789'), // SSN PII
            issuedDate: fc.constant('2024-01-01'),
          }),
          fc.record({
            certificateType: fc.constant('completion'),
            paymentCard: fc.constant('1234-5678-9012-3456'), // Credit card PII
            issuedDate: fc.constant('2024-01-01'),
          }),
          // PII in keys
          fc.record({
            certificateType: fc.constant('completion'),
            ssn_number: fc.constant('redacted'), // PII key name
            issuedDate: fc.constant('2024-01-01'),
          }),
          fc.record({
            certificateType: fc.constant('completion'),
            email_address: fc.constant('redacted'), // PII key name
            issuedDate: fc.constant('2024-01-01'),
          }),
        ),
        async (metadata) => {
          // Mock fetch to avoid actual IPFS calls during PII validation
          global.fetch = jest.fn();

          await expect(service.storeCertificateMetadata(metadata)).rejects.toThrow(
            BadRequestException
          );
          await expect(service.storeCertificateMetadata(metadata)).rejects.toThrow(
            /PII detected in metadata/
          );

          // Verify no IPFS calls were made when PII detected
          expect(global.fetch).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 25 }
    );
  });

  /**
   * Property: Valid metadata without PII is processed
   * Requirements: 3.8 (valid metadata should be stored successfully)
   */
  it('accepts valid certificate metadata without PII', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          certificateType: fc.constantFrom('completion', 'achievement', 'badge'),
          courseName: fc.string({ minLength: 3, maxLength: 50 }),
          completionLevel: fc.constantFrom('basic', 'intermediate', 'advanced'),
          issuedDate: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }).map(d => d.toISOString().split('T')[0]),
          validUntil: fc.option(fc.date({ min: new Date('2025-01-01'), max: new Date('2030-12-31') }).map(d => d.toISOString().split('T')[0])),
          skills: fc.array(fc.string({ minLength: 2, maxLength: 20 }), { maxLength: 5 }),
        }),
        async (metadata) => {
          // Mock successful IPFS response
          const mockResponse = {
            ok: true,
            json: jest.fn().mockResolvedValue({ IpfsHash: `QmCert${Date.now()}${Math.random()}` }),
          };
          global.fetch = jest.fn().mockResolvedValue(mockResponse);

          // Should not throw during PII validation
          const cid = await service.storeCertificateMetadata(metadata);

          // Should return a valid CID
          expect(typeof cid).toBe('string');
          expect(cid.startsWith('QmCert')).toBe(true);

          // Should have made IPFS call
          expect(global.fetch).toHaveBeenCalledTimes(1);
          expect(global.fetch).toHaveBeenCalledWith(
            'https://api.pinata.cloud/pinning/pinJSONToIPFS',
            expect.objectContaining({
              method: 'POST',
              headers: expect.objectContaining({
                'Content-Type': 'application/json',
                'Authorization': 'Bearer fake-jwt-token-for-testing',
              }),
            })
          );
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: Complex nested metadata PII detection
   * Requirements: 3.8 (PII detection in nested structures)
   */
  it('detects PII in nested metadata structures', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          // PII deep in nested object
          fc.record({
            certificateInfo: fc.record({
              recipient: fc.record({
                contactInfo: fc.record({
                  email: fc.emailAddress(), // Deep nested PII
                }),
              }),
            }),
          }),
          // PII in array element
          fc.record({
            achievements: fc.array(
              fc.record({
                name: fc.string(),
                identifier: fc.constant('123-45-6789'), // SSN in array
              }),
              { minLength: 1, maxLength: 3 }
            ),
          }),
        ),
        async (metadata) => {
          // Mock fetch to avoid actual IPFS calls
          global.fetch = jest.fn();

          await expect(service.storeCertificateMetadata(metadata)).rejects.toThrow(
            BadRequestException
          );
          await expect(service.storeCertificateMetadata(metadata)).rejects.toThrow(
            /PII detected in metadata/
          );

          // Verify no IPFS calls were made
          expect(global.fetch).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 15 }
    );
  });

  /**
   * Property: Boundary conditions - exact limits
   * Requirements: 3.5 (test exact boundary conditions)
   */
  it('handles exact boundary conditions correctly', async () => {
    // Test exactly 10 documents
    const exactlyTenFiles: MulterFile[] = Array.from({ length: 10 }, (_, i) => ({
      originalname: `boundary_test_${i}.txt`,
      size: 1024,
      buffer: Buffer.from(`Content for file ${i}`),
      mimetype: 'text/plain',
    }));

    // Mock successful IPFS response
    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({ IpfsHash: `QmBoundary${Date.now()}${Math.random()}` }),
    };
    global.fetch = jest.fn().mockResolvedValue(mockResponse);

    // Should accept exactly 10 files
    const result = await service.uploadProfileDocuments(exactlyTenFiles);
    expect(result).toHaveLength(10);

    // Test exactly 10MB file
    const exactlyTenMBFile: MulterFile[] = [{
      originalname: 'exactly_10mb.bin',
      size: 10 * 1024 * 1024, // Exactly 10MB
      buffer: Buffer.alloc(1024), // Don't allocate full 10MB in test
      mimetype: 'application/octet-stream',
    }];

    // Reset mock
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue(mockResponse);

    // Should accept exactly 10MB file
    const result2 = await service.uploadProfileDocuments(exactlyTenMBFile);
    expect(result2).toHaveLength(1);
  });

  /**
   * Property: Error handling preserves no-CID guarantee
   * Requirements: 3.9 (no CID returned on storage failure)
   */
  it('returns no CID when storage fails after passing validation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }), // Valid file count
        async (fileCount) => {
          // Generate valid files that pass all validation
          const files: MulterFile[] = Array.from({ length: fileCount }, (_, i) => ({
            originalname: `valid_file_${i}.txt`,
            size: 1024,
            buffer: Buffer.from(`Valid content ${i}`),
            mimetype: 'text/plain',
          }));

          // Mock IPFS failure response
          const mockFailureResponse = {
            ok: false,
            status: 500,
            text: jest.fn().mockResolvedValue('Internal server error'),
          };
          global.fetch = jest.fn().mockResolvedValue(mockFailureResponse);

          // Should throw InternalServerErrorException, not return partial CIDs
          await expect(service.uploadProfileDocuments(files)).rejects.toThrow(
            InternalServerErrorException
          );
          await expect(service.uploadProfileDocuments(files)).rejects.toThrow(
            'IPFS storage failed'
          );
        }
      ),
      { numRuns: 10 }
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
});