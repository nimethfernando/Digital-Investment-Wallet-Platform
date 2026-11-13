import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ThemeProvider } from '../context/ThemeContext';
import { LanguageProvider } from '../context/LanguageContext';
import { AuthProvider } from '../context/AuthContext';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';

export const metadata: Metadata = {
  title: 'Avora Bank | Digital Wealth, Private Wallet & Institutional OTC Desk',
  description: 'Fixed-term digital investment packages with 1% monthly returns, immutable double-entry ledger security, virtual cards, and institutional OTC settlement across global rails.',
  keywords: ['Avora Bank', 'digital investment', 'private wallet', 'crypto exchange', 'global OTC desk', 'virtual visa mastercard', 'double entry ledger'],
  icons: {
    icon: [
      { url: '/favicon.ico?v=4' },
      { url: '/favicon-32x32.png?v=4', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png?v=4', sizes: '16x16', type: 'image/png' },
      { url: '/icon.png?v=4', type: 'image/png', sizes: '512x512' },
    ],
    shortcut: '/favicon.ico?v=4',
    apple: '/apple-touch-icon.png?v=4',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col antialiased selection:bg-emerald-600 selection:text-white">
        <ThemeProvider>
          <LanguageProvider>
            <AuthProvider>
              <Header />
              <main className="flex-1">
                {children}
              </main>
              <Footer />
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
