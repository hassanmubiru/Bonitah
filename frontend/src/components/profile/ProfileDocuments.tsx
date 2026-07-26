'use client';

import { useState, useCallback } from 'react';
import { type Address } from 'viem';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Upload, File, X, AlertCircle, CheckCircle } from 'lucide-react';
import { useDocumentUpload } from '@/hooks/useDocumentUpload';

export interface ProfileDocumentsProps {
  userAddress: Address;
  profileHash?: string;
}

export interface UploadedDocument {
  name: string;
  size: number;
  type: string;
  cid?: string;
  error?: string;
}

/**
 * Document management interface with IPFS upload functionality.
 * Implements document upload with validation per requirements.
 */
export function ProfileDocuments({
  userAddress: _userAddress,
  profileHash,
}: ProfileDocumentsProps) {
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const { uploadDocument, isUploading, error } = useDocumentUpload();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newDocuments: UploadedDocument[] = acceptedFiles.map((file) => ({
      name: file.name,
      size: file.size,
      type: file.type,
    }));

    setDocuments((prev) => [...prev, ...newDocuments]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 10,
    maxSize: 10 * 1024 * 1024, // 10MB
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
    },
  });

  const removeDocument = (index: number) => {
    setDocuments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (documents.length === 0) return;

    const files = documents.map((doc) => {
      // Convert document back to File object for upload
      return new (globalThis as any).File([''], doc.name, { type: doc.type }) as File;
    });

    try {
      // Upload files one by one since we only have uploadDocument (singular)
      const cids = await Promise.all(files.map(file => uploadDocument(file)));

      // Update documents with CIDs
      setDocuments((prev) =>
        prev.map((doc, index) => ({
          ...doc,
          cid: cids[index]?.cid,
        })),
      );
    } catch (err) {
      console.error('Upload failed:', err);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return '🖼️';
    if (type === 'application/pdf') return '📄';
    if (type.includes('word')) return '📝';
    return '📎';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <File className="h-5 w-5" />
          Profile Documents
        </CardTitle>
        <CardDescription>Upload verification documents and profile assets to IPFS</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Profile Hash */}
        {profileHash && (
          <div className="p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">Current Profile</span>
            </div>
            <p className="text-xs text-muted-foreground font-mono break-all">{profileHash}</p>
          </div>
        )}

        {/* Upload Zone */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
            isDragActive
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-muted-foreground/50'
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
          {isDragActive ? (
            <p className="text-sm text-muted-foreground">Drop the files here...</p>
          ) : (
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Drag & drop files here, or click to select
              </p>
              <p className="text-xs text-muted-foreground">
                Max 10 files, 10MB each. Supports PDF, images, Word docs, and text files.
              </p>
            </div>
          )}
        </div>

        {/* File List */}
        {documents.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium">Selected Files ({documents.length}/10)</h4>
            <div className="space-y-2">
              {documents.map((doc, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-lg">{getFileIcon(doc.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.name}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground">{formatFileSize(doc.size)}</p>
                        {doc.cid && (
                          <Badge variant="outline" className="text-xs">
                            Uploaded
                          </Badge>
                        )}
                        {doc.error && (
                          <Badge variant="destructive" className="text-xs">
                            Error
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeDocument(index)}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <div>
              <p className="font-medium">Upload Failed</p>
              <p className="text-sm">{error}</p>
            </div>
          </Alert>
        )}

        {/* Upload Button */}
        {documents.length > 0 && (
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Files will be stored on IPFS and linked to your profile
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDocuments([])} disabled={isUploading}>
                Clear All
              </Button>
              <Button onClick={handleUpload} disabled={isUploading || documents.some((d) => d.cid)}>
                {isUploading ? 'Uploading...' : 'Upload to IPFS'}
              </Button>
            </div>
          </div>
        )}

        {/* Upload Guidelines */}
        <div className="space-y-2 p-4 bg-muted/30 rounded-lg">
          <h4 className="font-medium text-sm">Document Guidelines</h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Maximum 10 documents per upload</li>
            <li>• Each file must be under 10MB</li>
            <li>• Supported formats: PDF, JPG, PNG, DOC, DOCX, TXT</li>
            <li>• Do not include personal identifying information (SSN, passport numbers, etc.)</li>
            <li>• Documents are stored permanently on IPFS</li>
            <li>• Verify document content before uploading</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
