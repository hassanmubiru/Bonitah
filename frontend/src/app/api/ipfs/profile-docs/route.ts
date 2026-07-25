import { NextRequest, NextResponse } from 'next/server';

/**
 * API route for uploading profile documents to IPFS.
 * This is a frontend-side proxy to the backend IPFS service.
 */
export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization) {
      return NextResponse.json({ message: 'Authorization required' }, { status: 401 });
    }

    const formData = await request.formData();

    // Forward to backend IPFS service
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const response = await fetch(`${backendUrl}/ipfs/profile-docs`, {
      method: 'POST',
      headers: {
        'Authorization': authorization,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Upload failed' }));
      return NextResponse.json(errorData, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Profile documents upload error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}