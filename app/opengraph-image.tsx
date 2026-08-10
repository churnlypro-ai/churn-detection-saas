import { ImageResponse } from 'next/server';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Churnly — Prédisez qui va partir avant qu\'il ne parte';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #fffbeb 0%, #ffffff 55%, #fef3c7 100%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 108, fontWeight: 800, letterSpacing: -2 }}>
          <span style={{ color: '#0f172a' }}>Churn</span>
          <span style={{ color: '#d97706' }}>ly</span>
        </div>
        <div style={{ display: 'flex', marginTop: 28, fontSize: 34, color: '#475569', fontWeight: 500 }}>
          Prédisez qui va partir avant qu&apos;il ne parte
        </div>
      </div>
    ),
    { ...size },
  );
}
