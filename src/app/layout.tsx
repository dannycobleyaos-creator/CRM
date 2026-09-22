import type { Metadata, Viewport } from 'next';
import { Inter, Jost } from 'next/font/google';

import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

/**
 * Jost is a geometric grotesque in the Futura tradition — the closest open
 * counterpart to the clean Scandinavian display type the brand uses.
 */
const jost = Jost({
  subsets: ['latin'],
  variable: '--font-jost',
  display: 'swap',
  weight: ['300', '400', '500', '600'],
});

export const metadata: Metadata = {
  title: {
    default: 'Hygge Pergola CRM',
    template: '%s · Hygge Pergola CRM',
  },
  description:
    'The single portal for Hygge Pergola agents — cases, customers, daily work, parts dispatch, announcements and performance in one place.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#2B3134',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${inter.variable} ${jost.variable}`}>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
