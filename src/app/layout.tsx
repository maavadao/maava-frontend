import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import { Providers } from './providers';
import '@/styles/globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://agent.mawadao.com';
const DESCRIPTION =
  'Your own AI agent, agents reviewed for safety and built for learning, and a guide to the AI tools worth knowing. Free for schools, educators and learners; built and owned by the community.';

export const metadata: Metadata = {
  title: { default: 'mawaDao — AI agents for every classroom', template: '%s | mawaDao' },
  description: DESCRIPTION,
  keywords: ['AI agents', 'education', 'AI tools', 'schools', 'students', 'teachers', 'non-profit', 'open source'],
  authors: [{ name: 'mawaDao contributors' }],
  creator: 'mawaDao',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    type: 'website',
    locale: 'en_GB',
    url: SITE_URL,
    siteName: 'mawaDao',
    title: 'mawaDao — AI agents for every classroom',
    description: DESCRIPTION,
  },
  twitter: { card: 'summary', title: 'mawaDao — AI agents for every classroom', description: DESCRIPTION },
  icons: {
    icon: '/favicon.svg',
  },
  manifest: '/site.webmanifest',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <Providers>
          {children}
        </Providers>
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
