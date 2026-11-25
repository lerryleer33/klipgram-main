import type { Metadata } from 'next';
import { Bricolage_Grotesque, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-bricolage',
  display: 'swap',
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-jakarta',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'KlipGram — Unduh Foto, Video, Reels, Story & Ekstrak Audio Instagram',
  description:
    'Unduh foto, video, Instagram Reels, Story publik, dan ekstrak audio berkualitas tinggi langsung dari tautan Instagram secara cepat.',
  openGraph: {
    title: 'KlipGram — Unduh Foto, Video, Reels, Story & Ekstrak Audio Instagram',
    description:
      'Unduh foto, video, Instagram Reels, Story publik, dan ekstrak audio berkualitas tinggi langsung dari tautan Instagram secara cepat.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'KlipGram — Unduh Foto, Video, Reels, Story & Ekstrak Audio Instagram',
    description:
      'Unduh foto, video, Instagram Reels, Story publik, dan ekstrak audio berkualitas tinggi langsung dari tautan Instagram secara cepat.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="id"
      className={`${bricolage.variable} ${jakarta.variable} ${jetbrains.variable}`}
    >
      <body suppressHydrationWarning className="min-h-screen bg-[#F7F1E3] text-[#1D1B18] antialiased selection:bg-[#E84A36]/20 selection:text-[#1D1B18]">
        {children}
      </body>
    </html>
  );
}
