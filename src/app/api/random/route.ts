import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type RandomTarget = 'topic' | 'law' | 'argument' | 'citizen' | 'debate'

export async function GET(req: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const target = (searchParams.get('type') ?? 'topic') as RandomTarget

  switch (target) {
    case 'topic': {
      // Pick a random active topic (weighted toward higher-vote topics)
      const { data } = await supabase
        .from('topics')
        .select('id')
        .in('status', ['active', 'voting'])
        .gte('total_votes', 1)
        .order('total_votes', { ascending: false })
        .limit(100)

      if (!data || data.length === 0) break
      const picked = data[Math.floor(Math.random() * data.length)]
      return NextResponse.json({ redirect: `/topic/${picked.id}` })
    }

    case 'law': {
      const { data } = await supabase
        .from('laws')
        .select('id')
        .order('established_at', { ascending: false })
        .limit(100)

      if (!data || data.length === 0) break
      const picked = data[Math.floor(Math.random() * data.length)]
      return NextResponse.json({ redirect: `/law/${picked.id}` })
    }

    case 'argument': {
      const { data } = await supabase
        .from('arguments')
        .select('id, topic_id')
        .gte('upvotes', 1)
        .order('upvotes', { ascending: false })
        .limit(200)

      if (!data || data.length === 0) break
      const picked = data[Math.floor(Math.random() * Math.min(data.length, 50))]
      return NextResponse.json({ redirect: `/topic/${picked.topic_id}/arguments` })
    }

    case 'citizen': {
      const { data } = await supabase
        .from('profiles')
        .select('username')
        .neq('id', user.id)
        .gte('clout', 5)
        .not('username', 'is', null)
        .order('clout', { ascending: false })
        .limit(100)

      if (!data || data.length === 0) break
      const picked = data[Math.floor(Math.random() * data.length)]
      return NextResponse.json({ redirect: `/profile/${picked.username}` })
    }

    case 'debate': {
      const { data } = await supabase
        .from('debates')
        .select('id')
        .in('status', ['scheduled', 'live'])
        .order('scheduled_at', { ascending: true })
        .limit(20)

      if (!data || data.length === 0) {
        // Fallback to past debates
        const { data: past } = await supabase
          .from('debates')
          .select('id')
          .eq('status', 'completed')
          .order('scheduled_at', { ascending: false })
          .limit(50)
        if (!past || past.length === 0) break
        const picked = past[Math.floor(Math.random() * past.length)]
        return NextResponse.json({ redirect: `/debate/${picked.id}` })
      }
      const picked = data[Math.floor(Math.random() * data.length)]
      return NextResponse.json({ redirect: `/debate/${picked.id}` })
    }
  }

  // Ultimate fallback
  return NextResponse.json({ redirect: '/discover' })
}
