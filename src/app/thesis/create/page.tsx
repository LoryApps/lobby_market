import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ThesisCreateClient } from './ThesisCreateClient'

export const metadata: Metadata = {
  title: 'Write a Thesis · Lobby Market',
  description:
    'Publish a civic thesis — a bold, dated prediction — and stake your reputation on it. Others agree or disagree, and when time passes the record stands.',
  openGraph: {
    title: 'Write a Thesis · Lobby Market',
    description: 'Make a civic prediction and stake your reputation on it.',
    type: 'website',
    siteName: 'Lobby Market',
  },
}

export default function ThesisCreatePage() {
  return (
    <Suspense>
      <ThesisCreateClient />
    </Suspense>
  )
}
