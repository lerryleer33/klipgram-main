import path from 'node:path';

// yt-dlp reads cookies from a file, so env-provided Netscape cookies.txt text
// (one per platform, e.g. YOUTUBE_COOKIE, TIKTOK_COOKIE) is written to a temp
// file once and passed via --cookies.
const cookieFiles = new Map<string, Promise<string | null>>();

async function cookieFileFor(envName: string): Promise<string | null> {
  let job = cookieFiles.get(envName);
  if (!job) {
    job = (async () => {
      const raw = process.env[envName]?.trim();
      if (!raw) return null;
      const { writeFile, mkdtemp } = await import('node:fs/promises');
      const { tmpdir } = await import('node:os');
      const dir = await mkdtemp(path.join(tmpdir(), 'yt-dlp-cookies-'));
      const file = path.join(dir, 'cookies.txt');
      await writeFile(file, raw.endsWith('\n') ? raw : `${raw}\n`, 'utf8');
      return file;
    })().catch(() => null);
    cookieFiles.set(envName, job);
  }
  return job;
}

export async function ytDlpCookieArgs(envName: string): Promise<string[]> {
  const file = await cookieFileFor(envName);
  return file ? ['--cookies', file] : [];
}
