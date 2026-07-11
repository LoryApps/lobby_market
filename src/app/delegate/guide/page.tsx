import type { Metadata } from 'next'
import { DelegateGuideClient } from './DelegateGuideClient'

export const metadata: Metadata = {
  title: 'Delegation Guide · Lobby Market',
  description:
    "Set up Liquid Democracy in minutes. Find delegates who vote like you, choose what you trust them with, and let your civic voice reach every corner of the Lobby — even when you're away.",
  openGraph: {
    title: 'Delegation Guide · Lobby Market',
    description:
      'Liquid Democracy made simple. In three steps, find your ideal delegate, pick your scope, and amplify your civic impact.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Delegation Guide · Lobby Market',
    description:
      'Set up vote delegation in three steps — find your delegate, choose your scope, and activate Liquid Democracy.',
  },
}

export default function DelegateGuidePage() {
  return <DelegateGuideClient />
}
