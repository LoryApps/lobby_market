import type { Metadata } from 'next'
import { GazetteClient } from './GazetteClient'
import type { GazetteData } from '@/app/api/gazette/route'

export const dynamic = 'force-dynamic'
export const revalidate = 300

export const metadata: Metadata = {
  title: "The Civic Gazette · Lobby Market",
  description:
    "The Lobby's daily civic front page — laws established today, the top debate, best argument of the day, and the citizen leading the charge.",
  openGraph: {
    title: "The Civic Gazette · Lobby Market",
    description:
      "Today's civic record: which laws passed, which debates are raging, and who made the best argument. A new edition every day.",
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: "The Civic Gazette · Lobby Market",
    description:
      "Today's civic front page — laws, debates, arguments, and top voices. A new edition daily.",
  },
}

export default async function GazettePage() {
  const today = new Date().toISOString().slice(0, 10)
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  const res = await fetch(`${base}/api/gazette?date=${today}`, { cache: 'no-store' })
  const data: GazetteData = res.ok ? await res.json() : null

  return <GazetteClient data={data} />
}
