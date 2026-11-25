'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, Music, Volume2, VolumeX } from 'lucide-react';
import mascotHappyImg from '@/src/assets/images/mascot_klipi_happy_1795590331513.jpg';
import mascotMusicImg from '@/src/assets/images/mascot_klipi_music_1795590332401.jpg';
import { playMascotChirp } from '@/lib/retro-sfx';

export type MascotMood = 'idle' | 'typing' | 'loading' | 'success' | 'audio' | 'error';

interface RetroMascotProps {
  mood: MascotMood;
  sfxEnabled: boolean;
  onToggleSfx: () => void;
}

const POKE_LINES = [
  'Cekrek! Klipi siap tangkap foto & Reels HD kamu!',
  'Hei, geliii! Yuk tempel link Instagram di bawah!',
  'Mau ambil suara Reels doang? Coba mode Ekstrak Audio!',
  'Klipi paling suka kaset 48 kHz super jernih!',
  'Klik aku lagi kalau butuh semangat hari ini!',
];

const MOOD_MESSAGES: Record<MascotMood, string> = {
  idle: 'Halo! Aku Klipi. Tempel tautan publik Instagram, biar aku tangkap medianya!',
  typing: 'Wah, tautan terdeteksi! Tekan tombol Ambil Media sekarang!',
  loading: 'Tunggu sebentar ya, Klipi lagi memutar gulungan pita Instagram...',
  success: 'Cekrek! Media HD berhasil ditangkap dan siap kamu simpan!',
  audio: 'Mode Kaset aktif! Ayo potong & ekstrak audionya dengan jernih!',
  error: 'Ups, tautannya terkunci atau kedaluwarsa. Coba tautan akun publik lain ya!',
};

export default function RetroMascot({
  mood,
  sfxEnabled,
  onToggleSfx,
}: RetroMascotProps) {
  const [pokeCount, setPokeCount] = useState(0);
  const [pokeActive, setPokeActive] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const isMusicPose = mood === 'audio';
  const currentMessage =
    pokeActive && pokeCount > 0
      ? POKE_LINES[(pokeCount - 1) % POKE_LINES.length]
      : MOOD_MESSAGES[mood];

  const handlePoke = () => {
    setPokeCount((c) => c + 1);
    setPokeActive(true);
    if (sfxEnabled) {
      playMascotChirp();
    }
    window.setTimeout(() => {
      setPokeActive(false);
    }, 3200);
  };

  // Expressive compositor-only motion variants by mood
  const mascotAnimation =
    mood === 'loading'
      ? {
          y: [0, -10, 0],
          rotate: [-4, 4, -4],
          scale: [1, 1.03, 1],
          transition: { duration: 0.65, repeat: Infinity, ease: 'easeInOut' as const },
        }
      : mood === 'audio'
        ? {
            y: [0, -8, 0, -5, 0],
            rotate: [-3, 3, -2, 2, -3],
            transition: { duration: 1.4, repeat: Infinity, ease: 'easeInOut' as const },
          }
        : mood === 'success'
          ? {
              y: [0, -12, 0],
              scale: [1, 1.05, 1],
              transition: { duration: 0.5, repeat: 2, ease: 'easeOut' as const },
            }
          : mood === 'error'
            ? {
                x: [0, -6, 6, -4, 4, 0],
                transition: { duration: 0.45, ease: 'easeInOut' as const },
              }
            : {
                y: [0, -6, 0],
                rotate: [-1.2, 1.2, -1.2],
                transition: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' as const },
              };

  return (
    <div className="flex flex-col items-center lg:items-end">
      {/* Retro Polaroid Mascot Stage */}
      <div className="relative w-full max-w-[330px] rounded-2xl border-2 border-[#1D1B18] bg-[#FFFDF7] p-4 shadow-[6px_6px_0px_#1D1B18]">
        {/* Top bar strip inside Polaroid card */}
        <div className="flex items-center justify-between gap-3 pb-3 border-b-2 border-[#1D1B18]/15">
          <div className="flex items-center gap-2 text-xs text-[#575047]">
            <span className="font-display font-bold text-[#1D1B18]">Klipi</span>
            <span aria-hidden="true">·</span>
            <span>{isMusicPose ? 'Mode Kaset' : 'Maskot Kamera'}</span>
          </div>

          <button
            type="button"
            onClick={onToggleSfx}
            aria-label={sfxEnabled ? 'Matikan efek suara retro' : 'Nyalakan efek suara retro'}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border-2 border-[#1D1B18] bg-[#F7F1E3] px-2.5 text-xs font-semibold text-[#1D1B18] shadow-[2px_2px_0px_#1D1B18] transition-transform duration-150 hover:bg-[#EDE3CE] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none whitespace-nowrap shrink-0 cursor-pointer"
          >
            {sfxEnabled ? (
              <>
                <Volume2 className="h-3.5 w-3.5 text-[#2A8C82]" />
                Suara Aktif
              </>
            ) : (
              <>
                <VolumeX className="h-3.5 w-3.5 text-[#575047]" />
                Suara Mati
              </>
            )}
          </button>
        </div>

        {/* Interactive Clickable Mascot Frame */}
        <div className="relative mt-3 flex items-center justify-center overflow-hidden rounded-xl border-2 border-[#1D1B18] bg-[#F7F1E3] aspect-square">
          <motion.button
            type="button"
            onClick={handlePoke}
            aria-label="Klik maskot Klipi untuk berinteraksi"
            animate={mascotAnimation}
            whileHover={{ scale: 1.05, rotate: -2 }}
            whileTap={{ scale: 0.92, rotate: 3 }}
            className="relative h-full w-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E84A36]"
          >
            {imgFailed ? (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-[#1D1B18]">
                {isMusicPose ? <Music className="h-12 w-12" /> : <Camera className="h-12 w-12" />}
                <span className="font-display text-sm font-bold">Klipi</span>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={isMusicPose ? 'music' : 'happy'}
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  transition={{ duration: 0.18 }}
                  className="relative h-full w-full"
                >
                  <Image
                    src={isMusicPose ? mascotMusicImg : mascotHappyImg}
                    alt={
                      isMusicPose
                        ? 'Maskot retro Klipi mengenakan headphone sambil mendengarkan musik'
                        : 'Maskot kamera retro Klipi melambaikan tangan dengan ceria'
                    }
                    fill
                    sizes="300px"
                    priority
                    referrerPolicy="no-referrer"
                    onError={() => setImgFailed(true)}
                    className="object-contain p-2 select-none"
                  />
                </motion.div>
              </AnimatePresence>
            )}
          </motion.button>
        </div>

        {/* Speech Bubble Caption Box */}
        <div className="mt-3 rounded-xl border-2 border-[#1D1B18] bg-[#F7F1E3] px-3.5 py-2.5">
          <AnimatePresence mode="wait">
            <motion.p
              key={`${mood}-${pokeActive ? pokeCount : 'base'}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16 }}
              className="text-xs sm:text-sm font-medium leading-snug text-[#1D1B18]"
            >
              “{currentMessage}”
            </motion.p>
          </AnimatePresence>
          <p className="mt-1.5 text-[11px] text-[#575047]">
            Klik Klipi untuk menyapa · Interaksi: <span className="font-mono tabular-nums font-semibold text-[#1D1B18]">{pokeCount}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
