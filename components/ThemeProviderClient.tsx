'use client';

import { ThemeProvider } from 'next-themes';

export default function ThemeProviderClient({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem storageKey="theme-preference">
      {children}
    </ThemeProvider>
  );
}
