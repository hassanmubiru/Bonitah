/**
 * Unit tests for IPFS storage failure handling (Task 15.3).
 * 
 * **Validates: Requirements 3.9, 8.9**
 * 
 * Tests storage failure scenarios for IPFS operations to ensure:
 * - Proper error responses when IPFS storage fails (Req 3.9, 8.9)
 * - No content hash returned on storage failure (Req 3.9, 8.9)
 * - Graceful handling of network issues with IPFS service
 * - Error propagation and messaging
 * - State consistency when uploads fail
 * 
 * This validates the critical requirement that IPFS service failures result in
 * error responses with no CID returned, maintaining system consistency.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IpfsService } from './ipfs.service';

// Mock fetch globally
global.fetch = jest.fn();

describe('IpfsService - Storage Failure Handling', () => {
  let service: IpfsService;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  const testJwtToken = 'test-pinata-jwt-token';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IpfsService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) => {
              if (key === 'PINATA_JWT') return testJwtToken;
              throw new Error(`Config key ${key} not found`);
            }),
          },
        },
      ],
    }).compile();

    service = module.get<IpfsService>(IpfsService);
    mockFetch = fetch as jest.MockedFunction<typeof fetch>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Certificate Metadata Storage Failures (Requirement 8.9)', () => {
    const validCertificateMetadata = {
      courseId: 'course-123',
      userId: '0x1234567890123456789012345678901234567890',
      completionDate: '2024-01-15T10:30:00Z',
      courseName: 'Financial Literacy Basics',
      achievements: ['completed_course', 'quiz_perfect_score'],
    };

    it('throws InternalServerErrorException when Pinata API returns error status', async () => {
      // Arrange: Mock failed API response
      const mockErrorResponse = {
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue('Internal Server Error'),
      };
      mockFetch.mockResolvedValue(mockErrorResponse as any);

      // Act & Assert: Should throw error with no CID returned (Req 8.9)
      await expect(service.storeCertificateMetadata(validCertificateMetadata))
        .rejects.toThrow(InternalServerErrorException);
      
      await expect(service.storeCertificateMetadata(validCertificateMetadata))
        .rejects.toThrow('IPFS storage failed');

      // Verify correct API call was made
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.pinata.cloud/pinning/pinJSONToIPFS',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${testJwtToken}`,
          },
          body: expect.stringContaining('pinataContent'),
        })
      );
    });

    it('throws InternalServerErrorException when API returns success but no IPFS hash', async () => {
      // Arrange: Mock API response with no IpfsHash field
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ someOtherField: 'value' }),
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      // Act & Assert: Should throw error when no hash returned (Req 8.9)
      await expect(service.storeCertificateMetadata(validCertificateMetadata))
        .rejects.toThrow(InternalServerErrorException);
      
      await expect(service.storeCertificateMetadata(validCertificateMetadata))
        .rejects.toThrow('IPFS storage failed - no hash returned');
    });

    it('throws InternalServerErrorException when network request fails', async () => {
      // Arrange: Mock network failure
      mockFetch.mockRejectedValue(new Error('Network error'));

      // Act & Assert: Should catch network errors and throw storage error (Req 8.9)
      await expect(service.storeCertificateMetadata(validCertificateMetadata))
        .rejects.toThrow(InternalServerErrorException);
      
      await expect(service.storeCertificateMetadata(validCertificateMetadata))
        .rejects.toThrow('IPFS storage failed');
    });

    it('throws InternalServerErrorException when JSON parsing fails', async () => {
      // Arrange: Mock response with invalid JSON
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      // Act & Assert: Should handle JSON parsing errors (Req 8.9)
      await expect(service.storeCertificateMetadata(validCertificateMetadata))
        .rejects.toThrow(InternalServerErrorException);
    });

    it('preserves and re-throws BadRequestException for PII validation errors', async () => {
      // Arrange: Metadata with PII that should fail validation
      const piiMetadata = {
        courseId: 'course-123',
        userEmail: 'user@example.com', // PII - should trigger validation error
        completionDate: '2024-01-15T10:30:00Z',
      };

      // Act & Assert: PII errors should be preserved, not converted to storage errors
      await expect(service.storeCertificateMetadata(piiMetadata))
        .rejects.toThrow(BadRequestException);
      
      // Verify fetch was never called due to PII validation failure
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns CID when storage succeeds', async () => {
      // Arrange: Mock successful response
      const expectedCid = 'QmTest123HashExample456';
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ IpfsHash: expectedCid }),
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      // Act: Store valid metadata
      const result = await service.storeCertificateMetadata(validCertificateMetadata);

      // Assert: Should return the CID on success
      expect(result).toBe(expectedCid);
    });
  });

  describe('Profile Document Storage Failures (Requirement 3.9)', () => {
    const createMockFile = (name: string, size: number, content: string = 'test content'): any => ({
      originalname: name,
      size,
      buffer: Buffer.from(content),
      mimetype: 'text/plain',
    });

    it('throws InternalServerErrorException when Pinata file upload API returns error', async () => {
      // Arrange: Valid files and failed API response
      const testFiles = [createMockFile('resume.txt', 1024)];
      
      const mockErrorResponse = {
        ok: false,
        status: 413,
        text: jest.fn().mockResolvedValue('Payload too large'),
      };
      mockFetch.mockResolvedValue(mockErrorResponse as any);

      // Act & Assert: Should throw error with no CIDs returned (Req 3.9)
      await expect(service.uploadProfileDocuments(testFiles))
        .rejects.toThrow(InternalServerErrorException);
      
      await expect(service.uploadProfileDocuments(testFiles))
        .rejects.toThrow('IPFS storage failed');
    });

    it('throws InternalServerErrorException when API returns success but no IPFS hash for file', async () => {
      // Arrange: Mock response with missing IpfsHash
      const testFiles = [createMockFile('document.txt', 1024)];
      
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ PinSize: 1024 }), // No IpfsHash field
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      // Act & Assert: Should throw error when no hash returned for file (Req 3.9)
      await expect(service.uploadProfileDocuments(testFiles))
        .rejects.toThrow(InternalServerErrorException);
      
      await expect(service.uploadProfileDocuments(testFiles))
        .rejects.toThrow('IPFS storage failed - no hash returned');
    });

    it('throws InternalServerErrorException when network fails during file upload', async () => {
      // Arrange: Valid files and network failure
      const testFiles = [createMockFile('photo.jpg', 2048)];
      mockFetch.mockRejectedValue(new Error('Connection timeout'));

      // Act & Assert: Should handle network failures gracefully (Req 3.9)
      await expect(service.uploadProfileDocuments(testFiles))
        .rejects.toThrow(InternalServerErrorException);
      
      await expect(service.uploadProfileDocuments(testFiles))
        .rejects.toThrow('IPFS storage failed');
    });

    it('fails early on first file upload error without processing remaining files', async () => {
      // Arrange: Multiple files where first one will fail
      const testFiles = [
        createMockFile('first.txt', 1024),
        createMockFile('second.txt', 1024),
        createMockFile('third.txt', 1024),
      ];
      
      mockFetch.mockRejectedValue(new Error('Network error'));

      // Act & Assert: Should fail on first file and not continue
      await expect(service.uploadProfileDocuments(testFiles))
        .rejects.toThrow(InternalServerErrorException);
      
      // Should only call fetch once (for the first file)
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('throws BadRequestException for size limit violations without attempting upload', async () => {
      // Arrange: File exceeding 10MB limit
      const oversizedFile = createMockFile('large.txt', 11 * 1024 * 1024); // 11MB
      const testFiles = [oversizedFile];

      // Act & Assert: Should fail validation before upload attempt (Req 3.5)
      await expect(service.uploadProfileDocuments(testFiles))
        .rejects.toThrow(BadRequestException);
      
      await expect(service.uploadProfileDocuments(testFiles))
        .rejects.toThrow('File large.txt exceeds 10MB limit');
      
      // Verify no API call was made
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('throws BadRequestException for count limit violations without attempting upload', async () => {
      // Arrange: More than 10 files
      const testFiles = Array.from({ length: 11 }, (_, i) => 
        createMockFile(`file${i}.txt`, 1024)
      );

      // Act & Assert: Should fail validation before upload attempt (Req 3.5)
      await expect(service.uploadProfileDocuments(testFiles))
        .rejects.toThrow(BadRequestException);
      
      await expect(service.uploadProfileDocuments(testFiles))
        .rejects.toThrow('Maximum 10 documents per request');
      
      // Verify no API call was made
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('throws BadRequestException for PII detection without attempting upload', async () => {
      // Arrange: File with PII in filename
      const piiFile = createMockFile('ssn-document.txt', 1024);
      const testFiles = [piiFile];

      // Act & Assert: Should fail PII validation before upload (Req 3.8)
      await expect(service.uploadProfileDocuments(testFiles))
        .rejects.toThrow(BadRequestException);
      
      await expect(service.uploadProfileDocuments(testFiles))
        .rejects.toThrow("Potential PII detected in filename: 'ssn-document.txt'");
      
      // Verify no API call was made
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns array of CIDs when all files upload successfully', async () => {
      // Arrange: Multiple valid files and successful responses
      const testFiles = [
        createMockFile('doc1.txt', 1024),
        createMockFile('doc2.txt', 2048),
      ];
      
      const expectedCids = ['QmHash1', 'QmHash2'];
      
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ IpfsHash: expectedCids[0] }),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ IpfsHash: expectedCids[1] }),
        } as any);

      // Act: Upload valid files
      const result = await service.uploadProfileDocuments(testFiles);

      // Assert: Should return all CIDs in order
      expect(result).toEqual(expectedCids);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('State Consistency During Failures', () => {
    it('ensures no partial state changes when certificate storage fails', async () => {
      // Arrange: Mock storage failure
      mockFetch.mockRejectedValue(new Error('Storage unavailable'));

      const metadata = { courseId: 'test', userId: '0x123' };

      // Act: Attempt storage that will fail
      let thrownError: any;
      try {
        await service.storeCertificateMetadata(metadata);
      } catch (error) {
        thrownError = error;
      }

      // Assert: Should throw error and maintain no state (service is stateless)
      expect(thrownError).toBeInstanceOf(InternalServerErrorException);
      expect(thrownError.message).toBe('IPFS storage failed');
      
      // No side effects should occur - service should be ready for retry
      mockFetch.mockClear();
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ IpfsHash: 'QmTest' }),
      } as any);

      // Should be able to retry successfully
      const retryResult = await service.storeCertificateMetadata(metadata);
      expect(retryResult).toBe('QmTest');
    });

    it('ensures no partial uploads when file storage fails mid-process', async () => {
      // Arrange: First file succeeds, second file fails
      const testFiles = [
        { originalname: 'file1.txt', size: 1024, buffer: Buffer.from('content1'), mimetype: 'text/plain' },
        { originalname: 'file2.txt', size: 1024, buffer: Buffer.from('content2'), mimetype: 'text/plain' },
      ];

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ IpfsHash: 'QmFirst' }),
        } as any)
        .mockRejectedValueOnce(new Error('Second file failed'));

      // Act & Assert: Should fail completely, not return partial results
      await expect(service.uploadProfileDocuments(testFiles))
        .rejects.toThrow(InternalServerErrorException);
      
      // Verify both API calls were attempted
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Message Propagation', () => {
    it('provides specific error messages for different failure types', async () => {
      const metadata = { courseId: 'test' };

      // Test HTTP error with custom message
      const mockResponse = {
        ok: false,
        status: 429,
        text: jest.fn().mockResolvedValue('Rate limited'),
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      await expect(service.storeCertificateMetadata(metadata))
        .rejects.toThrow('IPFS storage failed');

      // Test missing hash scenario
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      } as any);

      await expect(service.storeCertificateMetadata(metadata))
        .rejects.toThrow('IPFS storage failed - no hash returned');
    });

    it('handles and converts unexpected errors to storage failures', async () => {
      const metadata = { courseId: 'test' };

      // Test various unexpected error types
      const errorTypes = [
        new TypeError('Cannot read property'),
        new ReferenceError('Variable not defined'),
        new Error('Unexpected error'),
      ];

      for (const error of errorTypes) {
        mockFetch.mockRejectedValue(error);
        
        await expect(service.storeCertificateMetadata(metadata))
          .rejects.toThrow(InternalServerErrorException);
        
        await expect(service.storeCertificateMetadata(metadata))
          .rejects.toThrow('IPFS storage failed');
      }
    });
  });
});