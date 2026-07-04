import type { Metadata } from 'next'
import { MyQAClient } from './MyQAClient'

export const metadata: Metadata = {
  title: 'My Q&A · Lobby Market',
  description:
    'Your personal Q&A dashboard — questions you\'ve asked, answers you\'ve given, expertise badges earned, and open questions in your expert categories.',
}

export default function MyQAPage() {
  return <MyQAClient />
}
