import { NextRequest, NextResponse } from 'next/server';

/**
 * API route for uploading documents to IPFS via the backend service.
 * Supports both:
 * - FormData with file(s) (from useDocumentUpload hook)
 * - JSON body with documents array (from useRegistryProfile hook)
 */
export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization) {
      return NextResponse.json({ message: 'Authorization required' }, { status: 401 });
    }

    const backendUrl = process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:3001';
    const contentType = request.headers.get('content-type') || '';

    // Handle FormData (file uploads from ProfileDocuments)
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const files = formData.getAll('files') as File[];

      if (!files || files.length === 0) {
        return NextResponse.json({ message: 'No files provided' }, { status: 400 });
      }

      const cids: string[] = [];

      for (const file of files) {
        if (file.size > 10 * 1024 * 1024) {
          return NextResponse.json(
            { message: `File "${file.name}" exceeds 10MB limit` },
            { status: 400 },
          );
        }

        const uploadForm = new FormData();
        uploadForm.append('file', file);

        const response = await fetch(`${backendUrl}/ipfs/profile-docs`, {
          method: 'POST',
          headers: {
            Authorization: authorization,
          },
          body: uploadForm,
        });

        if (!response.ok) {
          const err = await response.text().catch(() => 'Upload failed');
          return NextResponse.json(
            { message: `Upload failed for "${file.name}": ${err}` },
            { status: response.status },
          );
        }

        const data = await response.json();
        cids.push(data.ipfsHash);
      }

      return NextResponse.json({ cids, success: true });
    }

    // Handle JSON body (metadata uploads from useRegistryProfile)
    const { documents } = await request.json();

    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return NextResponse.json({ message: 'No documents provided' }, { status: 400 });
    }

    const cids: string[] = [];

    for (const doc of documents) {
      const content = typeof doc.content === 'string' ? JSON.parse(doc.content) : doc.content;

      const response = await fetch(`${backendUrl}/ipfs/profile-metadata`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authorization,
        },
        body: JSON.stringify(content),
      });

      if (!response.ok) {
        const err = await response.text().catch(() => 'Upload failed');
        return NextResponse.json({ message: `Upload failed: ${err}` }, { status: 500 });
      }

      const data = await response.json();
      cids.push(data.ipfsHash);
    }

    return NextResponse.json({ cids, success: true });
  } catch (error) {
    console.error('IPFS upload error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
