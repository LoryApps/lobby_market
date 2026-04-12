import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TopicDetail } from '@/components/topic/TopicDetail'
import type { Topic, Profile } from '@/lib/supabase/types'

interface TopicPageProps {
  params: { id: string }
}

export default async function TopicPage({ params }: TopicPageProps) {
  const supabase = await createClient()

  const { data: topic, error } = await supabase
    .from('topics')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !topic) {
    notFound()
  }

  const { data: author } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', topic.author_id)
    .single()

  return (
    <TopicDetail
      initialTopic={topic as Topic}
      author={(author as Profile) ?? null}
    />
  )
}
