import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ThemeProvider } from '../context/ThemeContext';
import { LanguageProvider } from '../context/LanguageContext';
import { AuthProvider } from '../context/AuthContext';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';

export const metadata: Metadata = {
  title: 'Avora Bank | Digital Wealth, Private Wallet & Institutional OTC Desk',
  description: 'Fixed-term digital investment packages with 1% monthly returns, immutable double-entry ledger security, virtual cards, and GeCrypto-style OTC settlement in Tbilisi.',
  keywords: ['Avora Bank', 'digital investment', 'private wallet', 'crypto exchange', 'USDT Tbilisi', 'virtual visa mastercard', 'double entry ledger'],
  icons: {
    icon: '/favicon.ico',
    apple: '/favicon.ico',
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
