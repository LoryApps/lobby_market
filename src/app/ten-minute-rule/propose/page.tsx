import type { Metadata } from 'next'
import { ProposeClient } from './ProposeClient'

export const metadata: Metadata = {
  title: 'Propose a Bill — Ten Minute Rule · Lobby Market',
  description:
    'Use the Ten Minute Rule to propose a new bill. Write your speech, choose your category, and put your legislation before the House.',
}

export default function ProposePage() {
  return <ProposeClient />
}
