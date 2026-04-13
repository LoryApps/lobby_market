import type { Metadata, Viewport } from 'next'
import { Providers } from '@/components/Providers'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Lobby Market',
    template: '%s · Lobby Market',
  },
  description: 'Write the law. Build the consensus. A platform where ideas compete, votes decide, and the best arguments become law.',
  metadataBase: new URL('https://lobby.market'),
  openGraph: {
    type: 'website',
    siteName: 'Lobby Market',
    title: 'Lobby Market',
    description: 'Write the law. Build the consensus.',
    images: [{ url: '/assets/og-share.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lobby Market',
    description: 'Write the law. Build the consensus.',
    images: ['/assets/og-share.png'],
  },
  // Apple PWA meta
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Lobby',
  },
  // Manifest is auto-linked by Next.js when src/app/manifest.ts exists
  applicationName: 'Lobby Market',
  formatDetection: {
    telephone: false,
    date: false,
    address: false,
    email: false,
    url: false,
  },
}

// Separate viewport export — required in Next.js 14 App Router.
// viewport-fit=cover lets content extend under the iPhone notch / home
// indicator; combined with the safe-area-inset-* CSS env() calls already
// used in BottomNav and TopBar this gives a full-bleed native feel.
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0f' },
    { media: '(prefers-color-scheme: light)', color: '#0a0a0f' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  colorScheme: 'dark',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body
        className="font-sans bg-surface-50 text-surface-700 min-h-screen antialiased"
      >
        {/* Skip-to-content link — visible only on keyboard focus */}
        <a
          href="#main-content"
          className={[
            'sr-only focus:not-sr-only',
            'focus:fixed focus:top-4 focus:left-4 focus:z-[200]',
            'focus:px-4 focus:py-2 focus:rounded-lg',
            'focus:bg-for-600 focus:text-white focus:font-medium focus:text-sm',
            'focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-for-400 focus:ring-offset-2 focus:ring-offset-surface-50',
          ].join(' ')}
        >
          Skip to main content
        </a>
        <Providers>
          <div id="main-content" tabIndex={-1}>
            {children}
          </div>
        </Providers>
      </body>
    </html>
  )
}
