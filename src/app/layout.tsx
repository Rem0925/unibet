import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: 'UniBet — Apuestas pari-mutuel en USDT',
    template: '%s · UniBet',
  },
  description:
    'Mercados de predicción entre amigos con saldos en USDT. El 100% del pozo se reparte entre los ganadores y las recargas se procesan con Binance Pay.',
  applicationName: 'UniBet',
  keywords: ['apuestas', 'pari-mutuel', 'USDT', 'Binance Pay', 'mercados de predicción'],
  robots: {
    index: false,
    follow: false,
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#090a0f',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
