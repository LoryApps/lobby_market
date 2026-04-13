import type { Metadata } from 'next'
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
  },
  twitter: {
    card: 'summary',
    title: 'Lobby Market',
    description: 'Write the law. Build the consensus.',
  },
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
