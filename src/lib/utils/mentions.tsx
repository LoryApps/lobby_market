import Link from 'next/link'
import type { ReactNode } from 'react'
import { UserHoverCard } from '@/components/ui/UserHoverCard'

// Capturing group keeps the matched token in the split result array.
const MENTION_SPLIT_RE = /(@[A-Za-z0-9_]{1,30})/g

/**
 * Splits `text` on @mention tokens and returns an array of ReactNodes where
 * each @username becomes a styled, clickable link to `/profile/<username>`.
 * Hovering an @mention shows a mini profile card.
 *
 * Usage:
 *   <p>{renderWithMentions(arg.content)}</p>
 *
 * Because MENTION_SPLIT_RE uses a capturing group, String.split keeps the
 * matched @username parts in the resulting array alongside the plain-text
 * segments, so we can identify and linkify them without a second pass.
 */
export function renderWithMentions(text: string): ReactNode[] {
  const parts = text.split(MENTION_SPLIT_RE)
  return parts.map((part, i) => {
    if (part.startsWith('@') && part.length > 1) {
      const username = part.slice(1)
      return (
        <UserHoverCard key={i} username={username}>
          <Link
            href={`/profile/${username}`}
            className="text-for-400 hover:text-for-300 font-semibold transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </Link>
        </UserHoverCard>
      )
    }
    return part
  })
}

/**
 * Returns true if `text` contains at least one @mention pattern.
 */
export function hasMentions(text: string): boolean {
  return /@[A-Za-z0-9_]{1,30}/.test(text)
}
