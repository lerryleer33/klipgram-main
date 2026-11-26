import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'node:child_process';
import {
  InstagramExtractionResult,
  InstagramMediaItem,
  ParsedInstagramTarget,
  validateAllowedMediaUrl,
  validateYouTubeUrl,
} from '@/lib/instagram';
import { ensureMerged, ytDlpArgs } from '@/lib/youtube-merge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface YtDlpFormat {
  url?: string;
  format_id?: string;
  ext?: string;
  protocol?: string;
  vcodec?: string | null;
  acodec?: string | null;
  width?: number;
  height?: number;
  tbr?: number;
}

interface YtDlpInfo {
  id?: string;
  title?: string;
  description?: string;
  uploader?: string;
  channel?: string;
  duration?: number;
  thumbnail?: string;
  width?: number;
  height?: number;
  formats?: YtDlpFormat[];
}

function safeMediaUrl(candidate: unknown): string | undefined {
  if (typeof candidate !== 'string' || !candidate) return undefined;
  const validated = validateAllowedMediaUrl(candidate.trim());
  return validated ? validated.toString() : undefined;
}

export class YtDlpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'YtDlpError';
  }
}

async function fetchInfo(target: ParsedInstagramTarget): Promise<YtDlpInfo> {
  const { promisify } = await import('node:util');
  const run = promisify(execFile);
  try {
    const { stdout } = await run(
      'yt-dlp',
      await ytDlpArgs(['-J', '--remote-components', 'ejs:github', '--no-warnings', target.normalizedUrl]),
      { timeout: 60_000, maxBuffer: 30 * 1024 * 1024 }
    );
    return JSON.parse(stdout) as YtDlpInfo;
  } catch (err) {
    const stderr =
      typeof err === 'object' && err && 'stderr' in err
        ? String((err as { stderr?: unknown }).stderr || '')
        : '';
    const line = stderr
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.startsWith('ERROR:'));
    throw new YtDlpError(line || stderr.slice(0, 300) || 'yt-dlp gagal mengambil info video.');
  }
}

async function tryYtDlp(target: ParsedInstagramTarget): Promise<InstagramExtractionResult> {
  const info = await fetchInfo(target);
  if (!info) throw new YtDlpError('Info video kosong.');

  const thumbnailUrl = safeMediaUrl(info.thumbnail);

  // Prefer a direct progressive MP4 URL when YouTube still serves one. HLS
  // (m3u8) manifests are unusable in the <video> player and get 415 from the
  // proxy, so only plain https progressive streams qualify.
  const progressive = (info.formats || [])
    .filter(
      (f) =>
        f.protocol === 'https' &&
        f.ext === 'mp4' &&
        f.vcodec &&
        f.vcodec !== 'none' &&
        f.acodec &&
        f.acodec !== 'none' &&
        safeMediaUrl(f.url)
    )
    .sort((a, b) => (b.height ?? 0) - (a.height ?? 0) || (b.tbr ?? 0) - (a.tbr ?? 0));

  let itemUrl: string;
  if (progressive.length > 0 && progressive[0].url) {
    itemUrl = safeMediaUrl(progressive[0].url) as string;
  } else {
    // YouTube split HD into separate streams: merge server-side with ffmpeg and
    // serve the cached MP4 through /api/youtube/file.
    itemUrl = `/api/youtube/file?v=${encodeURIComponent(target.shortcode)}`;
    void ensureMerged(target.shortcode);
  }

  const items: InstagramMediaItem[] = [
    {
      id: info.id || target.shortcode,
      type: 'video',
      url: itemUrl,
      thumbnailUrl,
      width: progressive[0]?.width ?? info.width,
      height: progressive[0]?.height ?? info.height,
      durationSec: info.duration,
      hasAudio: true,
    },
  ];

  return {
    shortcode: target.shortcode,
    kind: 'youtube_video',
    sourceUrl: target.normalizedUrl,
    username: (info.channel || info.uploader || 'youtube').replace(/^@/, ''),
    caption: info.description || info.title || '(tanpa caption)',
    strategy: 'yt-dlp',
    items,
  };
}

export async function POST(req: NextRequest) {
  let body: { url?: unknown };
  try {
    body = (await req.json()) as { url?: unknown };
  } catch {
    return NextResponse.json(
      { error: 'Permintaan tidak valid. Kirim tautan YouTube dalam format JSON.' },
      { status: 400 }
    );
  }

  if (typeof body.url !== 'string') {
    return NextResponse.json({ error: 'Tautan YouTube wajib diisi.' }, { status: 400 });
  }

  const validation = validateYouTubeUrl(body.url);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { target } = validation;

  try {
    const result = await tryYtDlp(target);
    return NextResponse.json({ data: result }, { status: 200 });
  } catch (err) {
    const detail = err instanceof YtDlpError ? err.message : '';

    let error =
      'Gagal menghubungi server YouTube saat ini. Coba ulangi beberapa saat lagi atau periksa tautan publik Anda.';
    let code: string = 'UPSTREAM_ERROR';

    if (/confirm you.{0,3}re? not a bot|Sign in to confirm/i.test(detail)) {
      error =
        'YouTube meminta verifikasi "bukan robot" untuk video ini dari server kami. Set variabel lingkungan YOUTUBE_COOKIE (cookies.txt dari browser Anda yang sudah login) untuk melewatinya.';
      code = 'BOT_CHECK';
    } else if (/age|inappropriate/i.test(detail)) {
      error =
        'Video ini memiliki batasan usia dan memerlukan login. Set YOUTUBE_COOKIE (cookies.txt dari akun Anda) untuk mengunduhnya.';
      code = 'AGE_RESTRICTED';
    } else if (/private|unavailable|removed|terminated/i.test(detail)) {
      error =
        'Video tidak dapat diakses: mungkin privat, dihapus, atau berasal dari channel yang dihentikan.';
      code = 'MEDIA_UNAVAILABLE';
    } else if (/members[- ]only|Join this channel/i.test(detail)) {
      error = 'Video ini hanya tersedia untuk member (members-only) channel tersebut.';
      code = 'MEMBERS_ONLY';
    }

    return NextResponse.json(
      { error, code, ...(process.env.NODE_ENV !== 'production' && detail ? { detail } : {}) },
      { status: code === 'MEDIA_UNAVAILABLE' ? 422 : 502 }
    );
  }
}
