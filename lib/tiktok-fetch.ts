import { spawn } from 'node:child_process';
import { stat, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';

// TikTok's CDN (Akamai) 403s plain re-fetches of extracted URLs — signature and
// client fingerprint are validated. yt-dlp with the page URL succeeds, so the
// proxy downloads through it into a temp file and serves that.

const inflight = new Map<string, Promise<string | null>>();

function cachePath(url: string): string {
  const hash = createHash('sha256').update(url).digest('hex').slice(0, 32);
  return path.join(tmpdir(), `klipgram-tt-${hash}.mp4`);
}

async function runDownload(url: string): Promise<string | null> {
  const filePath = cachePath(url);
  const existing = await stat(filePath).catch(() => null);
  if (existing && existing.size > 0) return filePath;

  const { mkdir } = await import('node:fs/promises');
  await mkdir(tmpdir(), { recursive: true });

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      'yt-dlp',
      ['-o', filePath, '--no-warnings', '--no-part', url],
      { stdio: ['ignore', 'ignore', 'pipe'], timeout: 180_000 }
    );
    let stderr = '';
    child.stderr.on('data', (c) => {
      stderr = (stderr + String(c)).slice(-400);
    });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(stderr))));
  });

  const out = await stat(filePath).catch(() => null);
  return out && out.size > 0 ? filePath : null;
}

export function ensureTikTokFile(url: string): Promise<string | null> {
  let job = inflight.get(url);
  if (!job) {
    job = runDownload(url)
      .catch(() => null)
      .finally(() => {
        inflight.delete(url);
      });
    inflight.set(url, job);
  }
  return job;
}
