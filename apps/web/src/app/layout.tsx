import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';

import { AuthProvider } from '@/components/providers/auth-provider';
import { Footer } from '@/components/layout/footer';
import { Header } from '@/components/layout/header';
import './globals.css';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
});

export const metadata: Metadata = {
  title: 'PitchZone — Турнирная платформа киберфутбола',
  description:
    'Турнирная платформа нового поколения для киберфутбола — честные турниры, мгновенные выплаты, прозрачный рейтинг.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <AuthProvider>
          <Header />
          <main>{children}</main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
