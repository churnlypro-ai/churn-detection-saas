import { ImageResponse } from 'next/server';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
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
          borderRadius: 7,
          color: 'white',
          fontSize: 22,
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
