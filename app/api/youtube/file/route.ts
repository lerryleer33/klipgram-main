import { NextRequest, NextResponse } from 'next/server';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { ensureMerged } from '@/lib/youtube-merge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const videoId = searchParams.get('v');
  const forceDownload = searchParams.get('download') === '1';
  const rawFilename = searchParams.get('filename') || 'klipgram-youtube';

  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return NextResponse.json({ error: 'ID video YouTube tidak valid.' }, { status: 400 });
  }

  const filePath = await ensureMerged(videoId);
  if (!filePath) {
    return NextResponse.json(
      { error: 'Gagal menyiapkan berkas video YouTube. Coba lagi nanti.' },
      { status: 502 }
    );
  }

  const info = await stat(filePath).catch(() => null);
  if (!info) {
    return NextResponse.json({ error: 'Berkas video tidak ditemukan.' }, { status: 404 });
  }

  const stream = createReadStream(filePath);
  const headers = new Headers({
    'Content-Type': 'video/mp4',
    'Content-Length': String(info.size),
    'Accept-Ranges': 'none',
    'Cache-Control': 'private, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
  });
  if (forceDownload) {
    const base = rawFilename.replace(/[^a-zA-Z0-9._ -]/g, '').trim() || 'klipgram-youtube';
    headers.set('Content-Disposition', `attachment; filename="${base}.mp4"`);
  }

  return new NextResponse(stream as unknown as ReadableStream, { status: 200, headers });
}
