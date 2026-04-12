import type { Metadata } from 'next'
import { Providers } from '@/components/Providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'Lobby Market',
  description: 'Write the law. Build the consensus.',
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
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
