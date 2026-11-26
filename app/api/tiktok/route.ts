import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'node:child_process';
import {
  InstagramExtractionResult,
  InstagramMediaItem,
  ParsedInstagramTarget,
  validateAllowedMediaUrl,
  validateTikTokUrl,
} from '@/lib/instagram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface YtDlpFormat {
  url?: string;
  ext?: string;
  vcodec?: string | null;
  acodec?: string | null;
  width?: number;
  height?: number;
  abr?: number;
  fps?: number;
}

interface YtDlpEntry {
  id?: string;
  title?: string;
  description?: string;
  uploader?: string;
  duration?: number;
  thumbnail?: string;
  width?: number;
  height?: number;
  ext?: string;
  url?: string;
  formats?: YtDlpFormat[];
  media_type?: string;
}

interface YtDlpInfo extends YtDlpEntry {
  _type?: string;
  entries?: YtDlpEntry[];
}

function safeMediaUrl(candidate: unknown): string | undefined {
  if (typeof candidate !== 'string' || !candidate) return undefined;
  const validated = validateAllowedMediaUrl(candidate.trim());
  return validated ? validated.toString() : undefined;
}

function pickVideoUrl(entry: YtDlpEntry): {
  url: string;
  width?: number;
  height?: number;
  hasAudio: boolean;
} | null {
  const formats = (entry.formats || []).filter((f) => typeof f.url === 'string');
  if (formats.length > 0) {
    const progressive = formats.find(
      (f) => f.ext === 'mp4' && f.vcodec !== 'none' && f.acodec !== 'none'
    );
    if (progressive?.url) {
      return {
        url: progressive.url,
        width: progressive.width ?? entry.width,
        height: progressive.height ?? entry.height,
        hasAudio: true,
      };
    }
    const bestVideoOnly = [...formats]
      .filter((f) => f.ext === 'mp4' && f.vcodec !== 'none')
      .sort(
        (a, b) => (b.height ?? 0) * (b.fps ?? 1) - (a.height ?? 0) * (a.fps ?? 1)
      )[0];
    if (bestVideoOnly?.url) {
      return {
        url: bestVideoOnly.url,
        width: bestVideoOnly.width ?? entry.width,
        height: bestVideoOnly.height ?? entry.height,
        hasAudio: false,
      };
    }
  }

  const direct = safeMediaUrl(entry.url);
  if (direct) {
    return {
      url: direct,
      width: entry.width,
      height: entry.height,
      hasAudio: true,
    };
  }

  return null;
}

function entryToItem(entry: YtDlpEntry, index: number): InstagramMediaItem | null {
  const id = entry.id || `tiktok-${index}`;
  const thumbnailUrl = safeMediaUrl(entry.thumbnail);

  const isImage =
    entry.media_type === 'image' ||
    entry.ext === 'jpeg' ||
    entry.ext === 'jpg' ||
    entry.ext === 'png' ||
    entry.ext === 'webp';

  if (isImage) {
    const url = safeMediaUrl(entry.url);
    if (!url) return null;
    return {
      id,
      type: 'image',
      url,
      thumbnailUrl,
      width: entry.width,
      height: entry.height,
    };
  }

  const picked = pickVideoUrl(entry);
  if (!picked) return null;
  return {
    id,
    type: 'video',
    url: picked.url,
    thumbnailUrl,
    width: picked.width,
    height: picked.height,
    durationSec: entry.duration,
    hasAudio: picked.hasAudio,
  };
}

async function tryYtDlp(target: ParsedInstagramTarget): Promise<InstagramExtractionResult | null> {
  const { promisify } = await import('node:util');
  const run = promisify(execFile);

  try {
    const { stdout } = await run(
      'yt-dlp',
      ['-J', '--no-warnings', target.normalizedUrl],
      { timeout: 25000, maxBuffer: 20 * 1024 * 1024 }
    );
    const info = JSON.parse(stdout) as YtDlpInfo;

    const entries: YtDlpEntry[] =
      info._type === 'playlist' && Array.isArray(info.entries) && info.entries.length > 0
        ? info.entries
        : [info];

    const items: InstagramMediaItem[] = [];
    entries.forEach((entry, index) => {
      const item = entryToItem(entry, index);
      if (item) items.push(item);
    });

    if (items.length === 0) return null;

    const first = items[0];
    return {
      shortcode: target.shortcode,
      kind: first.type === 'image' ? 'tiktok_photo' : 'tiktok_video',
      sourceUrl: target.normalizedUrl,
      username: (info.uploader || 'tiktok').replace(/^@/, ''),
      caption: info.description || info.title || '(tanpa caption)',
      strategy: 'yt-dlp',
      items,
      sourceUrlForProxy: target.normalizedUrl,
    };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  let body: { url?: unknown };
  try {
    body = (await req.json()) as { url?: unknown };
  } catch {
    return NextResponse.json(
      { error: 'Permintaan tidak valid. Kirim tautan TikTok dalam format JSON.' },
      { status: 400 }
    );
  }

  if (typeof body.url !== 'string') {
    return NextResponse.json({ error: 'Tautan TikTok wajib diisi.' }, { status: 400 });
  }

  const validation = validateTikTokUrl(body.url);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { target } = validation;

  try {
    const result = await tryYtDlp(target);

    if (!result) {
      return NextResponse.json(
        {
          error:
            'Media tidak dapat diambil dari tautan tersebut. Pastikan konten TikTok berasal dari akun publik dan tidak dihapus.',
          code: 'MEDIA_UNAVAILABLE',
        },
        { status: 422 }
      );
    }

    return NextResponse.json({ data: result }, { status: 200 });
  } catch {
    return NextResponse.json(
      {
        error:
          'Gagal menghubungi server TikTok saat ini. Coba ulangi beberapa saat lagi atau periksa tautan publik Anda.',
        code: 'UPSTREAM_ERROR',
      },
      { status: 502 }
    );
  }
}
