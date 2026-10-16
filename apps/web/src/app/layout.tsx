import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Neutrino — Graph-Native AI Investigation Platform',
  description: 'Graph-native investigation platform powered by FalkorDB for Graph Hacks.',
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
