import type { Metadata } from 'next'
import { AlignmentClient } from './AlignmentClient'

export const metadata: Metadata = {
  title: 'Thesis Alignment | Lobby',
  description: 'See how civic thesis predictions align with actual topic vote outcomes across the community.',
}

export default function ThesisAlignmentPage() {
  return <AlignmentClient />
}
