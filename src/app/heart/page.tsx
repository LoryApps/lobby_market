import type { Metadata } from 'next'
import { HeartViewerClient } from '@/components/heart/HeartViewerClient'

export const metadata: Metadata = {
  title: 'Exact 3D Heart · Lobby Market',
  description:
    'A mathematically exact 3D heart: the zero set of the heart polynomial, extracted from the equation with every vertex solved onto the surface to double precision.',
  openGraph: {
    title: 'Exact 3D Heart · Lobby Market',
    description: 'The heart polynomial, rendered as an exact 3D surface.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Exact 3D Heart · Lobby Market',
    description: 'The heart polynomial, rendered as an exact 3D surface.',
  },
}

export default function HeartPage() {
  return <HeartViewerClient />
}
