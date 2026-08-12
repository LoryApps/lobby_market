import type { Metadata } from 'next'
import { Suspense } from 'react'
import { WriteClient } from './WriteClient'

export const metadata: Metadata = {
  title: 'Write an Argument · Lobby Market',
  description:
    'Craft a compelling argument on any active debate topic. Choose your side, write your case, and have it count in the civic debate.',
  openGraph: {
    title: 'Write an Argument · Lobby Market',
    description: 'A focused writing environment for civic argumentation.',
    type: 'website',
    siteName: 'Lobby Market',
  },
}

export default function WritePage() {
  return (
    <Suspense>
      <WriteClient />
    </Suspense>
  )
}
