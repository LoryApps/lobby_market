import type { Metadata } from 'next'
import { AddressClient } from './AddressClient'
import type { AddressData } from '@/app/api/address/route'

export const dynamic = 'force-dynamic'
export const revalidate = 3600

export const metadata: Metadata = {
  title: 'State of the Lobby · Lobby Market',
  description:
    'The formal address to the citizens of the Lobby — laws established, civic health, top contributors, and the legislative agenda ahead.',
  openGraph: {
    title: 'State of the Lobby · Lobby Market',
    description:
      'A formal periodic address covering every law passed, the health of civic discourse, and the agenda ahead. The official record of democratic progress.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'State of the Lobby · Lobby Market',
    description:
      'Laws passed. Debates held. Citizens engaged. The formal State of the Lobby address.',
  },
}

export default async function AddressPage() {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  let data: AddressData | null = null

  try {
    const res = await fetch(`${base}/api/address`, { cache: 'no-store' })
    if (res.ok) data = await res.json()
  } catch {
    // render with null — client shows skeleton / error
  }

  return <AddressClient data={data} />
}
