import { NextRequest, NextResponse } from 'next/server';
import {
  ContentKind,
  InstagramExtractionResult,
  InstagramMediaItem,
  ParsedInstagramTarget,
  validateAllowedMediaUrl,
  validateInstagramUrl,
} from '@/lib/instagram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DESKTOP_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const MOBILE_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const INSTAGRAM_APP_ID = '936619743392459';

const ALLOWED_FETCH_HOSTS = new Set([
  'instagram.com',
  'www.instagram.com',
  'm.instagram.com',
  'instagr.am',
  'i.instagram.com',
]);

async function safeInstagramFetch(
  targetUrl: string,
  extraHeaders: Record<string, string> = {},
  timeoutMs = 12000
): Promise<Response> {
  let currentUrl = targetUrl;

  for (let hop = 0; hop < 4; hop++) {
    const parsed = new URL(currentUrl);
    if (
      parsed.protocol !== 'https:' ||
      parsed.port ||
      parsed.username ||
      parsed.password ||
      !ALLOWED_FETCH_HOSTS.has(parsed.hostname.toLowerCase())
    ) {
      throw new Error('Blocked redirect to non-Instagram host');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const sessionCookie = process.env.INSTAGRAM_SESSION_ID?.trim();

    const headers: Record<string, string> = {
      'User-Agent': DESKTOP_USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
      ...extraHeaders,
    };

    if (sessionCookie) {
      headers.Cookie = `sessionid=${encodeURIComponent(sessionCookie)}`;
    }

    try {
      const response = await fetch(currentUrl, {
        method: 'GET',
        headers,
        redirect: 'manual',
        signal: controller.signal,
        cache: 'no-store',
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) return response;
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }

      return response;
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error('Too many redirects from Instagram');
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\\u0026/g, '&')
    .replace(/\\\//g, '/');
}

function safeMediaUrl(candidate: unknown): string | undefined {
  if (typeof candidate !== 'string' || !candidate) return undefined;
  const decoded = decodeHtmlEntities(candidate.trim());
  const validated = validateAllowedMediaUrl(decoded);
  return validated ? validated.toString() : undefined;
}

function extractShortcodeMediaNode(node: Record<string, unknown>, target: ParsedInstagramTarget, strategy: string): InstagramExtractionResult | null {
  const items: InstagramMediaItem[] = [];
  const sidecar = node.edge_sidecar_to_children as
    | { edges?: Array<{ node?: Record<string, unknown> }> }
    | undefined;

  if (sidecar?.edges && Array.isArray(sidecar.edges) && sidecar.edges.length > 0) {
    sidecar.edges.forEach((edge, idx) => {
      const child = edge?.node;
      if (!child) return;
      const childIsVideo = Boolean(child.is_video) || typeof child.video_duration === 'number';
      const childVideoUrl = childIsVideo ? safeMediaUrl(child.video_url) : undefined;
      // A video whose file URL is missing must not fall back to its thumbnail:
      // skip it; if no usable media remains the caller tries the next strategy.
      if (childIsVideo && !childVideoUrl) return;
      const isVideo = childIsVideo;
      const mediaUrl = isVideo ? childVideoUrl : safeMediaUrl(child.display_url);
      const thumbUrl = safeMediaUrl(child.display_url);
      if (!mediaUrl) return;
      const dims = child.dimensions as { width?: number; height?: number } | undefined;
      items.push({
        id: String(child.id || `${target.shortcode}-${idx + 1}`),
        type: isVideo ? 'video' : 'image',
        url: mediaUrl,
        thumbnailUrl: thumbUrl,
        width: typeof dims?.width === 'number' ? dims.width : undefined,
        height: typeof dims?.height === 'number' ? dims.height : undefined,
        durationSec: typeof child.video_duration === 'number' ? child.video_duration : undefined,
        hasAudio: isVideo ? child.has_audio !== false : false,
      });
    });
  } else {
    const nodeIsVideo = Boolean(node.is_video) || typeof node.video_duration === 'number';
    const nodeVideoUrl = nodeIsVideo ? safeMediaUrl(node.video_url) : undefined;
    // A video whose file URL is missing must not fall back to its thumbnail:
    // return null so the caller tries the next extraction strategy.
    if (nodeIsVideo && !nodeVideoUrl) return null;
    const isVideo = nodeIsVideo;
    const mediaUrl = isVideo ? nodeVideoUrl : safeMediaUrl(node.display_url);
    const thumbUrl = safeMediaUrl(node.display_url);
    if (mediaUrl) {
      const dims = node.dimensions as { width?: number; height?: number } | undefined;
      items.push({
        id: String(node.id || target.shortcode),
        type: isVideo ? 'video' : 'image',
        url: mediaUrl,
        thumbnailUrl: thumbUrl,
        width: typeof dims?.width === 'number' ? dims.width : undefined,
        height: typeof dims?.height === 'number' ? dims.height : undefined,
        durationSec: typeof node.video_duration === 'number' ? node.video_duration : undefined,
        hasAudio: isVideo ? node.has_audio !== false : false,
      });
    }
  }

  if (items.length === 0) return null;

  const owner = node.owner as { username?: string; full_name?: string } | undefined;
  const captionEdges = (
    node.edge_media_to_caption as { edges?: Array<{ node?: { text?: string } }> } | undefined
  )?.edges;
  const caption = captionEdges?.[0]?.node?.text || '';
  const takenAtTimestamp = typeof node.taken_at_timestamp === 'number' ? node.taken_at_timestamp : undefined;

  const detectedKind: ContentKind =
    items.length > 1 ? 'carousel' : target.kind === 'post' && items[0].type === 'video' ? 'reel' : target.kind;

  return {
    shortcode: target.shortcode,
    kind: detectedKind,
    sourceUrl: target.normalizedUrl,
    username: owner?.username || target.username || 'instagram',
    fullName: owner?.full_name || undefined,
    caption,
    takenAt: takenAtTimestamp ? new Date(takenAtTimestamp * 1000).toISOString() : undefined,
    items,
    strategy,
  };
}

function extractJsonStringLiteral(source: string, startQuoteIdx: number): string | null {
  if (startQuoteIdx < 0 || source[startQuoteIdx] !== '"') return null;
  let escaped = false;
  for (let i = startQuoteIdx + 1; i < source.length && i - startQuoteIdx < 600_000; i++) {
    const ch = source[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      return source.slice(startQuoteIdx, i + 1);
    }
  }
  return null;
}

function parseContextJsonFromEmbed(
  html: string,
  target: ParsedInstagramTarget
): InstagramExtractionResult | null {
  const marker = '"contextJSON":';
  let searchFrom = 0;

  while (searchFrom < html.length) {
    const idx = html.indexOf(marker, searchFrom);
    if (idx === -1) break;
    const quoteIdx = html.indexOf('"', idx + marker.length);
    if (quoteIdx === -1) break;

    const literal = extractJsonStringLiteral(html, quoteIdx);
    if (literal) {
      try {
        const innerJsonString = JSON.parse(literal) as unknown;
        if (typeof innerJsonString === 'string') {
          const contextObj = JSON.parse(innerJsonString) as {
            gql_data?: { shortcode_media?: Record<string, unknown> };
            context?: {
              media_id?: string;
              username?: string;
              caption?: string;
              media_type?: number;
            };
          };
          const mediaNode = contextObj.gql_data?.shortcode_media;
          if (mediaNode) {
            const extracted = extractShortcodeMediaNode(mediaNode, target, 'embed-context-json');
            if (extracted) return extracted;
          }
        }
      } catch {
        // continue searching if malformed
      }
    }
    searchFrom = idx + marker.length;
  }

  return null;
}

function extractBalancedJsonObject(source: string, markerIndex: number): string | null {
  const start = source.indexOf('{', markerIndex);
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < source.length && i - start < 400_000; i++) {
    const ch = source[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
    } else {
      if (ch === '"') {
        inString = true;
      } else if (ch === '{') {
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0) {
          return source.slice(start, i + 1);
        }
      }
    }
  }
  return null;
}

async function tryEmbedStrategy(target: ParsedInstagramTarget): Promise<InstagramExtractionResult | null> {
  if (target.kind === 'story' || target.kind === 'highlight') return null;

  const primarySegment = target.kind === 'reel' ? 'reel' : target.kind === 'tv' ? 'tv' : 'p';
  const candidatePaths = [
    `https://www.instagram.com/${primarySegment}/${target.shortcode}/embed/captioned/`,
    `https://www.instagram.com/${primarySegment}/${target.shortcode}/embed/`,
  ];
  if (primarySegment !== 'p') {
    candidatePaths.push(`https://www.instagram.com/p/${target.shortcode}/embed/captioned/`);
  }

  for (const embedUrl of candidatePaths) {
    const response = await safeInstagramFetch(embedUrl, {
      'User-Agent': MOBILE_USER_AGENT,
    });
    if (!response.ok) continue;

    const html = await response.text();

    // 1. Primary: parse escaped "contextJSON" containing full gql_data.shortcode_media
    const fromContext = parseContextJsonFromEmbed(html, target);
    if (fromContext) return fromContext;

    // 2. Secondary: direct unescaped shortcode_media object
    const idx = html.indexOf('"shortcode_media":');
    if (idx !== -1) {
      const snippet = extractBalancedJsonObject(html, idx + '"shortcode_media":'.length);
      if (snippet) {
        try {
          const mediaNode = JSON.parse(snippet) as Record<string, unknown>;
          const parsed = extractShortcodeMediaNode(mediaNode, target, 'embed-gql');
          if (parsed) return parsed;
        } catch {
          // continue
        }
      }
    }

    // 3. Fallback: scrape EmbeddedMediaImage only (never static UI sprites or 150x150 avatars).
    // This can only ever produce an image, so skip it for reels/videos — otherwise it
    // would shadow the GraphQL and OpenGraph strategies that can find the real video.
    if (target.kind === 'reel' || target.kind === 'tv') continue;
    const imgMatch = html.match(/class="EmbeddedMediaImage"[^>]*src="([^"]+)"/i);
    const usernameMatch = html.match(/class="UsernameText"[^>]*>([^<]+)</i);
    const captionMatch = html.match(/class="Caption"[^>]*>([\s\S]*?)<\/div>/i);

    const imageUrl = safeMediaUrl(imgMatch?.[1]);
    if (imageUrl && !imageUrl.includes('s150x150')) {
      const cleanCaption = captionMatch?.[1]
        ? decodeHtmlEntities(captionMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
        : '';

      return {
        shortcode: target.shortcode,
        kind: target.kind,
        sourceUrl: target.normalizedUrl,
        username: usernameMatch?.[1]?.trim() || target.username || 'instagram',
        caption: cleanCaption,
        items: [
          {
            id: target.shortcode,
            type: 'image',
            url: imageUrl,
            thumbnailUrl: imageUrl,
            hasAudio: false,
          },
        ],
        strategy: 'embed-html',
      };
    }
  }

  return null;
}

async function tryGraphqlStrategy(target: ParsedInstagramTarget): Promise<InstagramExtractionResult | null> {
  if (target.kind === 'story' || target.kind === 'highlight') return null;

  const variables = JSON.stringify({
    shortcode: target.shortcode,
    fetch_tagged_user_count: null,
    hoisted_comment_id: null,
    hoisted_reply_id: null,
  });

  const graphqlUrl = `https://www.instagram.com/graphql/query/?doc_id=8845758582119845&variables=${encodeURIComponent(
    variables
  )}`;

  const response = await safeInstagramFetch(graphqlUrl, {
    Accept: 'application/json',
    'X-IG-App-ID': INSTAGRAM_APP_ID,
    'X-Requested-With': 'XMLHttpRequest',
    Referer: target.normalizedUrl,
  });

  if (!response.ok) return null;
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('json')) return null;

  try {
    const json = (await response.json()) as {
      data?: { xdt_shortcode_media?: Record<string, unknown>; shortcode_media?: Record<string, unknown> };
    };
    const mediaNode = json.data?.xdt_shortcode_media || json.data?.shortcode_media;
    if (!mediaNode) return null;
    return extractShortcodeMediaNode(mediaNode, target, 'graphql');
  } catch {
    return null;
  }
}

async function tryOpenGraphStrategy(target: ParsedInstagramTarget): Promise<InstagramExtractionResult | null> {
  const response = await safeInstagramFetch(target.normalizedUrl, {
    'User-Agent': 'WhatsApp/2.23.20.0',
  });
  if (!response.ok) return null;

  const html = await response.text();

  const readMeta = (prop: string): string | undefined => {
    const regex = new RegExp(
      `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`,
      'i'
    );
    const reverseRegex = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`,
      'i'
    );
    return html.match(regex)?.[1] || html.match(reverseRegex)?.[1];
  };

  const videoUrl = safeMediaUrl(readMeta('og:video') || readMeta('og:video:secure_url'));
  const imageUrl = safeMediaUrl(readMeta('og:image') || readMeta('twitter:image'));

  // A reel/tv URL is a video by definition: an image-only OpenGraph result would
  // present the video's thumbnail as a downloadable photo, so refuse it instead.
  if (!videoUrl && (target.kind === 'reel' || target.kind === 'tv')) return null;

  if (!videoUrl && !imageUrl) return null;

  const ogTitle = decodeHtmlEntities(readMeta('og:title') || '');
  const ogDesc = decodeHtmlEntities(readMeta('og:description') || '');
  const userFromTitle = ogTitle.match(/@([a-zA-Z0-9._]+)/)?.[1] || ogTitle.split(' on Instagram')[0]?.trim();

  return {
    shortcode: target.shortcode,
    kind: videoUrl && target.kind === 'post' ? 'reel' : target.kind,
    sourceUrl: target.normalizedUrl,
    username: userFromTitle && userFromTitle.length < 40 ? userFromTitle : target.username || 'instagram',
    caption: ogDesc,
    items: [
      {
        id: target.shortcode,
        type: videoUrl ? 'video' : 'image',
        url: videoUrl || imageUrl!,
        thumbnailUrl: imageUrl,
        hasAudio: Boolean(videoUrl),
      },
    ],
    strategy: 'opengraph',
  };
}

async function tryStoryStrategy(target: ParsedInstagramTarget): Promise<InstagramExtractionResult | null> {
  if (target.kind !== 'story' && target.kind !== 'highlight') return null;

  // Attempt 1: If server has optional INSTAGRAM_SESSION_ID configured, query official web API for stories
  if (process.env.INSTAGRAM_SESSION_ID?.trim() && target.username) {
    try {
      const profileRes = await safeInstagramFetch(
        `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(target.username)}`,
        {
          Accept: 'application/json',
          'X-IG-App-ID': INSTAGRAM_APP_ID,
          'X-Requested-With': 'XMLHttpRequest',
        }
      );

      if (profileRes.ok) {
        const profileJson = (await profileRes.json()) as {
          data?: { user?: { id?: string; full_name?: string } };
        };
        const userId = profileJson.data?.user?.id;
        if (userId) {
          const reelsRes = await safeInstagramFetch(
            `https://www.instagram.com/api/v1/feed/reels_media/?reel_ids=${encodeURIComponent(userId)}`,
            {
              Accept: 'application/json',
              'X-IG-App-ID': INSTAGRAM_APP_ID,
              'X-Requested-With': 'XMLHttpRequest',
            }
          );

          if (reelsRes.ok) {
            const reelsJson = (await reelsRes.json()) as {
              reels_media?: Array<{
                items?: Array<{
                  pk?: string;
                  id?: string;
                  media_type?: number;
                  taken_at?: number;
                  video_duration?: number;
                  video_versions?: Array<{ url?: string; width?: number; height?: number }>;
                  image_versions2?: { candidates?: Array<{ url?: string; width?: number; height?: number }> };
                }>;
              }>;
            };

            const rawItems = reelsJson.reels_media?.[0]?.items || [];
            const filtered = target.storyId
              ? rawItems.filter((item) => item.pk === target.storyId || item.id?.startsWith(target.storyId!))
              : rawItems;
            const list = filtered.length > 0 ? filtered : rawItems;

            const items: InstagramMediaItem[] = [];
            for (const entry of list) {
              const videoCandidate = entry.video_versions?.[0];
              const imageCandidate = entry.image_versions2?.candidates?.[0];
              const videoUrl = safeMediaUrl(videoCandidate?.url);
              const imageUrl = safeMediaUrl(imageCandidate?.url);

              if (entry.media_type === 2 && videoUrl) {
                items.push({
                  id: String(entry.pk || entry.id || items.length + 1),
                  type: 'video',
                  url: videoUrl,
                  thumbnailUrl: imageUrl,
                  width: videoCandidate?.width,
                  height: videoCandidate?.height,
                  durationSec: entry.video_duration,
                  hasAudio: true,
                });
              } else if (imageUrl) {
                items.push({
                  id: String(entry.pk || entry.id || items.length + 1),
                  type: 'image',
                  url: imageUrl,
                  thumbnailUrl: imageUrl,
                  width: imageCandidate?.width,
                  height: imageCandidate?.height,
                  hasAudio: false,
                });
              }
            }

            if (items.length > 0) {
              return {
                shortcode: target.shortcode,
                kind: 'story',
                sourceUrl: target.normalizedUrl,
                username: target.username,
                fullName: profileJson.data?.user?.full_name,
                caption: `Instagram Story dari @${target.username} (${items.length} media aktif)`,
                items,
                strategy: 'story-session-api',
              };
            }
          }
        }
      }
    } catch {
      // Fall through to OpenGraph check
    }
  }

  // Attempt 2: Public OpenGraph fallback
  return tryOpenGraphStrategy(target);
}

// Last resort for reels/videos: yt-dlp talks to Instagram with browser TLS
// impersonation, which plain server requests cannot do and which Instagram
// requires on this endpoint.
async function tryYtDlpStrategy(target: ParsedInstagramTarget): Promise<InstagramExtractionResult | null> {
  if (target.kind !== 'reel' && target.kind !== 'tv' && target.kind !== 'post') return null;

  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const run = promisify(execFile);

  try {
    const { stdout } = await run('yt-dlp', ['-J', '--no-warnings', target.normalizedUrl], {
      timeout: 20000,
      maxBuffer: 10 * 1024 * 1024,
    });
    const info = JSON.parse(stdout) as {
      id?: string;
      uploader?: string;
      title?: string;
      description?: string;
      duration?: number;
      thumbnail?: string;
      width?: number;
      height?: number;
      formats?: Array<{ url?: string; ext?: string; vcodec?: string | null; acodec?: string | null; width?: number; height?: number; abr?: number }>;
    };

    const formats = (info.formats || []).filter((f) => typeof f.url === 'string');
    // Prefer a progressive mp4 (video+audio); otherwise use the best video-only
    // dash stream and mark audio separately.
    const mp4 = formats.find((f) => f.ext === 'mp4' && f.vcodec !== 'none' && f.acodec !== 'none');
    const videoOnly = [...formats].reverse().find((f) => f.ext === 'mp4' && f.vcodec !== 'none' && f.acodec === 'none');
    const chosen = mp4 || videoOnly;
    if (!chosen?.url) return null;

    return {
      shortcode: target.shortcode,
      kind: target.kind,
      sourceUrl: target.normalizedUrl,
      username: info.uploader || 'instagram',
      caption: info.description || info.title || '(tanpa caption)',
      strategy: 'yt-dlp',
      items: [
        {
          id: info.id || target.shortcode,
          type: 'video',
          url: chosen.url,
          thumbnailUrl: info.thumbnail ? safeMediaUrl(info.thumbnail) : undefined,
          width: chosen.width ?? info.width,
          height: chosen.height ?? info.height,
          durationSec: info.duration,
          hasAudio: Boolean(mp4),
        },
      ],
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
      { error: 'Permintaan tidak valid. Kirim tautan Instagram dalam format JSON.' },
      { status: 400 }
    );
  }

  if (typeof body.url !== 'string') {
    return NextResponse.json(
      { error: 'Tautan Instagram wajib diisi.' },
      { status: 400 }
    );
  }

  const validation = validateInstagramUrl(body.url);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { target } = validation;

  try {
    let result: InstagramExtractionResult | null = null;

    if (target.kind === 'story' || target.kind === 'highlight') {
      result = await tryStoryStrategy(target);
    } else {
      result =
        (await tryEmbedStrategy(target)) ||
        (await tryGraphqlStrategy(target)) ||
        (await tryOpenGraphStrategy(target)) ||
        (await tryYtDlpStrategy(target));
    }

    if (!result) {
      if (target.kind === 'story' || target.kind === 'highlight') {
        return NextResponse.json(
          {
            error:
              'Instagram membatasi akses anonim untuk Story ini atau Story sudah kedaluwarsa (lebih dari 24 jam). Pastikan akun bersifat publik, atau tambahkan variabel server INSTAGRAM_SESSION_ID untuk akses Story penuh.',
            code: 'STORY_AUTH_REQUIRED',
          },
          { status: 422 }
        );
      }

      return NextResponse.json(
        {
          error:
            'Media tidak dapat diambil dari tautan tersebut. Pastikan kiriman atau Reels berasal dari akun Instagram publik, tidak dihapus, dan tidak dibatasi usia.',
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
          'Gagal menghubungi server Instagram saat ini. Coba ulangi beberapa saat lagi atau periksa tautan publik Anda.',
        code: 'UPSTREAM_ERROR',
      },
      { status: 502 }
    );
  }
}
