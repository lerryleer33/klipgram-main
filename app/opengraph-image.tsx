import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const alt =
  'KlipGram — Pengunduh Foto, Video, Reels, Story & Dek Ekstraksi Audio Instagram';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

async function loadMascotDataUri(): Promise<string | null> {
  try {
    const filePath = join(process.cwd(), 'public', 'og-mascot.jpg');
    const buffer = await readFile(filePath);
    return `data:image/jpeg;base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

export default async function OpenGraphImage() {
  const mascotSrc = await loadMascotDataUri();

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#F7F1E3',
          backgroundImage: 'radial-gradient(rgba(29, 27, 24, 0.12) 1.5px, transparent 1.5px)',
          backgroundSize: '24px 24px',
          padding: '42px 48px',
          color: '#1D1B18',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Kartu Dek Retro Utama */}
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            backgroundColor: '#FFFDF7',
            border: '4px solid #1D1B18',
            borderRadius: '28px',
            boxShadow: '10px 10px 0px #1D1B18',
            padding: '36px 44px',
          }}
        >
          {/* Baris Header Brand */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '3px solid rgba(29, 27, 24, 0.14)',
              paddingBottom: '20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  backgroundColor: '#E84A36',
                  border: '3px solid #1D1B18',
                  boxShadow: '3px 3px 0px #1D1B18',
                  color: '#FFFDF7',
                  fontSize: '22px',
                  fontWeight: 800,
                }}
              >
                K
              </div>
              <span
                style={{
                  fontSize: '30px',
                  fontWeight: 800,
                  letterSpacing: '-0.03em',
                  color: '#1D1B18',
                }}
              >
                KlipGram
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                backgroundColor: '#EDE3CE',
                border: '3px solid #1D1B18',
                borderRadius: '14px',
                padding: '8px 18px',
                fontSize: '18px',
                fontWeight: 700,
                color: '#1D1B18',
              }}
            >
              <span>Foto</span>
              <span style={{ color: '#E84A36' }}>•</span>
              <span>Video</span>
              <span style={{ color: '#2A8C82' }}>•</span>
              <span>Reels</span>
              <span style={{ color: '#E5A93B' }}>•</span>
              <span>Story</span>
            </div>
          </div>

          {/* Konten Utama 2 Kolom */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '36px',
              flex: 1,
              paddingTop: '18px',
            }}
          >
            {/* Kolom Kiri: Tipografi & Badge Fitur */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                flex: 1,
                maxWidth: '670px',
              }}
            >
              <span
                style={{
                  fontSize: '20px',
                  fontWeight: 800,
                  color: '#2A8C82',
                  marginBottom: '12px',
                }}
              >
                Pengunduh Media Instagram & Dek Ekstraksi Audio
              </span>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  fontSize: '52px',
                  fontWeight: 800,
                  lineHeight: 1.08,
                  letterSpacing: '-0.03em',
                  color: '#1D1B18',
                }}
              >
                <span>Simpan Foto, Reels,</span>
                <span>& Story HD dengan</span>
                <span style={{ color: '#E84A36' }}>Sentuhan Retro.</span>
              </div>

              <span
                style={{
                  marginTop: '16px',
                  fontSize: '21px',
                  lineHeight: 1.4,
                  color: '#575047',
                  fontWeight: 500,
                }}
              >
                Unduh resolusi asli tanpa watermark & pisahkan audio jernih langsung di browser.
              </span>

              {/* Tombol/Label Taktil Retro */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  marginTop: '26px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: '#E84A36',
                    color: '#FFFDF7',
                    border: '3px solid #1D1B18',
                    borderRadius: '14px',
                    boxShadow: '4px 4px 0px #1D1B18',
                    padding: '10px 20px',
                    fontSize: '19px',
                    fontWeight: 800,
                  }}
                >
                  Resolusi Asli HD
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: '#2A8C82',
                    color: '#FFFDF7',
                    border: '3px solid #1D1B18',
                    borderRadius: '14px',
                    boxShadow: '4px 4px 0px #1D1B18',
                    padding: '10px 20px',
                    fontSize: '19px',
                    fontWeight: 800,
                  }}
                >
                  Audio WAV 48 kHz
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: '#E5A93B',
                    color: '#1D1B18',
                    border: '3px solid #1D1B18',
                    borderRadius: '14px',
                    boxShadow: '4px 4px 0px #1D1B18',
                    padding: '10px 18px',
                    fontSize: '19px',
                    fontWeight: 800,
                  }}
                >
                  Tanpa Login
                </div>
              </div>
            </div>

            {/* Kolom Kanan: Kartu Polaroid Maskot Klipi */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                width: '310px',
                backgroundColor: '#F7F1E3',
                border: '4px solid #1D1B18',
                borderRadius: '24px',
                boxShadow: '7px 7px 0px #1D1B18',
                padding: '16px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingBottom: '10px',
                  fontSize: '15px',
                  fontWeight: 800,
                  color: '#575047',
                }}
              >
                <span style={{ color: '#1D1B18' }}>Klipi • Maskot Kamera</span>
                <span style={{ color: '#2A8C82' }}>● REC</span>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  height: '246px',
                  backgroundColor: '#F6EBD6',
                  border: '3px solid #1D1B18',
                  borderRadius: '16px',
                  overflow: 'hidden',
                }}
              >
                {mascotSrc ? (
                  <img
                    src={mascotSrc}
                    alt="Maskot Klipi"
                    width={246}
                    height={246}
                    style={{ objectFit: 'contain' }}
                  />
                ) : (
                  <span style={{ fontSize: '40px', fontWeight: 800 }}>Klipi</span>
                )}
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: '12px',
                  backgroundColor: '#FFFDF7',
                  border: '2px solid #1D1B18',
                  borderRadius: '12px',
                  padding: '8px 12px',
                  fontSize: '15px',
                  fontWeight: 700,
                  color: '#1D1B18',
                }}
              >
                “Cekrek! Siap simpan media HD!”
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
