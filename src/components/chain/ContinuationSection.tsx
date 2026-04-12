'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type {
  Topic,
  ContinuationWithAuthor,
  Profile,
  UserRole,
} from '@/lib/supabase/types'
import { ContinuationForm } from './ContinuationForm'
import { ContinuationList } from './ContinuationList'
import { ContinuationVote } from './ContinuationVote'

interface ContinuationSectionProps {
  topic: Topic
}

const DEBATOR_ROLES: UserRole[] = ['debator', 'troll_catcher', 'elder']

type ChainPhase = 'authoring' | 'voting' | 'idle'

function getPhase(topic: Topic): ChainPhase {
  const now = Date.now()
  if (
    topic.status === 'voting' &&
    topic.continuation_vote_ends_at &&
    new Date(topic.continuation_vote_ends_at).getTime() > now
  ) {
    return 'voting'
  }
  if (
    topic.status === 'continued' &&
    topic.continuation_window_ends_at &&
    new Date(topic.continuation_window_ends_at).getTime() > now
  ) {
    return 'authoring'
  }
  return 'idle'
}

export function ContinuationSection({ topic }: ContinuationSectionProps) {
  const [continuations, setContinuations] = useState<ContinuationWithAuthor[]>(
    []
  )
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<UserRole | null>(null)

  const phase = getPhase(topic)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/topics/${topic.id}/continuations`, {
        cache: 'no-store',
      })
      if (!res.ok) return
      const body = (await res.json()) as {
        continuations: ContinuationWithAuthor[]
      }
      setContinuations(body.continuations ?? [])
    } catch (err) {
      console.error('Failed to load continuations:', err)
    } finally {
      setLoading(false)
    }
  }, [topic.id])

  // Load the viewer's role so we know whether to show the authoring form.
  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    supabase.auth.getUser().then(({ data }) => {
      if (cancelled || !data.user) {
        return
      }
      supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle()
        .then(({ data: profile }: { data: Pick<Profile, 'role'> | null }) => {
          if (!cancelled && profile) setUserRole(profile.role)
        })
    })

    return () => {
      cancelled = true
    }
  }, [])

  // Initial load + realtime subscription
  useEffect(() => {
    void refresh()

    const supabase = createClient()
    const channel = supabase
      .channel(`continuations-${topic.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'continuations',
          filter: `topic_id=eq.${topic.id}`,
        },
        () => {
          void refresh()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [topic.id, refresh])

  const isDebator = userRole ? DEBATOR_ROLES.includes(userRole) : false
  const finalists = useMemo(
    () =>
      continuations.filter(
        (c) => c.status === 'finalist' || c.status === 'winner'
      ),
    [continuations]
  )

  if (phase === 'voting' && topic.continuation_vote_ends_at) {
    return (
      <ContinuationVote
        topicId={topic.id}
        topicStatement={topic.statement}
        finalists={finalists.length > 0 ? finalists : continuations.slice(0, 5)}
        votingEndsAt={topic.continuation_vote_ends_at}
      />
    )
  }

  return (
    <div className="space-y-4">
      {phase === 'authoring' && isDebator && (
        <ContinuationForm
          topicId={topic.id}
          topic={topic}
          onSubmit={() => void refresh()}
        />
      )}
      {loading ? (
        <div className="h-24 animate-pulse rounded-2xl bg-surface-200/40" />
      ) : (
        <ContinuationList
          topicId={topic.id}
          topicStatement={topic.statement}
          continuations={continuations}
          authoringActive={phase === 'authoring'}
        />
      )}
    </div>
  )
}
