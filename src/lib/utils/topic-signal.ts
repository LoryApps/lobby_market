/**
 * Topic Relevance Signal
 *
 * Computes a single contextual signal for a topic based on its current state.
 * Used by feed cards, topic lists, and topic detail views to surface what
 * makes a topic notable right now.
 *
 * Signal priority (highest to lowest):
 *   1. Ending Soon   — voting closes in < 6 hours
 *   2. Brink of Law  — 65%+ For in voting phase
 *   3. Deadlock      — near 50/50 with significant vote volume
 *   4. Trending      — feed_score ≥ 1000
 *   5. Gaining Support — proposed topic at ≥ 70% of activation threshold
 *   6. Strong Majority — active topic with 72%+ For
 */

export type SignalId =
  | 'ending_soon'
  | 'brink_of_law'
  | 'deadlock'
  | 'trending'
  | 'gaining_support'
  | 'strong_majority'

export interface TopicSignal {
  id: SignalId
  label: string
  /** Short description for tooltips / screen readers */
  description: string
  /** Color key: used by UI components to pick styles */
  color: 'red' | 'gold' | 'purple' | 'blue' | 'green' | 'for'
}

interface TopicLike {
  status: string
  blue_pct: number
  total_votes: number
  feed_score?: number | null
  support_count?: number | null
  activation_threshold?: number | null
  voting_ends_at?: string | null
}

export function getTopicSignal(topic: TopicLike): TopicSignal | null {
  const forPct = topic.blue_pct ?? 50
  const votes = topic.total_votes ?? 0
  const status = topic.status

  // 1. Ending Soon — voting closes in < 6 hours
  if (status === 'voting' && topic.voting_ends_at) {
    const msLeft = new Date(topic.voting_ends_at).getTime() - Date.now()
    if (msLeft > 0 && msLeft < 6 * 3_600_000) {
      return {
        id: 'ending_soon',
        label: 'Ending Soon',
        description: 'Voting closes in less than 6 hours',
        color: 'red',
      }
    }
  }

  // 2. Brink of Law — 65%+ For in voting phase
  if (status === 'voting' && forPct >= 65) {
    return {
      id: 'brink_of_law',
      label: 'Brink of Law',
      description: 'Strong majority — this topic may soon become law',
      color: 'gold',
    }
  }

  // 3. Deadlock — within 3 points of 50/50 with enough votes to be meaningful
  if ((status === 'active' || status === 'voting') && votes >= 50) {
    if (Math.abs(forPct - 50) <= 3) {
      return {
        id: 'deadlock',
        label: 'Deadlock',
        description: 'Nearly split down the middle — your vote could tip it',
        color: 'purple',
      }
    }
  }

  // 4. Trending — high algorithmic score
  if ((topic.feed_score ?? 0) >= 1000) {
    return {
      id: 'trending',
      label: 'Trending',
      description: 'Gaining rapid attention in the Lobby',
      color: 'blue',
    }
  }

  // 5. Gaining Support — proposed topic nearing activation threshold
  const threshold = topic.activation_threshold ?? 0
  const support = topic.support_count ?? 0
  if (status === 'proposed' && threshold > 0 && support / threshold >= 0.7) {
    return {
      id: 'gaining_support',
      label: 'Gaining Support',
      description: 'Close to activating — support it to push it live',
      color: 'green',
    }
  }

  // 6. Strong Majority — active topic with clear direction
  if (status === 'active' && votes >= 100 && forPct >= 72) {
    return {
      id: 'strong_majority',
      label: 'Strong Majority',
      description: 'The Lobby is leaning heavily one way',
      color: 'for',
    }
  }

  return null
}

/** Tailwind class bundles keyed by signal color for pill rendering */
export const SIGNAL_PILL_CLASSES: Record<
  NonNullable<TopicSignal>['color'],
  { pill: string; dot: string }
> = {
  red:    { pill: 'bg-against-500/15 border-against-500/40 text-against-300', dot: 'bg-against-400' },
  gold:   { pill: 'bg-gold/15 border-gold/40 text-gold',                      dot: 'bg-gold' },
  purple: { pill: 'bg-purple/15 border-purple/40 text-purple',                dot: 'bg-purple' },
  blue:   { pill: 'bg-for-500/15 border-for-500/40 text-for-300',             dot: 'bg-for-400' },
  green:  { pill: 'bg-emerald/15 border-emerald/40 text-emerald',             dot: 'bg-emerald' },
  for:    { pill: 'bg-for-600/15 border-for-600/40 text-for-400',             dot: 'bg-for-500' },
}
