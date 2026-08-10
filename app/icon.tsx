import { ImageResponse } from 'next/server';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  const s = size.width;
  return new ImageResponse(
    (
      <div style={{ width: s, height: s, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ffffff', borderRadius: s * 0.22 }}>
        <div style={{ width: s * 0.8, height: s * 0.8, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <div style={{ position: 'absolute', width: '100%', height: '100%', borderRadius: '50%', border: `${Math.max(1, s * 0.05)}px solid #fde68a`, display: 'flex' }} />
          <div style={{ position: 'absolute', width: '68%', height: '68%', borderRadius: '50%', border: `${Math.max(1, s * 0.07)}px solid #fbbf24`, display: 'flex' }} />
          <div style={{ position: 'absolute', width: '34%', height: '34%', borderRadius: '50%', background: '#d97706', display: 'flex' }} />
        </div>
      </div>
    ),
    { width: s, height: s },
  );
}
