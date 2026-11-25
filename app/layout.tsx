import type { Metadata } from 'next';
import { headers } from 'next/headers';
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

const SITE_TITLE = 'KlipGram — Unduh Foto, Video, Reels, Story & Ekstrak Audio Instagram';
const SITE_DESCRIPTION =
  'Unduh foto, video, Instagram Reels, Story publik, dan ekstrak audio berkualitas tinggi langsung dari tautan Instagram secara cepat.';

// Menentukan URL dasar absolut dari variabel lingkungan atau header request aktif agar crawler WhatsApp selalu mendapat URL absolut.
async function resolveMetadataBase(): Promise<URL> {
  const envCandidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  ];

  for (const raw of envCandidates) {
    const trimmed = raw?.trim();
    if (!trimmed || trimmed === 'MY_APP_URL') continue;
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
      return new URL(normalized);
    } catch {
      continue;
    }
  }

  try {
    const reqHeaders = await headers();
    const host = reqHeaders.get('x-forwarded-host') ?? reqHeaders.get('host');
    if (host) {
      const proto =
        reqHeaders.get('x-forwarded-proto')?.split(',')[0]?.trim() ||
        (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');
      return new URL(`${proto}://${host}`);
    }
  } catch {
    // Fallback ke localhost bila dieksekusi di luar konteks request
  }

  return new URL('http://localhost:3000');
}

export async function generateMetadata(): Promise<Metadata> {
  const metadataBase = await resolveMetadataBase();

  return {
    metadataBase,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    alternates: {
      canonical: '/',
    },
    openGraph: {
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
      url: '/',
      siteName: 'KlipGram',
      locale: 'id_ID',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
    },
  };
}

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
