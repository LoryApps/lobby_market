import type { Metadata } from 'next'
import { ConsultationDetailClient } from './ConsultationDetailClient'

export const metadata: Metadata = {
  title: 'Consultation · Lobby Market',
  description: 'Read this government consultation document and submit your response.',
}

export default function ConsultationDetailPage({
  params,
}: {
  params: { id: string }
}) {
  return <ConsultationDetailClient id={params.id} />
}
