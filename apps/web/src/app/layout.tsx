import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Neutrino — Graph-Native AI Investigation Platform',
  description: 'Graph-native investigation platform powered by FalkorDB for Graph Hacks.',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.png', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: '/apple-icon.png',
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
