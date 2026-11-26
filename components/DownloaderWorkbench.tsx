'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  Copy,
  Download,
  Film,
  History,
  Image as ImageIcon,
  Layers,
  Loader2,
  Music,
  Trash2,
  X,
} from 'lucide-react';

// Brand marks of the supported platforms (Simple Icons, loaded as inline SVG).
const PLATFORM_ICONS = {
  instagram: '/icons/simple-icons-instagram-1d1b18.svg',
  tiktok: '/icons/simple-icons-tiktok-1d1b18.svg',
  youtube: '/icons/simple-icons-youtube-1d1b18.svg',
} as const;

const SUPPORTED_PLATFORMS: Array<{
  key: keyof typeof PLATFORM_ICONS;
  name: string;
  formats: string;
  detect: (url: string) => boolean;
}> = [
  {
    key: 'instagram',
    name: 'Instagram',
    formats: 'Post · Reels · Story · IGTV',
    detect: (u) => /instagram\.com/i.test(u),
  },
  {
    key: 'tiktok',
    name: 'TikTok',
    formats: 'Video · Foto · vm/vt link',
    detect: (u) => /(^|\.)(tiktok\.com)/i.test(u),
  },
  {
    key: 'youtube',
    name: 'YouTube',
    formats: 'Video · Shorts · youtu.be',
    detect: (u) => /(^|\.)(youtube\.com|youtu\.be)/i.test(u),
  },
];
import {
  InstagramExtractionResult,
  RecentHistoryItem,
  WorkspaceMode,
  buildProxyUrl,
  formatDuration,
  getContentKindLabel,
  sanitizeFilename,
  validateInstagramUrl,
  validateTikTokUrl,
  validateYouTubeUrl,
} from '@/lib/instagram';
import { playRetroClick, playSuccessJingle } from '@/lib/retro-sfx';
import AudioStudio from './AudioStudio';
import RetroMascot, { MascotMood } from './RetroMascot';

const HISTORY_STORAGE_KEY = 'klipgram_recent_history_v1';
const HISTORY_EVENT = 'klipgram:history-updated';
const EMPTY_HISTORY: RecentHistoryItem[] = [];

let cachedHistoryRaw: string | null = null;
let cachedHistoryParsed: RecentHistoryItem[] = EMPTY_HISTORY;

function readHistorySnapshot(): RecentHistoryItem[] {
  if (typeof window === 'undefined') return EMPTY_HISTORY;
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (raw === cachedHistoryRaw) return cachedHistoryParsed;
    cachedHistoryRaw = raw;
    if (!raw) {
      cachedHistoryParsed = EMPTY_HISTORY;
      return EMPTY_HISTORY;
    }
    const parsed = JSON.parse(raw) as RecentHistoryItem[];
    cachedHistoryParsed = Array.isArray(parsed) ? parsed.slice(0, 6) : EMPTY_HISTORY;
    return cachedHistoryParsed;
  } catch {
    return EMPTY_HISTORY;
  }
}

function subscribeHistory(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const handler = () => onStoreChange();
  window.addEventListener('storage', handler);
  window.addEventListener(HISTORY_EVENT, handler);
  return () => {
    window.removeEventListener('storage', handler);
    window.removeEventListener(HISTORY_EVENT, handler);
  };
}

function writeHistoryStore(next: RecentHistoryItem[]) {
  try {
    const serialized = JSON.stringify(next.slice(0, 6));
    window.localStorage.setItem(HISTORY_STORAGE_KEY, serialized);
    cachedHistoryRaw = serialized;
    cachedHistoryParsed = next.slice(0, 6);
    window.dispatchEvent(new CustomEvent(HISTORY_EVENT));
  } catch {
    // ignore storage quota errors
  }
}

const MODE_TABS: Array<{
  id: WorkspaceMode;
  label: string;
  placeholder: string;
  hint: string;
}> = [
  {
    id: 'all',
    label: 'Semua Tautan',
    placeholder: 'Tempel tautan publik Instagram, TikTok, atau YouTube (Post, Reels, Story, Video)...',
    hint: 'Mendukung instagram.com/p/..., /reel/..., /stories/..., tiktok.com/@akun/video/..., vm.tiktok.com/..., serta youtube.com/watch?v=..., /shorts/... dan youtu.be/...',
  },
  {
    id: 'media',
    label: 'Foto & Video',
    placeholder: 'https://www.instagram.com/p/Cxxxxxxxxxx/',
    hint: 'Unduh foto tunggal, video kiriman, atau seluruh slide carousel dalam resolusi asli.',
  },
  {
    id: 'reels',
    label: 'Reels',
    placeholder: 'https://www.instagram.com/reels/Da277POJ5pA/',
    hint: 'Simpan video Instagram Reels HD tanpa watermark atau pisahkan audionya.',
  },
  {
    id: 'story',
    label: 'Story',
    placeholder: 'https://www.instagram.com/stories/namapengguna/34xxxxxxxxx/',
    hint: 'Ambil foto atau video dari Instagram Story akun publik yang masih aktif.',
  },
  {
    id: 'audio',
    label: 'Ekstrak Audio',
    placeholder: 'Tempel tautan Reels/Video Instagram untuk ekstrak audio...',
    hint: 'Ekstrak suara jernih (WAV) dari tautan Reels/Video Instagram atau dari berkas video lokal.',
  },
];

export default function DownloaderWorkbench() {
  const [mode, setMode] = useState<WorkspaceMode>('all');
  const [urlInput, setUrlInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clipboardNotice, setClipboardNotice] = useState<string | null>(null);
  const [sfxEnabled, setSfxEnabled] = useState(true);

  const [result, setResult] = useState<InstagramExtractionResult | null>(null);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [failedPreviewIds, setFailedPreviewIds] = useState<Record<string, boolean>>({});
  const [copiedCaption, setCopiedCaption] = useState(false);

  const [audioTarget, setAudioTarget] = useState<{ proxyUrl: string; label: string } | null>(null);
  const history = useSyncExternalStore(
    subscribeHistory,
    readHistorySnapshot,
    () => EMPTY_HISTORY
  );

  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onFocus = () => inputRef.current?.focus();
    const onOpenAudio = () => {
      setMode('audio');
      const el = document.getElementById('unduh-media');
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    window.addEventListener('klipgram:focus-input', onFocus);
    window.addEventListener('klipgram:open-audio-tab', onOpenAudio);
    return () => {
      window.removeEventListener('klipgram:focus-input', onFocus);
      window.removeEventListener('klipgram:open-audio-tab', onOpenAudio);
    };
  }, []);

  const persistHistory = useCallback((next: RecentHistoryItem[]) => {
    writeHistoryStore(next);
  }, []);

  const currentTab = useMemo(
    () => MODE_TABS.find((t) => t.id === mode) || MODE_TABS[0],
    [mode]
  );

  const detectedLinkInfo = useMemo(() => {
    if (!urlInput.trim()) return null;
    const ig = validateInstagramUrl(urlInput);
    if (ig.ok) return ig.target;
    const tiktok = validateTikTokUrl(urlInput);
    if (tiktok.ok) return tiktok.target;
    const youtube = validateYouTubeUrl(urlInput);
    if (youtube.ok) return youtube.target;
    return null;
  }, [urlInput]);

  // Compute live reactive mood for Klipi mascot
  const mascotMood: MascotMood = useMemo(() => {
    if (loading) return 'loading';
    if (error) return 'error';
    if (audioTarget || mode === 'audio') return 'audio';
    if (result) return 'success';
    if (detectedLinkInfo) return 'typing';
    return 'idle';
  }, [loading, error, audioTarget, mode, result, detectedLinkInfo]);

  const fetchMediaFromUrl = useCallback(
    async (rawUrl: string, autoExtractAudio = false) => {
      const ig = validateInstagramUrl(rawUrl);
      const tiktok = ig.ok ? null : validateTikTokUrl(rawUrl);
      const youtube = ig.ok || tiktok?.ok ? null : validateYouTubeUrl(rawUrl);
      const validation = ig.ok ? ig : tiktok?.ok ? tiktok : youtube;
      if (!validation || !validation.ok) {
        setError(validation ? validation.error : 'Tautan tidak valid.');
        return;
      }

      if (sfxEnabled) playRetroClick();
      setError(null);
      setClipboardNotice(null);
      setLoading(true);
      setResult(null);
      setActiveSlideIndex(0);
      setFailedPreviewIds({});
      setAudioTarget(null);

      const endpoint = youtube?.ok
        ? '/api/youtube'
        : tiktok?.ok
          ? '/api/tiktok'
          : '/api/instagram';

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: rawUrl.trim() }),
        });

        const payload = (await res.json()) as {
          data?: InstagramExtractionResult;
          error?: string;
        };

        if (!res.ok || !payload.data) {
          setError(payload.error || 'Media tidak dapat diambil dari tautan tersebut.');
          return;
        }

        const extracted = payload.data;
        setResult(extracted);
        if (sfxEnabled) playSuccessJingle();

        const entry: RecentHistoryItem = {
          id: `${extracted.shortcode}-${Date.now()}`,
          url: extracted.sourceUrl,
          username: extracted.username,
          kind: extracted.kind,
          itemCount: extracted.items.length,
          hasVideo: extracted.items.some((i) => i.type === 'video'),
          captionPreview: extracted.caption
            ? extracted.caption.slice(0, 72)
            : `${getContentKindLabel(extracted.kind)} · @${extracted.username}`,
          savedAt: new Date().toISOString(),
        };

        const prev = readHistorySnapshot();
        const deduped = prev.filter((item) => item.url !== entry.url);
        writeHistoryStore([entry, ...deduped].slice(0, 6));

        if (autoExtractAudio) {
          const firstVideo = extracted.items.find((item) => item.type === 'video');
          if (firstVideo) {
            setAudioTarget({
              proxyUrl: buildProxyUrl(firstVideo.url, { source: extracted.sourceUrlForProxy }),
              label: `${extracted.username}-${extracted.shortcode}`,
            });
          } else {
            setError('Kiriman ini hanya berisi foto sehingga tidak memiliki trek audio untuk diekstrak.');
          }
        }
      } catch {
        setError('Koneksi ke server terputus. Periksa jaringan internet Anda lalu coba lagi.');
      } finally {
        setLoading(false);
      }
    },
    [sfxEnabled]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetchMediaFromUrl(urlInput, mode === 'audio');
  };

  const handlePasteClipboard = async () => {
    if (sfxEnabled) playRetroClick();
    setClipboardNotice(null);
    try {
      if (!navigator.clipboard?.readText) {
        setClipboardNotice('Gunakan Ctrl+V atau tekan tahan untuk menempel tautan.');
        inputRef.current?.focus();
        return;
      }
      const text = await navigator.clipboard.readText();
      if (text.trim()) {
        setUrlInput(text.trim());
        setError(null);
        inputRef.current?.focus();
      } else {
        setClipboardNotice('Clipboard kosong. Salin tautan Instagram terlebih dahulu.');
      }
    } catch {
      setClipboardNotice('Izin clipboard diblokir browser. Tekan Ctrl+V langsung pada kolom tautan.');
      inputRef.current?.focus();
    }
  };

  const activeItem = result?.items[activeSlideIndex] || null;
  const isTikTokResult = result?.kind === 'tiktok_video' || result?.kind === 'tiktok_photo';
  const proxySource = result?.sourceUrlForProxy;

  const buildItemProxyUrl = (remoteUrl: string, opts?: { download?: boolean; filename?: string }) =>
    buildProxyUrl(remoteUrl, {
      ...opts,
      source: proxySource,
    });

  const triggerDownload = (remoteUrl: string, filename: string) => {
    if (sfxEnabled) playRetroClick();
    const href = buildItemProxyUrl(remoteUrl, { download: true, filename });
    const a = document.createElement('a');
    a.href = href;
    a.download = sanitizeFilename(filename);
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleDownloadAllSlides = () => {
    if (!result) return;
    result.items.forEach((item, index) => {
      window.setTimeout(() => {
        const ext = item.type === 'video' ? 'mp4' : 'jpg';
        triggerDownload(
          item.url,
          `klipgram-${result.username}-${result.shortcode}-slide${index + 1}.${ext}`
        );
      }, index * 450);
    });
  };

  const handleCopyCaption = async () => {
    if (!result?.caption) return;
    try {
      await navigator.clipboard.writeText(result.caption);
      if (sfxEnabled) playRetroClick();
      setCopiedCaption(true);
      window.setTimeout(() => setCopiedCaption(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <section
      id="unduh-media"
      className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-10 pb-16 sm:pt-14 sm:pb-20"
    >
      {/* Balanced 2-Column Retro Hero with Interactive Mascot Klipi */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-7">
          <p className="text-sm font-bold text-[#2A8C82]">
            Pengunduh Media Instagram &amp; Dek Ekstraksi Audio
          </p>
          <h1
            className="mt-3 font-display font-bold tracking-tight text-[#1D1B18]"
            style={{
              fontSize: 'clamp(2.25rem, 4.3vw, 3.6rem)',
              lineHeight: 1.06,
              textWrap: 'balance',
            }}
          >
            Simpan foto, video, Reels, dan Story dengan sentuhan retro yang cepat.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-[#575047] sm:text-lg">
            Tempel tautan publik Instagram untuk menangkap media beresolusi asli tanpa watermark,
            lalu pisahkan trek audio jernih dari video langsung di dek kaset browser Anda.
          </p>

          {/* Clean unboxed editorial highlights (zero static pills) */}
          <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm font-medium text-[#575047]">
            <span className="text-[#1D1B18] font-semibold">Resolusi Asli HD</span>
            <span aria-hidden="true">·</span>
            <span className="text-[#1D1B18] font-semibold">Reels &amp; Story Publik</span>
            <span aria-hidden="true">·</span>
            <span className="text-[#1D1B18] font-semibold">Ekstrak Audio WAV 48 kHz</span>
          </div>
        </div>

        <div className="lg:col-span-5">
          <RetroMascot
            mood={mascotMood}
            sfxEnabled={sfxEnabled}
            onToggleSfx={() => setSfxEnabled((prev) => !prev)}
          />
        </div>
      </div>

      {/* Primary Interactive Retro Deck Workbench (Single Elevation) */}
      <div className="mt-10 rounded-2xl border-2 border-[#1D1B18] bg-[#FFFDF7] p-5 sm:p-8 shadow-[6px_6px_0px_#1D1B18]">
        {/* Tactile Hardware Mode Keys */}
        <div
          role="tablist"
          aria-label="Pilih mode unduhan"
          className="flex items-center gap-1.5 overflow-x-auto rounded-xl border-2 border-[#1D1B18] bg-[#EDE3CE] p-1.5 w-full sm:w-fit"
        >
          {MODE_TABS.map((tab) => {
            const active = mode === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => {
                  if (sfxEnabled) playRetroClick();
                  setMode(tab.id);
                  setError(null);
                }}
                className={`rounded-lg px-3.5 py-2 text-xs sm:text-sm font-bold transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E84A36] ${
                  active
                    ? 'border-2 border-[#1D1B18] bg-[#FFFDF7] text-[#1D1B18] shadow-[2px_2px_0px_#1D1B18]'
                    : 'border-2 border-transparent text-[#575047] hover:text-[#1D1B18]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Supported platforms */}
        <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="Platform yang didukung">
          {SUPPORTED_PLATFORMS.map((p) => {
            const active = Boolean(urlInput) && p.detect(urlInput);
            return (
              <span
                key={p.key}
                className={`inline-flex items-center gap-2 rounded-full border-2 px-3 py-1.5 text-xs font-bold transition-all duration-150 ${
                  active
                    ? 'border-[#1D1B18] bg-[#FFFDF7] text-[#1D1B18] shadow-[2px_2px_0px_#1D1B18]'
                    : 'border-[#E3D9C6] bg-[#F7F1E3]/60 text-[#867C6E]'
                }`}
                title={p.formats}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- tiny static brand SVG, no optimization needed */}
                <img src={PLATFORM_ICONS[p.key]} alt="" className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {p.name}
                {active && <Check className="h-3.5 w-3.5 text-[#E84A36]" aria-label="didukung" />}
              </span>
            );
          })}
          <span className="text-[11px] text-[#867C6E] ml-1">
            Semua platform di atas didukung — tempel link-nya di bawah.
          </span>
        </div>

        {/* URL Input Bar */}
        <form onSubmit={handleSubmit} className="mt-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                id="klipgram-url-input"
                type="url"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                value={urlInput}
                onChange={(e) => {
                  setUrlInput(e.target.value);
                  if (error) setError(null);
                }}
                placeholder={currentTab.placeholder}
                aria-label="Tautan publik Instagram"
                className="h-13 w-full rounded-xl border-2 border-[#1D1B18] bg-[#F7F1E3]/70 pl-4 pr-26 text-sm sm:text-base font-medium text-[#1D1B18] placeholder:text-[#867C6E] transition-colors focus:bg-[#FFFDF7] focus:outline-none focus:ring-2 focus:ring-[#E84A36]/40"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {urlInput && (
                  <button
                    type="button"
                    onClick={() => {
                      if (sfxEnabled) playRetroClick();
                      setUrlInput('');
                      setError(null);
                      inputRef.current?.focus();
                    }}
                    aria-label="Bersihkan tautan"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#575047] transition-colors hover:bg-[#EDE3CE] hover:text-[#1D1B18] cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={handlePasteClipboard}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border-2 border-[#1D1B18] bg-[#FFFDF7] px-2.5 text-xs font-bold text-[#1D1B18] shadow-[2px_2px_0px_#1D1B18] transition-transform hover:bg-[#EDE3CE] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <ClipboardPaste className="h-3.5 w-3.5" />
                  Tempel
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-13 items-center justify-center gap-2 rounded-xl border-2 border-[#1D1B18] bg-[#E84A36] px-6 text-sm font-bold text-white shadow-[4px_4px_0px_#1D1B18] transition-transform duration-150 hover:bg-[#D63F2B] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_#1D1B18] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D1B18] focus-visible:ring-offset-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Memutar Kaset...
                </>
              ) : mode === 'audio' ? (
                <>
                  <Music className="h-4 w-4" />
                  Ambil &amp; Ekstrak Audio
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Ambil Media
                </>
              )}
            </button>
          </div>

          {/* Unboxed helper line */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#575047]">
            <p>
              {detectedLinkInfo ? (
                <span className="text-[#1D1B18]">
                  Terdeteksi:{' '}
                  <strong className="font-bold text-[#2A8C82]">
                    {getContentKindLabel(detectedLinkInfo.kind)}
                  </strong>
                  <span className="mx-1.5" aria-hidden="true">·</span>
                  <span className="font-mono font-semibold">{detectedLinkInfo.shortcode}</span>
                </span>
              ) : (
                currentTab.hint
              )}
            </p>
            {clipboardNotice && (
              <span className="font-medium text-[#1D1B18]">{clipboardNotice}</span>
            )}
          </div>
        </form>

        {/* Error Display */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              key="error-banner"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16 }}
              role="alert"
              className="mt-5 flex items-start gap-3 rounded-xl border-2 border-[#1D1B18] bg-[#FCE8E6] p-4 text-sm text-[#1D1B18]"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#E84A36]" />
              <div className="space-y-1">
                <p className="font-bold">Gagal mengambil media</p>
                <p className="text-[#575047] leading-relaxed">{error}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading Skeleton */}
        {loading && (
          <div className="mt-6 grid grid-cols-1 gap-6 border-t-2 border-[#1D1B18]/15 pt-6 lg:grid-cols-12">
            <div className="lg:col-span-7 aspect-video rounded-xl border-2 border-[#1D1B18]/20 bg-[#EDE3CE] animate-pulse" />
            <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="h-4 w-40 rounded bg-[#EDE3CE] animate-pulse" />
                <div className="h-3 w-full rounded bg-[#F4ECDC] animate-pulse" />
                <div className="h-3 w-4/5 rounded bg-[#F4ECDC] animate-pulse" />
              </div>
              <div className="space-y-2.5">
                <div className="h-11 w-full rounded-xl bg-[#EDE3CE] animate-pulse" />
                <div className="h-11 w-full rounded-xl bg-[#F4ECDC] animate-pulse" />
              </div>
            </div>
          </div>
        )}

        {/* Extracted Media Showcase (Retro CRT Monitor + Polaroid Details) */}
        <AnimatePresence mode="wait">
          {result && activeItem && !loading && (
            <motion.div
              key={result.shortcode}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="mt-6 border-t-2 border-[#1D1B18]/15 pt-6"
            >
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-stretch">
                {/* Media Preview CRT Bezel Column */}
                <div className="lg:col-span-7 flex flex-col gap-3">
                  <div className="relative flex min-h-[300px] max-h-[520px] items-center justify-center overflow-hidden rounded-2xl border-2 border-[#1D1B18] bg-[#1D1B18] p-2 shadow-[4px_4px_0px_#1D1B18]">
                    {activeItem.type === 'video' ? (
                      <video
                        key={activeItem.id}
                        controls
                        playsInline
                        preload="metadata"
                        poster={
                          activeItem.thumbnailUrl
                            ? buildItemProxyUrl(activeItem.thumbnailUrl)
                            : undefined
                        }
                        src={buildItemProxyUrl(activeItem.url)}
                        className="max-h-[496px] w-full rounded-xl object-contain"
                      />
                    ) : failedPreviewIds[activeItem.id] ? (
                      <div className="flex flex-col items-center justify-center gap-2 p-10 text-center text-[#EDE3CE]">
                        <ImageIcon className="h-8 w-8 text-[#E5A93B]" />
                        <p className="text-sm font-semibold">Pratinjau foto tidak dapat dimuat</p>
                        <p className="text-xs text-[#CFC3AE]">
                          Anda tetap dapat mengunduh berkas asli melalui tombol Unduh Foto HD.
                        </p>
                      </div>
                    ) : (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={buildItemProxyUrl(activeItem.url)}
                        alt={`Media Instagram dari @${result.username}`}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setFailedPreviewIds((prev) => ({ ...prev, [activeItem.id]: true }))
                        }
                        className="max-h-[496px] w-full rounded-xl object-contain"
                      />
                    )}

                    {/* Carousel Navigation Overlay */}
                    {result.items.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            if (sfxEnabled) playRetroClick();
                            setActiveSlideIndex((i) =>
                              i === 0 ? result.items.length - 1 : i - 1
                            );
                          }}
                          aria-label="Slide sebelumnya"
                          className="absolute left-4 top-1/2 -translate-y-1/2 inline-flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#1D1B18] bg-[#FFFDF7] text-[#1D1B18] shadow-[2px_2px_0px_#1D1B18] transition-transform hover:bg-[#E5A93B] cursor-pointer"
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (sfxEnabled) playRetroClick();
                            setActiveSlideIndex((i) =>
                              i === result.items.length - 1 ? 0 : i + 1
                            );
                          }}
                          aria-label="Slide berikutnya"
                          className="absolute right-4 top-1/2 -translate-y-1/2 inline-flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#1D1B18] bg-[#FFFDF7] text-[#1D1B18] shadow-[2px_2px_0px_#1D1B18] transition-transform hover:bg-[#E5A93B] cursor-pointer"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </button>
                      </>
                    )}
                  </div>

                  {/* Carousel slide selector */}
                  {result.items.length > 1 && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      {result.items.map((item, idx) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            if (sfxEnabled) playRetroClick();
                            setActiveSlideIndex(idx);
                          }}
                          className={`inline-flex h-9 items-center gap-1.5 rounded-xl border-2 border-[#1D1B18] px-3 text-xs font-bold transition-transform whitespace-nowrap shrink-0 cursor-pointer ${
                            idx === activeSlideIndex
                              ? 'bg-[#E5A93B] text-[#1D1B18] shadow-[2px_2px_0px_#1D1B18]'
                              : 'bg-[#FFFDF7] text-[#575047] hover:bg-[#EDE3CE] hover:text-[#1D1B18]'
                          }`}
                        >
                          {item.type === 'video' ? (
                            <Film className="h-3.5 w-3.5" />
                          ) : (
                            <ImageIcon className="h-3.5 w-3.5" />
                          )}
                          <span className="font-mono tabular-nums">Slide {idx + 1}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Details & Download Actions Column */}
                <div className="lg:col-span-5 flex flex-col justify-between gap-6 rounded-2xl border-2 border-[#1D1B18] bg-[#F4ECDC] p-5 shadow-[4px_4px_0px_#1D1B18]">
                  <div className="space-y-4">
                    {/* Unboxed metadata row */}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#575047]">
                      <span className="font-bold text-[#1D1B18]">@{result.username}</span>
                      <span aria-hidden="true">·</span>
                      <span>{getContentKindLabel(result.kind)}</span>
                      {activeItem.width && activeItem.height && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono font-semibold tabular-nums text-[#1D1B18]">
                            {activeItem.width}×{activeItem.height}
                          </span>
                        </>
                      )}
                      {activeItem.durationSec && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono font-semibold tabular-nums text-[#1D1B18]">
                            {formatDuration(activeItem.durationSec)}
                          </span>
                        </>
                      )}
                    </div>

                    <div>
                      <h2 className="font-display text-xl font-bold text-[#1D1B18]">
                        {activeItem.type === 'video'
                          ? 'Video Siap Diunduh'
                          : 'Foto Resolusi Asli Siap Diunduh'}
                      </h2>
                      {result.caption ? (
                        <p className="mt-2 max-h-40 overflow-y-auto text-sm leading-relaxed text-[#575047] whitespace-pre-line">
                          {result.caption}
                        </p>
                      ) : (
                        <p className="mt-2 text-sm text-[#575047]">
                          Tidak ada keterangan teks pada kiriman ini.
                        </p>
                      )}
                    </div>

                    {result.caption && (
                      <button
                        type="button"
                        onClick={handleCopyCaption}
                        className="inline-flex h-9 items-center gap-1.5 text-xs font-bold text-[#1D1B18] hover:text-[#2A8C82] transition-colors cursor-pointer"
                      >
                        {copiedCaption ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-[#2A8C82]" />
                            Caption tersalin
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            Salin caption
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Tactile Retro Action Buttons */}
                  <div className="space-y-3 border-t-2 border-[#1D1B18]/15 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        const ext = activeItem.type === 'video' ? 'mp4' : 'jpg';
                        triggerDownload(
                          activeItem.url,
                          `klipgram-${result.username}-${result.shortcode}-${activeSlideIndex + 1}.${ext}`
                        );
                      }}
                      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-[#1D1B18] bg-[#E84A36] px-4 text-sm font-bold text-white shadow-[4px_4px_0px_#1D1B18] transition-transform hover:bg-[#D63F2B] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_#1D1B18] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D1B18] whitespace-nowrap cursor-pointer"
                    >
                      <Download className="h-4 w-4" />
                      {activeItem.type === 'video'
                        ? result.items.length > 1
                          ? `Unduh Video Slide ${activeSlideIndex + 1} (MP4)`
                          : 'Unduh Video HD (MP4)'
                        : result.items.length > 1
                          ? `Unduh Foto Slide ${activeSlideIndex + 1} (HD)`
                          : 'Unduh Foto Resolusi Asli'}
                    </button>

                    {activeItem.type === 'video' && (
                      <button
                        type="button"
                        onClick={() => {
                          if (sfxEnabled) playRetroClick();
                          setAudioTarget({
                            proxyUrl: buildItemProxyUrl(activeItem.url),
                            label: `${result.username}-${result.shortcode}`,
                          });
                        }}
                        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-[#1D1B18] bg-[#2A8C82] px-4 text-sm font-bold text-white shadow-[3px_3px_0px_#1D1B18] transition-transform hover:bg-[#23776E] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_#1D1B18] whitespace-nowrap cursor-pointer"
                      >
                        <Music className="h-4 w-4" />
                        Ekstrak Audio dari Video Ini
                      </button>
                    )}

                    {result.items.length > 1 && (
                      <button
                        type="button"
                        onClick={handleDownloadAllSlides}
                        className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border-2 border-[#1D1B18] bg-[#FFFDF7] px-4 text-xs font-bold text-[#1D1B18] shadow-[2px_2px_0px_#1D1B18] transition-transform hover:bg-[#EDE3CE] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none whitespace-nowrap cursor-pointer"
                      >
                        <Layers className="h-3.5 w-3.5" />
                        Unduh Semua {result.items.length} Slide Sekaligus
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Integrated Audio Studio */}
        {(audioTarget || mode === 'audio') && (
          <div className="mt-6 border-t-2 border-[#1D1B18]/15 pt-6">
            <AudioStudio
              sourceProxyUrl={audioTarget?.proxyUrl}
              sourceLabel={audioTarget?.label}
              showUploadDropzone={mode === 'audio' && !audioTarget}
              sfxEnabled={sfxEnabled}
              onClose={audioTarget ? () => setAudioTarget(null) : undefined}
            />
          </div>
        )}
      </div>

      {/* Recent History Archival Index Strip */}
      {history.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="inline-flex items-center gap-2 font-display text-sm font-bold text-[#1D1B18]">
              <History className="h-4 w-4 text-[#2A8C82]" />
              Arsip Tautan Terakhir
            </h2>
            <button
              type="button"
              onClick={() => {
                if (sfxEnabled) playRetroClick();
                persistHistory([]);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#575047] hover:text-[#E84A36] transition-colors cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Hapus Riwayat
            </button>
          </div>

          <div className="mt-3 divide-y-2 divide-[#1D1B18]/15 rounded-2xl border-2 border-[#1D1B18] bg-[#FFFDF7] shadow-[4px_4px_0px_#1D1B18] overflow-hidden">
            {history.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between hover:bg-[#F7F1E3]/60 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 text-xs text-[#575047]">
                    <span className="font-bold text-[#1D1B18]">@{item.username}</span>
                    <span aria-hidden="true">·</span>
                    <span>{getContentKindLabel(item.kind)}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono font-semibold tabular-nums">
                      {item.itemCount} media
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-[#575047]">{item.captionPreview}</p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setUrlInput(item.url);
                    fetchMediaFromUrl(item.url, false);
                  }}
                  className="inline-flex h-9 items-center justify-center rounded-xl border-2 border-[#1D1B18] bg-[#F7F1E3] px-3.5 text-xs font-bold text-[#1D1B18] shadow-[2px_2px_0px_#1D1B18] transition-transform hover:bg-[#E5A93B] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none whitespace-nowrap shrink-0 self-start sm:self-center cursor-pointer"
                >
                  Muat Ulang
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
