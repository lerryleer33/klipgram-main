export type AudioSampleRate = 48000 | 44100 | 22050;
export type AudioChannelMode = 'stereo' | 'mono';

export interface DecodedAudioAsset {
  buffer: AudioBuffer;
  durationSec: number;
  sampleRate: number;
  numberOfChannels: number;
  peaks: number[];
  sourceName: string;
}

function getAudioContextCtor(): typeof AudioContext {
  const ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!ctor) {
    throw new Error('Browser Anda belum mendukung Web Audio API untuk ekstraksi audio.');
  }
  return ctor;
}

export function computeWaveformPeaks(audioBuffer: AudioBuffer, bucketCount = 120): number[] {
  const channelData = audioBuffer.getChannelData(0);
  const totalSamples = channelData.length;
  if (totalSamples === 0) return new Array(bucketCount).fill(0.05);

  const samplesPerBucket = Math.max(1, Math.floor(totalSamples / bucketCount));
  const peaks: number[] = [];
  let globalMax = 0.001;

  for (let i = 0; i < bucketCount; i++) {
    const start = i * samplesPerBucket;
    const end = Math.min(totalSamples, start + samplesPerBucket);
    let maxVal = 0;
    const step = Math.max(1, Math.floor((end - start) / 64));
    for (let j = start; j < end; j += step) {
      const abs = Math.abs(channelData[j]);
      if (abs > maxVal) maxVal = abs;
    }
    peaks.push(maxVal);
    if (maxVal > globalMax) globalMax = maxVal;
  }

  return peaks.map((p) => Math.max(0.06, Math.min(1, p / globalMax)));
}

export async function decodeAudioFromArrayBuffer(
  arrayBuffer: ArrayBuffer,
  sourceName: string
): Promise<DecodedAudioAsset> {
  const AudioCtx = getAudioContextCtor();
  const ctx = new AudioCtx();
  try {
    const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const peaks = computeWaveformPeaks(decoded, 128);
    return {
      buffer: decoded,
      durationSec: decoded.duration,
      sampleRate: decoded.sampleRate,
      numberOfChannels: decoded.numberOfChannels,
      peaks,
      sourceName,
    };
  } catch {
    throw new Error(
      'Track audio tidak dapat didekode dari video ini. Pastikan video memiliki suara dan berformat MP4/MOV/WEBM.'
    );
  } finally {
    await ctx.close().catch(() => undefined);
  }
}

export async function decodeAudioFromProxyUrl(
  proxyUrl: string,
  sourceName: string,
  onProgress?: (percent: number) => void
): Promise<DecodedAudioAsset> {
  const response = await fetch(proxyUrl);
  if (!response.ok) {
    throw new Error('Gagal mengambil aliran video dari server untuk diekstrak audionya.');
  }

  const contentLengthHeader = response.headers.get('content-length');
  const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;

  if (!response.body || !totalBytes) {
    onProgress?.(45);
    const ab = await response.arrayBuffer();
    onProgress?.(85);
    const result = await decodeAudioFromArrayBuffer(ab, sourceName);
    onProgress?.(100);
    return result;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.byteLength;
      onProgress?.(Math.min(82, Math.round((received / totalBytes) * 82)));
    }
  }

  const merged = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  onProgress?.(90);
  const result = await decodeAudioFromArrayBuffer(merged.buffer, sourceName);
  onProgress?.(100);
  return result;
}

export function estimateWavSizeBytes(
  durationSec: number,
  sampleRate: AudioSampleRate,
  channelMode: AudioChannelMode
): number {
  const channels = channelMode === 'mono' ? 1 : 2;
  const bytesPerSample = 2; // 16-bit PCM
  return 44 + Math.max(0, Math.round(durationSec * sampleRate * channels * bytesPerSample));
}

export async function renderTrimmedWavBlob(
  sourceBuffer: AudioBuffer,
  options: {
    startSec: number;
    endSec: number;
    sampleRate: AudioSampleRate;
    channelMode: AudioChannelMode;
  }
): Promise<Blob> {
  const clampedStart = Math.max(0, Math.min(options.startSec, sourceBuffer.duration));
  const clampedEnd = Math.max(clampedStart + 0.1, Math.min(options.endSec, sourceBuffer.duration));
  const sliceDuration = clampedEnd - clampedStart;
  const targetChannels = options.channelMode === 'mono' ? 1 : Math.min(2, sourceBuffer.numberOfChannels);
  const targetFrames = Math.max(1, Math.ceil(sliceDuration * options.sampleRate));

  const offlineCtx = new OfflineAudioContext(targetChannels, targetFrames, options.sampleRate);
  const bufferSource = offlineCtx.createBufferSource();
  bufferSource.buffer = sourceBuffer;
  bufferSource.connect(offlineCtx.destination);
  bufferSource.start(0, clampedStart, sliceDuration);

  const rendered = await offlineCtx.startRendering();
  return encodeAudioBufferToWav(rendered);
}

function encodeAudioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const numSamples = buffer.length;
  const dataByteLength = numSamples * blockAlign;

  const arrayBuffer = new ArrayBuffer(44 + dataByteLength);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataByteLength, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataByteLength, true);

  const channelArrays: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channelArrays.push(buffer.getChannelData(ch));
  }

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channelArrays[ch][i]));
      const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, int16, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}
