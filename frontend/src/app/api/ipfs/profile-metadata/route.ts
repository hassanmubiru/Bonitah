import { NextRequest, NextResponse } from 'next/server';

/**
 * API route for uploading profile metadata to IPFS.
 * This is a frontend-side proxy to the backend IPFS service.
 */
export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization) {
      return NextResponse.json({ message: 'Authorization required' }, { status: 401 });
    }

    const profileData = await request.json();

    // Forward to backend IPFS service
    const backendUrl = process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:3001';
    const response = await fetch(`${backendUrl}/ipfs/profile-metadata`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authorization,
      },
      body: JSON.stringify(profileData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Upload failed' }));
      return NextResponse.json(errorData, { status: response.status });
    }

    const data = await response.json();
    // Map backend response (ipfsHash) to frontend expected format (cid)
    return NextResponse.json({ cid: data.ipfsHash, url: data.url, success: data.success });
  } catch (error) {
    console.error('Profile metadata upload error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
