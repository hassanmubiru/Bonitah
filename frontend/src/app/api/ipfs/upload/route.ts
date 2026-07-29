import { NextRequest, NextResponse } from 'next/server';

/**
 * API route for uploading documents to IPFS via Pinata.
 * Accepts an array of documents and returns their CIDs.
 */
export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization) {
      return NextResponse.json({ message: 'Authorization required' }, { status: 401 });
    }

    const { documents } = await request.json();

    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return NextResponse.json({ message: 'No documents provided' }, { status: 400 });
    }

    const backendUrl = process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:3001';
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
        const err = await response.text();
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
