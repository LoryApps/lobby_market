import type { Metadata } from 'next'
import { MyThesesClient } from './MyThesesClient'

export const metadata: Metadata = {
  title: 'My Theses · Lobby Market',
  description:
    'Manage your civic theses — track accuracy, mark as vindicated or refuted, and stake new predictions.',
  openGraph: {
    title: 'My Theses · Lobby Market',
    description: 'Your personal civic prediction record — accuracy, outcomes, and active stakes.',
    type: 'website',
    siteName: 'Lobby Market',
  },
}

export default function MyThesesPage() {
  return <MyThesesClient />
}
