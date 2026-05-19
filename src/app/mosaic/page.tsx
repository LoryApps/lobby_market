import type { Metadata } from 'next'
import { MosaicClient } from './MosaicClient'

export const metadata: Metadata = {
  title: 'The Civic Mosaic · Lobby Market',
  description:
    'Every debate on Lobby Market — rendered as a living mosaic. Blue tiles are strong FOR mandates. Red are strong rejections. Gold marks the contested battlegrounds. The entire democratic landscape, at a glance.',
  openGraph: {
    title: 'The Civic Mosaic · Lobby Market',
    description:
      'A living mosaic of every civic debate — consensus in colour, engagement in size. The whole democratic landscape on one canvas.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Civic Mosaic · Lobby Market',
    description:
      'Every debate on Lobby Market as a colour-coded mosaic tile. Blue = FOR mandate. Red = AGAINST. Gold = contested.',
  },
}

export default function MosaicPage() {
  return <MosaicClient />
}
