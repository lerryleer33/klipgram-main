export type ContentKind = 'post' | 'reel' | 'tv' | 'story' | 'highlight' | 'carousel';

export type WorkspaceMode = 'all' | 'media' | 'reels' | 'story' | 'audio';

export interface InstagramMediaItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  durationSec?: number;
  hasAudio?: boolean;
}

export interface InstagramExtractionResult {
  shortcode: string;
  kind: ContentKind;
  sourceUrl: string;
  username: string;
  fullName?: string;
  caption: string;
  takenAt?: string;
  items: InstagramMediaItem[];
  strategy: string;
}

export interface ParsedInstagramTarget {
  normalizedUrl: string;
  kind: ContentKind;
  shortcode: string;
  username?: string;
  storyId?: string;
}

export interface RecentHistoryItem {
  id: string;
  url: string;
  username: string;
  kind: ContentKind;
  itemCount: number;
  hasVideo: boolean;
  captionPreview: string;
  savedAt: string;
}

const ALLOWED_INSTAGRAM_HOSTS = new Set([
  'instagram.com',
  'www.instagram.com',
  'm.instagram.com',
  'instagr.am',
]);

const ALLOWED_MEDIA_CDN_REGEX = /^([a-z0-9-]+\.)+(cdninstagram\.com|fbcdn\.net)$/i;

const IPV4_REGEX = /^\d{1,3}(\.\d{1,3}){3}$/;

export function isPrivateOrIpHost(hostname: string): boolean {
  const lower = hostname.toLowerCase().trim();
  if (!lower) return true;
  if (
    lower === 'localhost' ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal') ||
    lower === 'metadata.google.internal'
  ) {
    return true;
  }
  if (lower.includes(':') || lower.startsWith('[')) {
    return true;
  }
  if (IPV4_REGEX.test(lower)) {
    return true;
  }
  return false;
}

export function validateInstagramUrl(rawInput: string): {
  ok: true;
  target: ParsedInstagramTarget;
} | {
  ok: false;
  error: string;
} {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { ok: false, error: 'Masukkan tautan Instagram publik terlebih dahulu.' };
  }
  if (trimmed.length > 1000) {
    return { ok: false, error: 'Tautan terlalu panjang. Periksa kembali tautan yang Anda salin.' };
  }

  let candidate = trimmed;
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return { ok: false, error: 'Format tautan tidak valid. Pastikan Anda menyalin URL lengkap dari Instagram.' };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, error: 'Hanya protokol HTTPS yang didukung untuk keamanan.' };
  }

  if (parsed.username || parsed.password || parsed.port) {
    return { ok: false, error: 'Tautan mengandung kredensial atau port yang tidak diizinkan.' };
  }

  const host = parsed.hostname.toLowerCase();
  if (isPrivateOrIpHost(host) || !ALLOWED_INSTAGRAM_HOSTS.has(host)) {
    return {
      ok: false,
      error: 'Gunakan tautan resmi dari instagram.com atau instagr.am (Post, Reels, atau Story).',
    };
  }

  const cleanPath = parsed.pathname.replace(/\/+$/, '');
  const segments = cleanPath.split('/').filter(Boolean);

  // Support /stories/highlights/<id>
  if (segments[0] === 'stories' && segments[1] === 'highlights' && segments[2]) {
    const highlightId = segments[2];
    if (!/^[a-zA-Z0-9_-]{3,64}$/.test(highlightId)) {
      return { ok: false, error: 'ID Highlight Instagram tidak valid.' };
    }
    return {
      ok: true,
      target: {
        normalizedUrl: `https://www.instagram.com/stories/highlights/${highlightId}/`,
        kind: 'highlight',
        shortcode: highlightId,
        storyId: highlightId,
      },
    };
  }

  // Support /stories/<username>/<storyId?>
  if (segments[0] === 'stories' && segments[1]) {
    const username = segments[1];
    const storyId = segments[2];
    if (!/^[a-zA-Z0-9._]{1,64}$/.test(username)) {
      return { ok: false, error: 'Nama pengguna pada tautan Story tidak valid.' };
    }
    if (storyId && !/^[0-9]{5,40}$/.test(storyId)) {
      return { ok: false, error: 'ID Story Instagram tidak valid.' };
    }
    return {
      ok: true,
      target: {
        normalizedUrl: storyId
          ? `https://www.instagram.com/stories/${username}/${storyId}/`
          : `https://www.instagram.com/stories/${username}/`,
        kind: 'story',
        shortcode: storyId || username,
        username,
        storyId,
      },
    };
  }

  // Support /<username>/p/<shortcode> or /<username>/reel/<shortcode>
  let typeSegment = segments[0];
  let shortcodeSegment = segments[1];
  let pathUsername: string | undefined;

  if (
    segments.length >= 3 &&
    ['p', 'reel', 'reels', 'tv'].includes(segments[1]) &&
    /^[a-zA-Z0-9._]{1,64}$/.test(segments[0])
  ) {
    pathUsername = segments[0];
    typeSegment = segments[1];
    shortcodeSegment = segments[2];
  }

  if (
    typeSegment &&
    ['p', 'reel', 'reels', 'tv'].includes(typeSegment) &&
    shortcodeSegment &&
    /^[a-zA-Z0-9_-]{5,45}$/.test(shortcodeSegment)
  ) {
    const kind: ContentKind =
      typeSegment === 'reel' || typeSegment === 'reels'
        ? 'reel'
        : typeSegment === 'tv'
          ? 'tv'
          : 'post';
    const canonicalType = kind === 'reel' ? 'reel' : kind === 'tv' ? 'tv' : 'p';
    return {
      ok: true,
      target: {
        normalizedUrl: `https://www.instagram.com/${canonicalType}/${shortcodeSegment}/`,
        kind,
        shortcode: shortcodeSegment,
        username: pathUsername,
      },
    };
  }

  return {
    ok: false,
    error:
      'Tautan harus mengarah ke Post (/p/...), Reels (/reel/...), Video (/tv/...), atau Story (/stories/...).',
  };
}

export function validateAllowedMediaUrl(rawUrl: string): URL | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') return null;
    if (parsed.username || parsed.password || parsed.port) return null;
    const host = parsed.hostname.toLowerCase();
    if (isPrivateOrIpHost(host)) return null;
    if (!ALLOWED_MEDIA_CDN_REGEX.test(host)) return null;
    // Never accept Instagram static UI bundles/sprites as user media
    if (host === 'static.cdninstagram.com' || parsed.pathname.includes('/rsrc.php')) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function sanitizeFilename(rawName: string, fallback = 'klipgram-media'): string {
  const cleaned = rawName
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.{2,}/g, '.')
    .replace(/^[-_.]+/, '')
    .slice(0, 96);
  return cleaned || fallback;
}

export function buildProxyUrl(
  remoteUrl: string,
  options?: { download?: boolean; filename?: string }
): string {
  const params = new URLSearchParams();
  params.set('url', remoteUrl);
  if (options?.download) {
    params.set('download', '1');
  }
  if (options?.filename) {
    params.set('filename', sanitizeFilename(options.filename));
  }
  return `/api/proxy?${params.toString()}`;
}

export function formatDuration(seconds?: number): string {
  if (!seconds || !Number.isFinite(seconds) || seconds < 0) return '00:00';
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function getContentKindLabel(kind: ContentKind): string {
  switch (kind) {
    case 'reel':
      return 'Instagram Reels';
    case 'story':
      return 'Instagram Story';
    case 'highlight':
      return 'Story Highlight';
    case 'carousel':
      return 'Carousel Multi-Media';
    case 'tv':
      return 'Video Instagram';
    case 'post':
    default:
      return 'Kiriman Instagram';
  }
}
