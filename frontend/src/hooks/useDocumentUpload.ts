'use client';

import { useState, useCallback } from 'react';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:3001';

/**
 * Document upload management hook
 *
 * Uploads files directly to the Supabase backend IPFS service.
 */
export function useDocumentUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  /**
   * Upload document to IPFS via backend service
   */
  const uploadDocument = useCallback(async (file: File, _category: string = 'general') => {
    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new Error('File size exceeds 10MB limit');
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (!allowedTypes.includes(file.type)) {
      throw new Error('Unsupported file type. Please use PDF, images, or document files.');
    }

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      // Call Supabase backend directly
      const response = await fetch(`${API_URL}/ipfs/profile-docs`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('bfn-auth-token')}`,
        },
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || 'Upload failed');
      }

      const result = await response.json();

      setTimeout(() => {
        setUploadProgress(0);
        setIsUploading(false);
      }, 1000);

      return {
        cid: result.ipfsHash,
        url: result.url || `https://gateway.pinata.cloud/ipfs/${result.ipfsHash}`,
        name: file.name,
        size: formatFileSize(file.size),
        type: file.type,
      };
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : 'Upload failed';
      setError(message);
      setIsUploading(false);
      setUploadProgress(0);
      throw uploadError;
    }
  }, []);

  /**
   * Delete document from IPFS (unpin)
   */
  const deleteDocument = useCallback(async (documentId: string) => {
    try {
      const response = await fetch(`${API_URL}/ipfs/${documentId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('bfn-auth-token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete document');
      }

      return true;
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : 'Delete failed';
      setError(message);
      throw deleteError;
    }
  }, []);

  /**
   * Clear current error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    uploadDocument,
    deleteDocument,
    isUploading,
    uploadProgress,
    error,
    clearError,
  };
}

/**
 * Format file size in human-readable format
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
