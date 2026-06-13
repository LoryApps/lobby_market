import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { GazetteClient } from '../GazetteClient'
import type { GazetteData } from '@/app/api/gazette/route'

interface GazettePageProps {
  params: { date: string }
}

export async function generateMetadata({ params }: GazettePageProps): Promise<Metadata> {
  const { date } = params
  const d = new Date(date)
  const formatted = d.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
  const title = `The Civic Gazette — ${formatted} · Lobby Market`
  return {
    title,
    description: `Today's civic front page: laws established, debates raging, and the strongest arguments — all from ${formatted}.`,
    openGraph: {
      title,
      description: `The day's civic record: laws, debates, arguments, and top voices — ${formatted}.`,
      type: 'article',
      siteName: 'Lobby Market',
      publishedTime: `${date}T00:00:00Z`,
    },
    twitter: {
      card: 'summary',
      title,
      description: `Civic front page for ${formatted} — laws passed, debates raging, best argument of the day.`,
    },
  }
}

export const dynamic = 'force-dynamic'

export default async function GazetteDatePage({ params }: GazettePageProps) {
  const { date } = params

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound()

  const today = new Date().toISOString().slice(0, 10)
  if (date > today) redirect('/gazette')

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const res = await fetch(`${base}/api/gazette?date=${date}`, { cache: 'no-store' })
  if (!res.ok) notFound()

  const data: GazetteData = await res.json()

  return <GazetteClient data={data} />
}
