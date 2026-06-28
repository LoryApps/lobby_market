import type { Metadata } from 'next'
import { AssemblyDetailClient } from './AssemblyDetailClient'

export const metadata: Metadata = {
  title: "Citizens' Assembly · Lobby Market",
  description: 'A sortition-based deliberative body deliberating on a contested civic question.',
}

export default function AssemblyDetailPage() {
  return <AssemblyDetailClient />
}
