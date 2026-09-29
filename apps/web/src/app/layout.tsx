import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ThemeProvider } from '../context/ThemeContext';
import { LanguageProvider } from '../context/LanguageContext';
import { AuthProvider } from '../context/AuthContext';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';

export const metadata: Metadata = {
  title: 'Nexis Global | Digital Investment & Liquidity Exchange Desk',
  description: 'Fixed-term digital investment packages with monthly returns, immutable double-entry ledger security, and fast USDT-fiat exchange desk.',
  keywords: ['digital investment', 'wallet', 'crypto exchange', 'USDT Tbilisi', 'double entry ledger'],
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
      <body className="min-h-screen flex flex-col antialiased selection:bg-blue-600 selection:text-white">
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
