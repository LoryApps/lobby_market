import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { CompareClient } from './CompareClient'

export const dynamic = 'force-dynamic'

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()
  const { data: law } = await supabase
    .from('laws')
    .select('statement, category')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) return { title: 'Compare Laws · Lobby Market' }

  return {
    title: `Compare: ${law.statement.slice(0, 60)} · Lobby Market`,
    description: `Compare this established law side-by-side with another law in the Codex.`,
  }
}

export default async function LawComparePage({ params }: Props) {
  const supabase = await createClient()
  const { data: law } = await supabase
    .from('laws')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) notFound()

  return (
    <Suspense>
      <CompareClient primaryId={params.id} />
    </Suspense>
  )
}
