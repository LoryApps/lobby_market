import Image from 'next/image'
import { cn } from '@/lib/utils/cn'

const sizeClasses = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
} as const

type AvatarSize = keyof typeof sizeClasses

function resolveSize(size: AvatarSize | number | undefined): AvatarSize {
  if (typeof size === 'string') return size
  if (!size || size <= 20) return 'xs'
  if (size <= 34) return 'sm'
  if (size <= 46) return 'md'
  return 'lg'
}

export interface AvatarProps {
  src?: string | null
  /** Image URL alias (deprecated: use src) */
  avatarUrl?: string | null
  /** Text for initials fallback */
  fallback?: string
  /** Alias for fallback (deprecated) */
  name?: string
  /** Alias for fallback (deprecated) */
  username?: string
  /** Alias for fallback (deprecated) */
  alt?: string
  size?: AvatarSize | number
  className?: string
}

export function Avatar({ src, avatarUrl, fallback, name, username, alt, size, className }: AvatarProps) {
  const resolvedSrc = src ?? avatarUrl ?? null
  const resolvedFallback = fallback ?? name ?? username ?? alt ?? ''
  const initials = resolvedFallback
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
  const sizeKey = resolveSize(size)

  return (
    <div
      className={cn(
        'relative rounded-full overflow-hidden flex items-center justify-center flex-shrink-0',
        'bg-surface-300 text-surface-700 font-medium',
        sizeClasses[sizeKey],
        className
      )}
    >
      {resolvedSrc ? (
        <Image
          src={resolvedSrc}
          alt={resolvedFallback}
          fill
          className="object-cover"
          sizes={sizeKey === 'lg' ? '56px' : sizeKey === 'md' ? '40px' : sizeKey === 'sm' ? '32px' : '24px'}
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  )
}
