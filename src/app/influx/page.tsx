import type { Metadata } from 'next'
import { InfluxClient } from './InfluxClient'

export const metadata: Metadata = {
  title: 'The Civic Influx · Lobby Market',
  description:
    'Topics where public interest has outpaced participation — thousands of viewers, but most haven\'t voted yet. These are the debates on the verge of a democratic wave.',
  openGraph: {
    title: 'The Civic Influx · Lobby Market',
    description:
      'Thousands of eyes. Fewer votes. These civic debates have captured public attention but most viewers haven\'t cast their say yet. The wave is coming — will you lead it?',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'The Civic Influx · Lobby Market',
    description:
      'Debates where viewers outnumber voters — the next wave of civic participation is building. Your vote matters most here.',
  },
}

export default function InfluxPage() {
  return <InfluxClient />
}
