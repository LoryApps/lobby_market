// Shared config for the Graveyard feature — safe to import in both
// client components and API routes.

export type CauseOfDeath =
  | 'decisively_rejected'
  | 'voted_down'
  | 'narrowly_defeated'
  | 'close_but_not_enough'
  | 'never_rallied'

export interface CauseInfo {
  id: CauseOfDeath
  label: string
  description: string
  color: string
  bg: string
  border: string
}

export const CAUSE_CONFIG: Record<CauseOfDeath, CauseInfo> = {
  decisively_rejected: {
    id: 'decisively_rejected',
    label: 'Decisively Rejected',
    description: 'Voted down by an overwhelming majority',
    color: 'text-against-400',
    bg: 'bg-against-500/15',
    border: 'border-against-500/40',
  },
  voted_down: {
    id: 'voted_down',
    label: 'Voted Down',
    description: 'Clear majority voted against',
    color: 'text-against-300',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
  },
  narrowly_defeated: {
    id: 'narrowly_defeated',
    label: 'Narrowly Defeated',
    description: 'Lost by the thinnest of margins',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
  },
  close_but_not_enough: {
    id: 'close_but_not_enough',
    label: 'Majority — Not Enough',
    description: 'Majority supported it, but fell short of the consensus threshold',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
  },
  never_rallied: {
    id: 'never_rallied',
    label: 'Never Rallied',
    description: 'Failed to build enough momentum',
    color: 'text-surface-500',
    bg: 'bg-surface-300/10',
    border: 'border-surface-300/30',
  },
}

export function causeOfDeath(bluePct: number, totalVotes: number): CauseOfDeath {
  if (totalVotes < 10) return 'never_rallied'
  if (bluePct < 30) return 'decisively_rejected'
  if (bluePct < 45) return 'voted_down'
  if (bluePct < 50) return 'narrowly_defeated'
  return 'close_but_not_enough'
}
