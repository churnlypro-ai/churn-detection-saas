import { ImageResponse } from 'next/server';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#d97706',
          color: 'white',
          fontSize: 108,
          fontWeight: 700,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        C
      </div>
    ),
    { width: size.width, height: size.height },
  );
}
