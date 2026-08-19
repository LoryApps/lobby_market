import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ThesisEditClient } from './ThesisEditClient'

export const dynamic = 'force-dynamic'

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('civic_theses')
    .select('statement')
    .eq('id', params.id)
    .maybeSingle()

  const short = data?.statement
    ? `${data.statement.slice(0, 60)}${data.statement.length > 60 ? '…' : ''}`
    : 'Thesis'

  return {
    title: `Edit Thesis · Lobby Market`,
    description: `Edit your civic thesis: "${short}"`,
    robots: { index: false },
  }
}

export default async function ThesisEditPage({ params }: Props) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect(`/sign-in?next=/thesis/${params.id}/edit`)

  const { data: thesis } = await supabase
    .from('civic_theses')
    .select('id, user_id, statement, rationale, category, resolution_date, is_public, status')
    .eq('id', params.id)
    .maybeSingle()

  if (!thesis) notFound()
  if (thesis.user_id !== user.id) notFound()
  if (thesis.status !== 'active') redirect(`/thesis/${params.id}`)

  return (
    <ThesisEditClient
      id={thesis.id}
      initialStatement={thesis.statement}
      initialRationale={thesis.rationale ?? ''}
      initialCategory={thesis.category}
      initialResolutionDate={thesis.resolution_date ?? ''}
      initialIsPublic={thesis.is_public}
    />
  )
}
