'use client';

import { useState } from 'react';
import { useSiweAuth } from './useSiweAuth';

export interface UseDocumentUploadResult {
  uploadDocuments: (files: File[]) => Promise<string[]>;
  isUploading: boolean;
  error: Error | null;
}

/**
 * Hook for uploading profile documents to IPFS via backend service.
 */
export function useDocumentUpload(): UseDocumentUploadResult {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { token } = useSiweAuth();

  const uploadDocuments = async (files: File[]): Promise<string[]> => {
    if (!token) {
      throw new Error('Authentication required for document upload');
    }

    if (files.length === 0) {
      throw new Error('No files provided for upload');
    }

    if (files.length > 10) {
      throw new Error('Maximum 10 files allowed per upload');
    }

    // Validate each file
    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        throw new Error(`File "${file.name}" exceeds 10MB limit`);
      }

      // Check file type
      const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
      ];

      if (!allowedTypes.includes(file.type)) {
        throw new Error(`File "${file.name}" has unsupported type: ${file.type}`);
      }
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('files', file);
      });

      const response = await fetch('/api/ipfs/profile-docs', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Upload failed' }));
        throw new Error(errorData.message || `Upload failed: ${response.status}`);
      }

      const data = await response.json();

      if (!data.cids || !Array.isArray(data.cids)) {
        throw new Error('Invalid response from upload service');
      }

      return data.cids;
    } catch (err) {
      const uploadError = err instanceof Error ? err : new Error('Upload failed');
      setError(uploadError);
      throw uploadError;
    } finally {
      setIsUploading(false);
    }
  };

  return {
    uploadDocuments,
    isUploading,
    error,
  };
}
