import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import { Providers } from './providers';
import '@/styles/globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: { default: 'mawaDao - AI Agent Marketplace', template: '%s | mawaDao' },
  description: 'Discover, deploy, and manage AI agents for your business. mawaDao is the marketplace where teams find and connect intelligent automation.',
  keywords: ['AI', 'agents', 'marketplace', 'automation', 'business', 'artificial intelligence', 'chatbot'],
  authors: [{ name: 'mawaDao' }],
  creator: 'mawaDao',
  metadataBase: new URL('https://www.mawadao.com'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://www.mawadao.com',
    siteName: 'mawaDao',
    title: 'mawaDao - AI Agent Marketplace',
    description: 'Discover, deploy, and manage AI agents for your business.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'mawaDao' }],
  },
  twitter: { card: 'summary_large_image', title: 'mawaDao', description: 'AI Agent Marketplace' },
  icons: {
    icon: '/favicon.svg',
  },
  manifest: '/site.webmanifest',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <Providers>
          {children}
        </Providers>
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
