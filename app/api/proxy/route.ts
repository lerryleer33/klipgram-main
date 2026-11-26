import { NextRequest, NextResponse } from 'next/server';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { sanitizeFilename, validateAllowedMediaUrl } from '@/lib/instagram';
import { ensureTikTokFile } from '@/lib/tiktok-fetch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_MEDIA_BYTES = 100 * 1024 * 1024; // 100 MB cap

async function fetchAllowedMedia(rawUrl: string, rangeHeader?: string | null): Promise<Response> {
  let currentUrl = rawUrl;

  for (let hop = 0; hop < 4; hop++) {
    const validated = validateAllowedMediaUrl(currentUrl);
    if (!validated) {
      throw new Error('UNTRUSTED_MEDIA_HOST');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 35_000);

    const reqHeaders: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      Accept: '*/*',
    };

    if (rangeHeader && /^bytes=\d*-\d*$/.test(rangeHeader.trim())) {
      reqHeaders.Range = rangeHeader.trim();
    }

    try {
      const response = await fetch(validated.toString(), {
        method: 'GET',
        headers: reqHeaders,
        redirect: 'manual',
        signal: controller.signal,
        cache: 'no-store',
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) return response;
        currentUrl = new URL(location, validated.toString()).toString();
        continue;
      }

      return response;
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error('TOO_MANY_REDIRECTS');
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const targetUrl = searchParams.get('url');
  const forceDownload = searchParams.get('download') === '1';
  const rawFilename = searchParams.get('filename') || 'klipgram-media';
  const incomingRange = forceDownload ? null : req.headers.get('range');

  if (!targetUrl) {
    return NextResponse.json(
      { error: 'URL media tidak valid atau tidak berasal dari CDN Instagram resmi.' },
      { status: 400 }
    );
  }

  // Internal YouTube merge files are produced by this app itself, not a CDN.
  if (targetUrl.startsWith('/api/youtube/file?')) {
    try {
      const upstream = await fetch(new URL(targetUrl, req.url).toString(), {
        headers: incomingRange ? { Range: incomingRange } : undefined,
        cache: 'no-store',
      });
      return new NextResponse(upstream.body, { status: upstream.status, headers: upstream.headers });
    } catch {
      return NextResponse.json(
        { error: 'Gagal mengunduh berkas media dari CDN Instagram.' },
        { status: 502 }
      );
    }
  }

  // TikTok: the UI passes source=<tiktok page url> because raw TikTok CDN URLs
  // 403 on re-fetch (Akamai client fingerprinting); re-derive via yt-dlp instead.
  const sourceUrl = searchParams.get('source');
  if (sourceUrl) {
    const filePath = await ensureTikTokFile(sourceUrl);
    if (!filePath) {
      return NextResponse.json(
        { error: 'Media tidak tersedia atau tautan CDN telah kedaluwarsa.' },
        { status: 502 }
      );
    }
    const info = await stat(filePath).catch(() => null);
    if (!info) {
      return NextResponse.json({ error: 'Berkas media tidak ditemukan.' }, { status: 404 });
    }
    const headers = new Headers({
      'Content-Type': 'video/mp4',
      'Content-Length': String(info.size),
      'Accept-Ranges': 'none',
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    });
    if (forceDownload) {
      const base = rawFilename.replace(/[^a-zA-Z0-9._ -]/g, '').trim() || 'klipgram-tiktok';
      headers.set('Content-Disposition', `attachment; filename="${base}.mp4"`);
    }
    return new NextResponse(createReadStream(filePath) as unknown as ReadableStream, {
      status: 200,
      headers,
    });
  }

  if (!validateAllowedMediaUrl(targetUrl)) {
    return NextResponse.json(
      { error: 'URL media tidak valid atau tidak berasal dari CDN Instagram resmi.' },
      { status: 400 }
    );
  }

  try {
    const upstream = await fetchAllowedMedia(targetUrl, incomingRange);
    if ((!upstream.ok && upstream.status !== 206) || !upstream.body) {
      return NextResponse.json(
        { error: 'Media tidak tersedia atau tautan CDN telah kedaluwarsa.' },
        { status: 502 }
      );
    }

    const contentType = (upstream.headers.get('content-type') || 'application/octet-stream').toLowerCase();
    const isSafeMediaType =
      contentType.startsWith('image/') ||
      contentType.startsWith('video/') ||
      contentType.startsWith('audio/');

    if (!isSafeMediaType) {
      return NextResponse.json(
        { error: 'Tipe berkas dari sumber tidak didukung.' },
        { status: 415 }
      );
    }

    const contentLengthHeader = upstream.headers.get('content-length');
    if (contentLengthHeader) {
      const lengthBytes = parseInt(contentLengthHeader, 10);
      if (Number.isFinite(lengthBytes) && lengthBytes > MAX_MEDIA_BYTES) {
        return NextResponse.json(
          { error: 'Ukuran media melebihi batas maksimal 100 MB.' },
          { status: 413 }
        );
      }
    }

    const ext = contentType.includes('mp4')
      ? 'mp4'
      : contentType.includes('webp')
        ? 'webp'
        : contentType.includes('png')
          ? 'png'
          : contentType.includes('jpeg') || contentType.includes('jpg')
            ? 'jpg'
            : contentType.includes('audio')
              ? 'm4a'
              : 'bin';

    const cleanBase = sanitizeFilename(rawFilename, 'klipgram-media');
    const finalName = cleanBase.includes('.') ? cleanBase : `${cleanBase}.${ext}`;

    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Cache-Control', 'private, max-age=600');
    headers.set('Accept-Ranges', upstream.headers.get('accept-ranges') || 'bytes');
    if (contentLengthHeader) {
      headers.set('Content-Length', contentLengthHeader);
    }
    const contentRange = upstream.headers.get('content-range');
    if (contentRange) {
      headers.set('Content-Range', contentRange);
    }
    if (forceDownload) {
      headers.set('Content-Disposition', `attachment; filename="${finalName}"`);
    }

    return new NextResponse(upstream.body, {
      status: upstream.status === 206 ? 206 : 200,
      headers,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (message === 'UNTRUSTED_MEDIA_HOST') {
      return NextResponse.json({ error: 'Host media tidak diizinkan.' }, { status: 403 });
    }
    return NextResponse.json(
      { error: 'Gagal mengunduh berkas media dari CDN Instagram.' },
      { status: 502 }
    );
  }
}
