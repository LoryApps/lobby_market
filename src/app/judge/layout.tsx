import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Argument Judge · Lobby Market',
  description:
    'Test your argument acuity — judge which side makes the more convincing case, then see how your picks compare to crowd wisdom.',
  openGraph: {
    title: 'Argument Judge · Lobby Market',
    description:
      'Which argument is more convincing? Judge 8 rounds of FOR vs AGAINST arguments and build your Argument Acuity score.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Argument Judge · Lobby Market',
    description: 'Judge arguments on merit, not your stance. See how you compare to the crowd.',
  },
}

export default function JudgeLayout({ children }: { children: React.ReactNode }) {
  return children
}
