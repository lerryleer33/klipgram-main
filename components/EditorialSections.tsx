'use client';

import { useState } from 'react';
import Image, { StaticImageData } from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Film, Image as ImageIcon, Music } from 'lucide-react';
import retroReelsImg from '@/src/assets/images/retro_bento_reels_1795590333992.jpg';
import retroCassetteImg from '@/src/assets/images/retro_bento_cassette_1795590334828.jpg';
import retroPolaroidImg from '@/src/assets/images/retro_bento_polaroid_1795590334905.jpg';

const STEPS = [
  {
    number: '01.',
    title: 'Salin Tautan Publik Instagram',
    description:
      'Buka aplikasi atau situs Instagram, ketuk ikon bagikan pada Foto, Video, Reels, atau Story dari akun publik, lalu pilih Salin Tautan.',
  },
  {
    number: '02.',
    title: 'Tempel & Pilih Mode Dek',
    description:
      'Tempel tautan ke kolom KlipGram. Klipi langsung mengenali jenis kiriman secara otomatis termasuk galeri carousel dengan banyak slide.',
  },
  {
    number: '03.',
    title: 'Simpan Media HD atau Ekstrak Audio',
    description:
      'Unduh foto dan video dalam resolusi asli, atau buka Dek Kaset Audio untuk memotong durasi dan menyimpan trek WAV jernih.',
  },
];

const FAQ_ITEMS = [
  {
    question: 'Konten Instagram apa saja yang dapat diunduh melalui KlipGram?',
    answer:
      'KlipGram mendukung tautan publik untuk Foto tunggal, Video kiriman, Carousel multi-media, Instagram Reels, serta Instagram Story yang masih aktif dari akun publik.',
  },
  {
    question: 'Bagaimana cara kerja fitur ekstrak audio dari video?',
    answer:
      'Setelah video Reels atau kiriman dimuat, klik Ekstrak Audio. Browser Anda akan mendekode trek suara secara langsung menggunakan Web Audio API, menampilkan bentuk gelombang interaktif, memotong bagian awal/akhir sesuai kebutuhan, lalu menyimpan berkas audio WAV tanpa kompresi berlebih.',
  },
  {
    question: 'Mengapa beberapa tautan Instagram Story tidak langsung terbuka?',
    answer:
      'Instagram membatasi akses anonim pada sebagian tautan Story dan menghapus Story otomatis setelah 24 jam. Pastikan tautan berasal dari akun publik yang masih aktif. Untuk penggunaan pribadi di server sendiri, Anda juga dapat menambahkan INSTAGRAM_SESSION_ID di konfigurasi lingkungan server.',
  },
  {
    question: 'Apakah KlipGram menyimpan riwayat atau berkas media saya di server?',
    answer:
      'Tidak. KlipGram hanya bertindak sebagai perantara sementara untuk mengambil tautan media dan tidak menyimpan foto, video, maupun audio Anda. Riwayat tautan terakhir disimpan secara lokal di browser Anda sendiri dan dapat dihapus kapan saja.',
  },
];

function RetroIllustration({
  src,
  alt,
  aspectClass,
  fallbackIcon,
}: {
  src: StaticImageData;
  alt: string;
  aspectClass: string;
  fallbackIcon: 'reels' | 'audio' | 'story';
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl border-2 border-[#1D1B18] bg-[#EDE3CE] text-[#1D1B18] ${aspectClass}`}
      >
        {fallbackIcon === 'audio' ? (
          <Music className="h-8 w-8" />
        ) : fallbackIcon === 'story' ? (
          <ImageIcon className="h-8 w-8" />
        ) : (
          <Film className="h-8 w-8" />
        )}
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-xl border-2 border-[#1D1B18] bg-[#F7F1E3] ${aspectClass}`}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 1024px) 100vw, 50vw"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
      />
    </div>
  );
}

export default function EditorialSections() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <>
      {/* Asymmetric Retro Risograph Bento Section */}
      <section className="border-t-2 border-[#1D1B18] bg-[#FFFDF7] py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2
              className="font-display text-2xl font-bold tracking-tight text-[#1D1B18] sm:text-4xl"
              style={{ textWrap: 'balance' }}
            >
              Gaya analog klasik, kecepatan unduh modern tanpa hambatan.
            </h2>
            <p className="mt-3 text-base text-[#575047] leading-relaxed">
              Satu dek serbaguna untuk menyimpan arsip visual beresolusi asli dan memisahkan suara dari video pendek langsung di browser Anda.
            </p>
          </div>

          {/* Asymmetric Bento Grid: Row 1 (7 + 5), Row 2 (12 split) */}
          <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Marquee Feature 01 */}
            <article className="group lg:col-span-7 flex flex-col justify-between rounded-2xl border-2 border-[#1D1B18] bg-[#F7F1E3] p-6 sm:p-7 shadow-[5px_5px_0px_#1D1B18]">
              <div>
                <RetroIllustration
                  src={retroReelsImg}
                  alt="Ilustrasi retro monitor CRT portabel menampilkan video sunset dengan pita film dan kaset"
                  aspectClass="aspect-video w-full"
                  fallbackIcon="reels"
                />
                <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-[#575047]">
                  <span className="text-[#E84A36]">Foto &amp; Video HD</span>
                  <span aria-hidden="true">·</span>
                  <span>Reels &amp; Carousel</span>
                </div>
                <h3 className="mt-2 font-display text-xl font-bold tracking-tight text-[#1D1B18]">
                  01. Unduh Foto, Video &amp; Reels Tanpa Penurunan Kualitas
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#575047]">
                  Mengambil langsung berkas media asli dari server CDN Instagram. Mendukung
                  kiriman tunggal, video Reels berformat MP4, hingga galeri carousel multi-slide
                  yang dapat diunduh satu per satu maupun sekaligus.
                </p>
              </div>
            </article>

            {/* Feature 02 */}
            <article className="group lg:col-span-5 flex flex-col justify-between rounded-2xl border-2 border-[#1D1B18] bg-[#F7F1E3] p-6 sm:p-7 shadow-[5px_5px_0px_#1D1B18]">
              <div>
                <RetroIllustration
                  src={retroCassetteImg}
                  alt="Ilustrasi retro kaset audio analog dengan headphone busa kuning dan penggeser equalizer"
                  aspectClass="aspect-[4/3] w-full"
                  fallbackIcon="audio"
                />
                <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-[#575047]">
                  <span className="text-[#2A8C82]">Web Audio API</span>
                  <span aria-hidden="true">·</span>
                  <span>48 kHz / 44.1 kHz WAV</span>
                </div>
                <h3 className="mt-2 font-display text-xl font-bold tracking-tight text-[#1D1B18]">
                  02. Dek Kaset Audio &amp; Pemotong Gelombang Suara
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#575047]">
                  Pisahkan musik latar, efek suara, atau dialog dari video Reels secara instan.
                  Tinjau gelombang suara, atur titik mulai dan selesai, lalu ekspor ke WAV Stereo atau Mono.
                </p>
              </div>
            </article>

            {/* Feature 03 — Asymmetric Wide Split */}
            <article className="group lg:col-span-12 grid grid-cols-1 gap-6 rounded-2xl border-2 border-[#1D1B18] bg-[#F4ECDC] p-6 sm:p-7 shadow-[5px_5px_0px_#1D1B18] lg:grid-cols-12 lg:items-center">
              <div className="lg:col-span-5">
                <RetroIllustration
                  src={retroPolaroidImg}
                  alt="Ilustrasi retro tumpukan foto Polaroid instan dan kamera saku 35mm di atas kertas krem"
                  aspectClass="aspect-[4/3] w-full"
                  fallbackIcon="story"
                />
              </div>
              <div className="lg:col-span-7 lg:pl-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#575047]">
                  <span className="text-[#1D1B18]">Instagram Story</span>
                  <span aria-hidden="true">·</span>
                  <span>Highlight Publik</span>
                  <span aria-hidden="true">·</span>
                  <span>Privasi Terjaga</span>
                </div>
                <h3 className="mt-2 font-display text-xl sm:text-2xl font-bold tracking-tight text-[#1D1B18]">
                  03. Arsip Instagram Story &amp; Highlight Sebelum Hilang 24 Jam
                </h3>
                <p className="mt-3 text-sm sm:text-base leading-relaxed text-[#575047]">
                  Tempel tautan Story atau nama pengguna publik untuk memeriksa dan menyimpan
                  momen penting sebelum kedaluwarsa. Semua permintaan diproses lewat jalur aman
                  tervalidasi tanpa melacak akun pribadi Anda.
                </p>
                <div className="mt-6 grid grid-cols-3 gap-4 border-t-2 border-[#1D1B18]/15 pt-5">
                  <div>
                    <p className="font-mono text-lg sm:text-xl font-bold tabular-nums text-[#1D1B18]">
                      1080p+
                    </p>
                    <p className="mt-0.5 text-xs text-[#575047]">Resolusi asli</p>
                  </div>
                  <div>
                    <p className="font-mono text-lg sm:text-xl font-bold tabular-nums text-[#2A8C82]">
                      48 kHz
                    </p>
                    <p className="mt-0.5 text-xs text-[#575047]">Audio PCM WAV</p>
                  </div>
                  <div>
                    <p className="font-mono text-lg sm:text-xl font-bold tabular-nums text-[#E84A36]">
                      0 MB
                    </p>
                    <p className="mt-0.5 text-xs text-[#575047]">Tanpa instal aplikasi</p>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* How To Use Section */}
      <section id="cara-pakai" className="border-t-2 border-[#1D1B18] py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-xl">
            <h2 className="font-display text-2xl font-bold tracking-tight text-[#1D1B18] sm:text-3xl">
              Cara menggunakan KlipGram
            </h2>
            <p className="mt-2 text-sm sm:text-base text-[#575047]">
              Tiga langkah singkat untuk menyimpan foto, video, maupun audio dari tautan publik.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
            {STEPS.map((step) => (
              <div
                key={step.number}
                className="rounded-2xl border-2 border-[#1D1B18] bg-[#FFFDF7] p-6 shadow-[4px_4px_0px_#1D1B18] space-y-2.5"
              >
                <span className="font-mono text-base font-bold tabular-nums text-[#E84A36]">
                  {step.number}
                </span>
                <h3 className="font-display text-lg font-bold text-[#1D1B18]">
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed text-[#575047]">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="tanya-jawab" className="border-t-2 border-[#1D1B18] bg-[#FFFDF7] py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <h2 className="font-display text-2xl font-bold tracking-tight text-[#1D1B18] sm:text-3xl">
                Pertanyaan yang sering diajukan
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[#575047]">
                Informasi singkat mengenai dukungan tautan publik, ekstraksi audio, dan privasi penggunaan.
              </p>
            </div>

            <div className="lg:col-span-8 space-y-3">
              {FAQ_ITEMS.map((item, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div
                    key={item.question}
                    className="rounded-2xl border-2 border-[#1D1B18] bg-[#F7F1E3] shadow-[3px_3px_0px_#1D1B18] overflow-hidden"
                  >
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setOpenFaq(isOpen ? null : idx)}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-base font-bold text-[#1D1B18] hover:bg-[#EDE3CE]/70 transition-colors cursor-pointer"
                    >
                      <span>{item.question}</span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-[#1D1B18] transition-transform duration-200 ${
                          isOpen ? 'rotate-180 text-[#E84A36]' : ''
                        }`}
                      />
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.15 }}
                          className="border-t-2 border-[#1D1B18]/15 bg-[#FFFDF7] px-5 py-4 text-sm leading-relaxed text-[#575047]"
                        >
                          {item.answer}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Quiet Vintage Stationery Footer */}
      <footer className="border-t-2 border-[#1D1B18] bg-[#F7F1E3] py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 sm:px-6 lg:px-8 md:flex-row md:items-center md:justify-between">
          <div>
            <span className="font-display text-lg font-bold tracking-tight text-[#1D1B18]">
              KlipGram
            </span>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-[#575047]">
              KlipGram adalah alat bantu independen dan tidak berafiliasi dengan Instagram atau Meta.
              Gunakan hanya untuk mengunduh konten publik atau materi yang Anda miliki izin penggunaannya.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs font-bold text-[#575047]">
            <a href="#unduh-media" className="hover:text-[#1D1B18] transition-colors whitespace-nowrap">
              Unduh Media
            </a>
            <a
              href="#unduh-media"
              onClick={() => window.dispatchEvent(new CustomEvent('klipgram:open-audio-tab'))}
              className="hover:text-[#1D1B18] transition-colors whitespace-nowrap"
            >
              Ekstrak Audio
            </a>
            <a href="#cara-pakai" className="hover:text-[#1D1B18] transition-colors whitespace-nowrap">
              Cara Pakai
            </a>
            <a href="#tanya-jawab" className="hover:text-[#1D1B18] transition-colors whitespace-nowrap">
              Tanya Jawab
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}
