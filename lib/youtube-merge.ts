import { execFile } from 'node:child_process';
import { stat, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

// One merge job per video id; concurrent requests share the same promise.
const mergeJobs = new Map<string, Promise<string | null>>();

// Optional YouTube cookies (Netscape cookies.txt format) to pass YouTube's
// "confirm you're not a bot" check on datacenter IPs. Set as env YOUTUBE_COOKIE.
export async function ytDlpArgs(extra: string[]): Promise<string[]> {
  const { ytDlpCookieArgs } = await import('./cookies');
  return [...(await ytDlpCookieArgs('YOUTUBE_COOKIE')), ...extra];
}

export function mergedFilePath(videoId: string): string {
  return path.join(tmpdir(), `klipgram-yt-${videoId.replace(/[^a-zA-Z0-9_-]/g, '')}.mp4`);
}

async function runMerge(videoId: string): Promise<string | null> {
  const existing = await stat(mergedFilePath(videoId)).catch(() => null);
  if (existing && existing.size > 0) return mergedFilePath(videoId);

  const { promisify } = await import('node:util');
  const run = promisify(execFile);
  await mkdir(tmpdir(), { recursive: true });

  await run(
    'yt-dlp',
    [
      ...(await ytDlpArgs([
        '--remote-components',
        'ejs:github',
        '--no-warnings',
        '-f',
        'bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b',
        '--merge-output-format',
        'mp4',
        '-o',
        mergedFilePath(videoId),
        `https://www.youtube.com/watch?v=${videoId}`,
      ])),
    ],
    { timeout: 300_000, maxBuffer: 10 * 1024 * 1024 }
  );

  const out = await stat(mergedFilePath(videoId)).catch(() => null);
  return out && out.size > 0 ? mergedFilePath(videoId) : null;
}

export function ensureMerged(videoId: string): Promise<string | null> {
  let job = mergeJobs.get(videoId);
  if (!job) {
    job = runMerge(videoId)
      .catch(() => null)
      .finally(() => {
        mergeJobs.delete(videoId);
      });
    mergeJobs.set(videoId, job);
  }
  return job;
}
