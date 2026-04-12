import { cn } from '@/lib/utils/cn'

type PulseColor = 'red' | 'green' | 'blue' | 'gold'

interface PulseDotProps {
  color?: PulseColor
  className?: string
}

const colorMap: Record<PulseColor, { bg: string; ring: string }> = {
  red: { bg: 'bg-against-500', ring: 'bg-against-500' },
  green: { bg: 'bg-emerald', ring: 'bg-emerald' },
  blue: { bg: 'bg-for-500', ring: 'bg-for-500' },
  gold: { bg: 'bg-gold', ring: 'bg-gold' },
}

export function PulseDot({ color = 'red', className }: PulseDotProps) {
  const c = colorMap[color]
  return (
    <span
      className={cn(
        'relative inline-flex h-2.5 w-2.5 items-center justify-center',
        className
      )}
      aria-hidden="true"
    >
      <span
        className={cn(
          'absolute inset-0 rounded-full animate-pulse-ring',
          c.ring
        )}
      />
      <span
        className={cn('relative h-2.5 w-2.5 rounded-full', c.bg)}
      />
    </span>
  )
}
