import Image from 'next/image'
import { cn } from '@/lib/utils/cn'

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
} as const

type AvatarSize = keyof typeof sizeClasses

interface AvatarProps {
  src?: string | null
  fallback: string
  size?: AvatarSize
  className?: string
}

export function Avatar({ src, fallback, size = 'md', className }: AvatarProps) {
  const initials = fallback
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div
      className={cn(
        'relative rounded-full overflow-hidden flex items-center justify-center flex-shrink-0',
        'bg-surface-300 text-surface-700 font-medium',
        sizeClasses[size],
        className
      )}
    >
      {src ? (
        <Image
          src={src}
          alt={fallback}
          fill
          className="object-cover"
          sizes={size === 'lg' ? '56px' : size === 'md' ? '40px' : '32px'}
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  )
}
