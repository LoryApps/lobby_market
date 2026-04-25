export interface StreakTier {
  label: string
  color: string
  bg: string
  border: string
  glow: string
  min: number
}

export function streakTier(days: number): StreakTier {
  if (days >= 100) return { label: 'Legendary',    color: 'text-gold',         bg: 'bg-gold/15',        border: 'border-gold/40',      glow: 'shadow-[0_0_12px_rgba(201,168,76,0.35)]', min: 100 }
  if (days >= 60)  return { label: 'Transcendent', color: 'text-purple',       bg: 'bg-purple/15',      border: 'border-purple/40',    glow: 'shadow-[0_0_10px_rgba(139,92,246,0.3)]',  min: 60  }
  if (days >= 30)  return { label: 'Diamond',      color: 'text-for-300',      bg: 'bg-for-500/15',     border: 'border-for-500/40',   glow: 'shadow-[0_0_8px_rgba(59,130,246,0.25)]',  min: 30  }
  if (days >= 14)  return { label: 'Blazing',      color: 'text-emerald',      bg: 'bg-emerald/10',     border: 'border-emerald/30',   glow: '',                                        min: 14  }
  if (days >= 7)   return { label: 'Hot',          color: 'text-against-300',  bg: 'bg-against-500/10', border: 'border-against-500/30', glow: '',                                      min: 7   }
  if (days >= 3)   return { label: 'Active',       color: 'text-surface-400',  bg: 'bg-surface-300/10', border: 'border-surface-400/20', glow: '',                                      min: 3   }
  return             { label: 'Starting',      color: 'text-surface-500',  bg: 'bg-surface-300/5',  border: 'border-surface-500/10', glow: '',                                      min: 1   }
}
