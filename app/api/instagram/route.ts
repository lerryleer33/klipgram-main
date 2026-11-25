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
