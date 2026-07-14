import type { Metadata } from 'next'
import { WrittenQuestionsClient } from './WrittenQuestionsClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Written Parliamentary Questions · Lobby Market',
  description:
    'Submit formal written questions to civic department leads. Every open question must receive a written answer within 14 days — on the public record.',
  openGraph: {
    title: 'Written Parliamentary Questions · Lobby Market',
    description:
      'Hold civic leaders to account. Submit a formal written question to any department — every answer is on the public record.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Written Questions · Lobby Market',
    description: 'Formal written questions to civic departments — on the public record.',
  },
}

export default function WrittenQuestionsPage() {
  return <WrittenQuestionsClient />
}
