'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertCircle,
  Disc3,
  Download,
  FileAudio,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Scissors,
  Upload,
  X,
} from 'lucide-react';
import {
  AudioChannelMode,
  AudioSampleRate,
  DecodedAudioAsset,
  decodeAudioFromArrayBuffer,
  decodeAudioFromProxyUrl,
  estimateWavSizeBytes,
  renderTrimmedWavBlob,
} from '@/lib/audio-extractor';
import { formatBytes, formatDuration, sanitizeFilename } from '@/lib/instagram';
import { playRetroClick, playSuccessJingle } from '@/lib/retro-sfx';

interface AudioStudioProps {
  sourceProxyUrl?: string;
  sourceLabel?: string;
  onClose?: () => void;
  showUploadDropzone?: boolean;
  sfxEnabled?: boolean;
}

const SAMPLE_RATES: Array<{ value: AudioSampleRate; label: string }> = [
  { value: 48000, label: '48 kHz Studio' },
  { value: 44100, label: '44.1 kHz Standar' },
  { value: 22050, label: '22 kHz Ringan' },
];

export default function AudioStudio({
  sourceProxyUrl,
  sourceLabel,
  onClose,
  showUploadDropzone = false,
  sfxEnabled = true,
}: AudioStudioProps) {
  const [asset, setAsset] = useState<DecodedAudioAsset | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);

  const [sampleRate, setSampleRate] = useState<AudioSampleRate>(44100);
  const [channelMode, setChannelMode] = useState<AudioChannelMode>('stereo');
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [playheadSec, setPlayheadSec] = useState(0);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const playStartCtxTimeRef = useRef(0);
  const playOffsetRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const stopPlayback = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.onended = null;
        sourceNodeRef.current.stop();
      } catch {
        // already stopped
      }
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, [stopPlayback]);

  // Auto-load when a proxy URL is passed from a fetched Instagram video
  useEffect(() => {
    if (!sourceProxyUrl) return;
    let cancelled = false;

    const run = async () => {
      stopPlayback();
      setError(null);
      setExportDone(false);
      setLoading(true);
      setProgress(10);
      setAsset(null);

      try {
        const decoded = await decodeAudioFromProxyUrl(
          sourceProxyUrl,
          sourceLabel || 'instagram-video',
          (pct) => {
            if (!cancelled) setProgress(pct);
          }
        );
        if (cancelled) return;
        setAsset(decoded);
        setTrimStart(0);
        setTrimEnd(decoded.durationSec);
        setPlayheadSec(0);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Gagal mengekstrak audio dari video tersebut.'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [sourceProxyUrl, sourceLabel, stopPlayback]);

  const handleLocalFile = async (file: File) => {
    if (!file) return;
    if (file.size > 150 * 1024 * 1024) {
      setError('Ukuran berkas melebihi 150 MB. Gunakan video yang lebih ringan.');
      return;
    }
    stopPlayback();
    setError(null);
    setExportDone(false);
    setLoading(true);
    setProgress(30);

    try {
      const ab = await file.arrayBuffer();
      setProgress(75);
      const decoded = await decodeAudioFromArrayBuffer(ab, file.name);
      setProgress(100);
      setAsset(decoded);
      setTrimStart(0);
      setTrimEnd(decoded.durationSec);
      setPlayheadSec(0);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Berkas tidak dapat dibaca sebagai audio/video yang valid.'
      );
    } finally {
      setLoading(false);
    }
  };

  const startPlaybackFrom = useCallback(
    (offsetSec: number) => {
      if (!asset) return;
      stopPlayback();

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      const node = ctx.createBufferSource();
      node.buffer = asset.buffer;
      node.connect(ctx.destination);

      const safeStart = Math.max(trimStart, Math.min(offsetSec, Math.max(trimStart, trimEnd - 0.05)));
      const remaining = Math.max(0.05, trimEnd - safeStart);

      audioCtxRef.current = ctx;
      sourceNodeRef.current = node;
      playStartCtxTimeRef.current = ctx.currentTime;
      playOffsetRef.current = safeStart;

      node.onended = () => {
        setIsPlaying(false);
        setPlayheadSec(trimStart);
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      };

      node.start(0, safeStart, remaining);
      setIsPlaying(true);

      const tick = () => {
        if (!audioCtxRef.current) return;
        const elapsed = audioCtxRef.current.currentTime - playStartCtxTimeRef.current;
        const current = playOffsetRef.current + elapsed;
        if (current >= trimEnd) {
          setPlayheadSec(trimEnd);
          setIsPlaying(false);
          return;
        }
        setPlayheadSec(current);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    [asset, stopPlayback, trimEnd, trimStart]
  );

  const togglePlayback = () => {
    if (!asset) return;
    if (isPlaying) {
      stopPlayback();
    } else {
      const startAt = playheadSec >= trimEnd - 0.1 || playheadSec < trimStart ? trimStart : playheadSec;
      startPlaybackFrom(startAt);
    }
  };

  // Draw crisp retro ink & vermilion canvas waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !asset) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width === 0 || height === 0) return;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const bars = asset.peaks;
    const barCount = bars.length;
    const gap = 2;
    const barWidth = Math.max(2, (width - gap * (barCount - 1)) / barCount);
    const startRatio = asset.durationSec > 0 ? trimStart / asset.durationSec : 0;
    const endRatio = asset.durationSec > 0 ? trimEnd / asset.durationSec : 1;
    const playRatio = asset.durationSec > 0 ? playheadSec / asset.durationSec : 0;

    // Warm mustard trim window highlight
    const trimX = startRatio * width;
    const trimW = Math.max(0, (endRatio - startRatio) * width);
    ctx.fillStyle = 'rgba(229, 169, 59, 0.16)';
    ctx.fillRect(trimX, 0, trimW, height);

    for (let i = 0; i < barCount; i++) {
      const ratio = i / barCount;
      const barH = Math.max(4, bars[i] * (height - 16));
      const x = i * (barWidth + gap);
      const y = (height - barH) / 2;

      if (ratio < startRatio || ratio > endRatio) {
        ctx.fillStyle = '#CFC3AE';
      } else if (ratio <= playRatio) {
        ctx.fillStyle = '#E84A36';
      } else {
        ctx.fillStyle = '#1D1B18';
      }

      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barH, 2);
      ctx.fill();
    }

    // Playhead indicator needle
    const headX = Math.max(1, Math.min(width - 1, playRatio * width));
    ctx.fillStyle = '#E84A36';
    ctx.fillRect(headX - 1, 0, 2, height);
  }, [asset, playheadSec, trimStart, trimEnd]);

  const handleWaveformClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!asset || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const clickRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetSec = clickRatio * asset.durationSec;
    const clamped = Math.max(trimStart, Math.min(trimEnd, targetSec));
    setPlayheadSec(clamped);
    if (isPlaying) {
      startPlaybackFrom(clamped);
    }
  };

  const trimmedDuration = useMemo(() => {
    if (!asset) return 0;
    return Math.max(0.1, trimEnd - trimStart);
  }, [asset, trimEnd, trimStart]);

  const estimatedBytes = useMemo(() => {
    return estimateWavSizeBytes(trimmedDuration, sampleRate, channelMode);
  }, [trimmedDuration, sampleRate, channelMode]);

  const handleDownloadWav = async () => {
    if (!asset) return;
    setExporting(true);
    setExportDone(false);
    setError(null);

    try {
      const wavBlob = await renderTrimmedWavBlob(asset.buffer, {
        startSec: trimStart,
        endSec: trimEnd,
        sampleRate,
        channelMode,
      });
      const baseName = sanitizeFilename(
        asset.sourceName.replace(/\.[^.]+$/, ''),
        'klipgram-audio'
      );
      const url = URL.createObjectURL(wavBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${baseName}-audio.wav`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
      setExportDone(true);
      if (sfxEnabled) playSuccessJingle();
    } catch {
      setError('Gagal merender berkas audio WAV. Coba pilih durasi atau sample rate lain.');
    } finally {
      setExporting(false);
    }
  };

  const reelsSpinning = isPlaying || loading;

  return (
    <div
      id="ekstrak-audio"
      className="rounded-2xl border-2 border-[#1D1B18] bg-[#F4ECDC] p-5 sm:p-6 shadow-[4px_4px_0px_#1D1B18]"
    >
      {/* Cassette Deck Header with Animated Spools */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="hidden sm:flex items-center gap-1.5 rounded-xl border-2 border-[#1D1B18] bg-[#FFFDF7] px-2.5 py-2 shrink-0">
            <motion.div
              animate={reelsSpinning ? { rotate: 360 } : { rotate: 0 }}
              transition={
                reelsSpinning
                  ? { duration: 1.8, repeat: Infinity, ease: 'linear' }
                  : { duration: 0.2 }
              }
            >
              <Disc3 className="h-5 w-5 text-[#2A8C82]" />
            </motion.div>
            <motion.div
              animate={reelsSpinning ? { rotate: 360 } : { rotate: 0 }}
              transition={
                reelsSpinning
                  ? { duration: 1.8, repeat: Infinity, ease: 'linear' }
                  : { duration: 0.2 }
              }
            >
              <Disc3 className="h-5 w-5 text-[#E84A36]" />
            </motion.div>
          </div>

          <div>
            <h3 className="font-display text-lg sm:text-xl font-bold tracking-tight text-[#1D1B18]">
              Dek Kaset Ekstraksi Audio
            </h3>
            <p className="mt-1 text-sm text-[#575047]">
              Pisahkan trek suara jernih dari video Reels, Story, atau berkas video lokal langsung di browser Anda.
            </p>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={() => {
              stopPlayback();
              if (sfxEnabled) playRetroClick();
              onClose();
            }}
            aria-label="Tutup studio audio"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#1D1B18] bg-[#FFFDF7] text-[#1D1B18] shadow-[2px_2px_0px_#1D1B18] transition-transform hover:bg-[#EDE3CE] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none shrink-0 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Upload dropzone when in standalone Audio mode or when no asset loaded */}
      {(showUploadDropzone || (!sourceProxyUrl && !asset && !loading)) && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingFile(true);
          }}
          onDragLeave={() => setIsDraggingFile(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDraggingFile(false);
            const dropped = e.dataTransfer.files?.[0];
            if (dropped) handleLocalFile(dropped);
          }}
          className={`mt-5 flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
            isDraggingFile
              ? 'border-[#2A8C82] bg-[#2A8C82]/10'
              : 'border-[#1D1B18]/45 bg-[#FFFDF7] hover:border-[#1D1B18]'
          }`}
        >
          <Upload className="h-6 w-6 text-[#2A8C82]" />
          <p className="mt-3 text-sm font-semibold text-[#1D1B18]">
            Atau tarik berkas video (MP4, MOV, WEBM) ke sini untuk langsung ekstrak audio
          </p>
          <p className="mt-1 text-xs text-[#575047]">
            Diproses 100% lokal di browser tanpa unggah ke server · Maksimal 150 MB
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,audio/*"
            onChange={(e) => {
              const picked = e.target.files?.[0];
              if (picked) handleLocalFile(picked);
              e.target.value = '';
            }}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => {
              if (sfxEnabled) playRetroClick();
              fileInputRef.current?.click();
            }}
            className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-xl border-2 border-[#1D1B18] bg-[#E5A93B] px-4 text-sm font-bold text-[#1D1B18] shadow-[3px_3px_0px_#1D1B18] transition-transform hover:bg-[#EEB74E] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_#1D1B18] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileAudio className="h-4 w-4" />
            Pilih Berkas Video
          </button>
        </div>
      )}

      {/* Loading progress */}
      {loading && (
        <div className="mt-5 rounded-xl border-2 border-[#1D1B18] bg-[#FFFDF7] p-5">
          <div className="flex items-center justify-between text-sm">
            <span className="inline-flex items-center gap-2 font-semibold text-[#1D1B18]">
              <Loader2 className="h-4 w-4 animate-spin text-[#E84A36]" />
              Mendekode pita audio dari video...
            </span>
            <span className="font-mono text-xs font-semibold tabular-nums text-[#1D1B18]">
              {progress}%
            </span>
          </div>
          <div className="mt-3 h-3 w-full overflow-hidden rounded-lg border-2 border-[#1D1B18] bg-[#F4ECDC]">
            <div
              className="h-full bg-[#2A8C82] transition-transform duration-150 origin-left"
              style={{ transform: `scaleX(${Math.max(0.05, progress / 100)})` }}
            />
          </div>
        </div>
      )}

      {/* Error alert */}
      {error && (
        <div
          role="alert"
          className="mt-5 flex items-start gap-3 rounded-xl border-2 border-[#1D1B18] bg-[#FCE8E6] p-4 text-sm text-[#1D1B18]"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#E84A36]" />
          <p>{error}</p>
        </div>
      )}

      {/* Decoded Waveform & Controls */}
      {asset && !loading && (
        <div className="mt-5 space-y-5">
          {/* Unboxed metadata row */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#575047]">
            <span className="font-bold text-[#1D1B18] truncate max-w-[240px]">
              {asset.sourceName}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              Durasi Asli {formatDuration(asset.durationSec)}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {(asset.sampleRate / 1000).toFixed(1)} kHz
            </span>
            <span aria-hidden="true">·</span>
            <span>{asset.numberOfChannels > 1 ? 'Stereo' : 'Mono'}</span>
          </div>

          {/* Waveform display */}
          <div className="rounded-xl border-2 border-[#1D1B18] bg-[#FFFDF7] p-4 shadow-[3px_3px_0px_#1D1B18]">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={togglePlayback}
                aria-label={isPlaying ? 'Jeda pratinjau audio' : 'Putar pratinjau audio'}
                className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-[#1D1B18] bg-[#2A8C82] text-white shadow-[3px_3px_0px_#1D1B18] transition-transform hover:bg-[#23776E] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_#1D1B18] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E84A36] cursor-pointer"
              >
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
              </button>

              <div className="min-w-0 flex-1">
                <canvas
                  ref={canvasRef}
                  onClick={handleWaveformClick}
                  className="h-20 w-full cursor-pointer block"
                  aria-label="Visualisasi gelombang audio"
                />
                <div className="mt-1.5 flex items-center justify-between font-mono text-xs tabular-nums text-[#575047]">
                  <span className="font-semibold text-[#1D1B18]">{formatDuration(playheadSec)}</span>
                  <span>
                    Potongan: {formatDuration(trimStart)} – {formatDuration(trimEnd)} (
                    {formatDuration(trimmedDuration)})
                  </span>
                </div>
              </div>
            </div>

            {/* Trim sliders */}
            <div className="mt-4 grid grid-cols-1 gap-4 border-t-2 border-[#1D1B18]/10 pt-4 sm:grid-cols-2">
              <label className="block">
                <div className="flex items-center justify-between text-xs text-[#575047]">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-[#1D1B18]">
                    <Scissors className="h-3.5 w-3.5 text-[#E84A36]" />
                    Titik Mulai
                  </span>
                  <span className="font-mono font-semibold tabular-nums text-[#1D1B18]">
                    {formatDuration(trimStart)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0.1, asset.durationSec - 0.2)}
                  step={0.1}
                  value={trimStart}
                  onChange={(e) => {
                    const next = parseFloat(e.target.value);
                    setTrimStart(Math.min(next, trimEnd - 0.2));
                    if (playheadSec < next) setPlayheadSec(next);
                  }}
                  className="mt-2 w-full accent-[#E84A36] cursor-pointer"
                />
              </label>

              <label className="block">
                <div className="flex items-center justify-between text-xs text-[#575047]">
                  <span className="font-semibold text-[#1D1B18]">Titik Selesai</span>
                  <span className="font-mono font-semibold tabular-nums text-[#1D1B18]">
                    {formatDuration(trimEnd)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0.2}
                  max={asset.durationSec}
                  step={0.1}
                  value={trimEnd}
                  onChange={(e) => {
                    const next = parseFloat(e.target.value);
                    setTrimEnd(Math.max(next, trimStart + 0.2));
                    if (playheadSec > next) setPlayheadSec(next);
                  }}
                  className="mt-2 w-full accent-[#E84A36] cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* Export settings + Download button */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <span className="block text-xs font-bold text-[#1D1B18] mb-1.5">
                  Kualitas Audio
                </span>
                <div className="flex flex-wrap items-center gap-1 rounded-xl border-2 border-[#1D1B18] bg-[#EDE3CE] p-1">
                  {SAMPLE_RATES.map((sr) => (
                    <button
                      key={sr.value}
                      type="button"
                      onClick={() => {
                        if (sfxEnabled) playRetroClick();
                        setSampleRate(sr.value);
                      }}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        sampleRate === sr.value
                          ? 'border border-[#1D1B18] bg-[#FFFDF7] text-[#1D1B18] shadow-[1px_1px_0px_#1D1B18]'
                          : 'text-[#575047] hover:text-[#1D1B18]'
                      }`}
                    >
                      {sr.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="block text-xs font-bold text-[#1D1B18] mb-1.5">Saluran</span>
                <div className="flex flex-wrap items-center gap-1 rounded-xl border-2 border-[#1D1B18] bg-[#EDE3CE] p-1">
                  {(['stereo', 'mono'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        if (sfxEnabled) playRetroClick();
                        setChannelMode(mode);
                      }}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        channelMode === mode
                          ? 'border border-[#1D1B18] bg-[#FFFDF7] text-[#1D1B18] shadow-[1px_1px_0px_#1D1B18]'
                          : 'text-[#575047] hover:text-[#1D1B18]'
                      }`}
                    >
                      {mode === 'stereo' ? 'Stereo' : 'Mono'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {(trimStart > 0 || trimEnd < asset.durationSec) && (
                <button
                  type="button"
                  onClick={() => {
                    if (sfxEnabled) playRetroClick();
                    setTrimStart(0);
                    setTrimEnd(asset.durationSec);
                    setPlayheadSec(0);
                  }}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border-2 border-[#1D1B18] bg-[#FFFDF7] px-3.5 text-xs font-bold text-[#1D1B18] shadow-[2px_2px_0px_#1D1B18] transition-transform hover:bg-[#EDE3CE] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset Potongan
                </button>
              )}

              <button
                type="button"
                disabled={exporting}
                onClick={handleDownloadWav}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border-2 border-[#1D1B18] bg-[#E84A36] px-5 text-sm font-bold text-white shadow-[4px_4px_0px_#1D1B18] transition-transform hover:bg-[#D63F2B] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_#1D1B18] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D1B18] focus-visible:ring-offset-2 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {exporting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Merender WAV...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Unduh Audio WAV ({formatBytes(estimatedBytes)})
                  </>
                )}
              </button>
            </div>
          </div>

          {exportDone && (
            <p className="text-xs font-bold text-[#2A8C82]">
              Berkas audio WAV berhasil diekstrak dan mulai diunduh ke perangkat Anda.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
