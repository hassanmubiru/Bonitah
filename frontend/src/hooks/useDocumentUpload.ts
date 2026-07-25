'use client';

import { useState, useCallback } from 'react';

/**
 * Document upload management hook
 * 
 * Implements Task 21.9 requirements for IPFS document upload
 */
export function useDocumentUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  /**
   * Upload document to IPFS via backend service
   */
  const uploadDocument = useCallback(async (file: File, category: string = 'general') => {
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
      formData.append('files', file);
      formData.append('category', category);

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const response = await fetch('/api/ipfs/upload', {
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
        throw new Error(errorData.message || 'Upload failed');
      }

      const result = await response.json();
      
      setTimeout(() => {
        setUploadProgress(0);
        setIsUploading(false);
      }, 1000);

      return {
        cid: result.cids[0],
        url: `https://ipfs.io/ipfs/${result.cids[0]}`,
        name: file.name,
        size: formatFileSize(file.size),
        type: file.type,
      };

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Upload failed');
      setIsUploading(false);
      setUploadProgress(0);
      throw error;
    }
  }, []);

  /**
   * Delete document from IPFS (unpin)
   */
  const deleteDocument = useCallback(async (documentId: string) => {
    try {
      const response = await fetch(`/api/ipfs/unpin/${documentId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('bfn-auth-token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete document');
      }

      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Delete failed');
      throw error;
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