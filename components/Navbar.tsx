'use client';

import Link from 'next/link';

export default function Navbar() {
  const handleFocusInput = () => {
    const el = document.getElementById('klipgram-url-input') as HTMLInputElement | null;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      window.setTimeout(() => {
        el.focus();
      }, 220);
    }
    window.dispatchEvent(new CustomEvent('klipgram:focus-input'));
  };

  return (
    <header className="sticky top-0 z-40 border-b-2 border-[#1D1B18] bg-[#F7F1E3]/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Single text element wordmark */}
        <Link
          href="/"
          className="font-display text-xl font-bold tracking-tight text-[#1D1B18] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E84A36] focus-visible:ring-offset-2 rounded-sm"
        >
          KlipGram
        </Link>

        {/* Zone 2: 4 clean single-line text navigation links */}
        <nav
          aria-label="Navigasi utama"
          className="hidden md:flex items-center gap-7 text-sm font-semibold text-[#575047]"
        >
          <a
            href="#unduh-media"
            className="hover:text-[#1D1B18] transition-colors duration-150 whitespace-nowrap shrink-0 underline-offset-4 hover:underline decoration-2 decoration-[#E84A36]"
          >
            Unduh Media
          </a>
          <a
            href="#unduh-media"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('klipgram:open-audio-tab'));
            }}
            className="hover:text-[#1D1B18] transition-colors duration-150 whitespace-nowrap shrink-0 underline-offset-4 hover:underline decoration-2 decoration-[#2A8C82]"
          >
            Ekstrak Audio
          </a>
          <a
            href="#cara-pakai"
            className="hover:text-[#1D1B18] transition-colors duration-150 whitespace-nowrap shrink-0 underline-offset-4 hover:underline decoration-2 decoration-[#E5A93B]"
          >
            Cara Pakai
          </a>
          <a
            href="#tanya-jawab"
            className="hover:text-[#1D1B18] transition-colors duration-150 whitespace-nowrap shrink-0 underline-offset-4 hover:underline decoration-2 decoration-[#1D1B18]"
          >
            Tanya Jawab
          </a>
        </nav>

        {/* Zone 3: 1 primary retro push-button */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={handleFocusInput}
            className="inline-flex h-10 items-center justify-center rounded-xl border-2 border-[#1D1B18] bg-[#E5A93B] px-4 text-sm font-bold text-[#1D1B18] shadow-[3px_3px_0px_#1D1B18] transition-transform duration-150 hover:bg-[#EEB74E] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_#1D1B18] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E84A36] focus-visible:ring-offset-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Tempel Tautan
          </button>
        </div>
      </div>
    </header>
  );
}
