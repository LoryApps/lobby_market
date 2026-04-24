import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Prediction Market · Lobby Market',
  description:
    'Stake your Clout on how topics will resolve — will they pass into law or fail? Community forecasts with real skin in the game.',
  openGraph: {
    title: 'Prediction Market · Lobby Market',
    description: 'Bet your Clout on topic outcomes. Community forecasting with real stakes.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Prediction Market · Lobby Market',
    description: 'Stake Clout on topic outcomes. Who\'s right about the future?',
  },
}

export default function PredictionsLayout({ children }: { children: ReactNode }) {
  return children
}
