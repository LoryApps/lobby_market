import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { MinisterialStatementDetailClient } from './MinisterialStatementDetailClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()
  const { data: s } = await supabase
    .from('ministerial_statements')
    .select('title, summary, body, department, statement_type')
    .eq('id', params.id)
    .eq('status', 'published')
    .single()

  if (!s) return { title: 'Ministerial Statement · Lobby Market' }

  const desc = s.summary ?? (s.body?.slice(0, 160) ?? '')
  const deptLabel = s.department.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
  const typeLabel = s.statement_type === 'oral' ? 'Oral Statement' : 'Written Statement'

  return {
    title: `${s.title} · Lobby Market`,
    description: `${typeLabel} — ${deptLabel}. ${desc}`,
    openGraph: {
      title: s.title,
      description: `${typeLabel} · ${deptLabel}. ${desc}`,
      type: 'article',
      siteName: 'Lobby Market',
    },
    twitter: {
      card: 'summary',
      title: s.title,
      description: `${typeLabel} · ${deptLabel}`,
    },
  }
}

export default function MinisterialStatementPage({ params }: Props) {
  return <MinisterialStatementDetailClient id={params.id} />
}
