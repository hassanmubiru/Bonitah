import { NextRequest, NextResponse } from 'next/server';

/**
 * API route for uploading documents to IPFS via the backend service.
 * Accepts FormData with file(s) and forwards to the backend IPFS endpoint.
 */
export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization) {
      return NextResponse.json({ message: 'Authorization required' }, { status: 401 });
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ message: 'No files provided' }, { status: 400 });
    }

    const backendUrl = process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:3001';
    const cids: string[] = [];

    for (const file of files) {
      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          { message: `File "${file.name}" exceeds 10MB limit` },
          { status: 400 },
        );
      }

      // Forward each file to backend IPFS service
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
  } catch (error) {
    console.error('IPFS upload error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
