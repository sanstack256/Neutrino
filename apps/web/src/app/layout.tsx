import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Neutrino — Graph-Native AI Investigation Platform',
  description: 'Graph-native investigation platform powered by FalkorDB for Graph Hacks.',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icon.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: [
      { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-neutrino-950 text-slate-100 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
