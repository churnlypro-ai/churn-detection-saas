import { ImageResponse } from 'next/server';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  const s = size.width;
  return new ImageResponse(
    (
      <div style={{ width: s, height: s, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ffffff' }}>
        <div style={{ width: s * 0.72, height: s * 0.72, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <div style={{ position: 'absolute', width: '100%', height: '100%', borderRadius: '50%', border: `${s * 0.05}px solid #fde68a`, display: 'flex' }} />
          <div style={{ position: 'absolute', width: '68%', height: '68%', borderRadius: '50%', border: `${s * 0.07}px solid #fbbf24`, display: 'flex' }} />
          <div style={{ position: 'absolute', width: '34%', height: '34%', borderRadius: '50%', background: '#d97706', display: 'flex' }} />
        </div>
      </div>
    ),
    { width: s, height: s },
  );
}
