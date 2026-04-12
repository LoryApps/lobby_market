import { Activity, CheckCircle, Flag, Shield } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface ModerationStatsProps {
  pendingCount: number
  resolvedCount: number
  dismissedCount: number
  escalatedCount: number
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  tone: 'gold' | 'emerald' | 'for' | 'against'
}) {
  const toneClasses = {
    gold: 'text-gold bg-gold/10 border-gold/30',
    emerald: 'text-emerald bg-emerald/10 border-emerald/30',
    for: 'text-for-400 bg-for-500/10 border-for-500/30',
    against: 'text-against-400 bg-against-500/10 border-against-500/30',
  }
  return (
    <div className="rounded-xl border border-surface-300 bg-surface-100 p-4">
      <div className="flex items-center gap-2">
        <div
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg border',
            toneClasses[tone]
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-[10px] font-mono uppercase tracking-wider text-surface-500">
          {label}
        </span>
      </div>
      <div className="mt-2 font-mono text-2xl font-bold text-white tabular-nums">
        {value.toLocaleString()}
      </div>
    </div>
  )
}

export function ModerationStats({
  pendingCount,
  resolvedCount,
  dismissedCount,
  escalatedCount,
}: ModerationStatsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard
        label="Pending"
        value={pendingCount}
        icon={Flag}
        tone="gold"
      />
      <StatCard
        label="Resolved"
        value={resolvedCount}
        icon={CheckCircle}
        tone="emerald"
      />
      <StatCard
        label="Dismissed"
        value={dismissedCount}
        icon={Activity}
        tone="for"
      />
      <StatCard
        label="Escalated"
        value={escalatedCount}
        icon={Shield}
        tone="against"
      />
    </div>
  )
}
