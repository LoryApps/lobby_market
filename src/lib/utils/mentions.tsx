import Link from 'next/link'
import type { ReactNode } from 'react'
import { UserHoverCard } from '@/components/ui/UserHoverCard'
import { ExternalLink } from 'lucide-react'

// Capturing groups keep matched tokens in the split result array.
// Order matters: mentions first so @user in a URL doesn't get mis-parsed.
const RICH_SPLIT_RE = /(@[A-Za-z0-9_]{1,30})|(https?:\/\/[^\s<>"'`]+[^\s<>"'`.,;:!?)])/g

/**
 * Splits `text` on @mention tokens and bare https?:// URLs, returning
 * ReactNodes where:
 *   - @username → styled profile link with hover card
 *   - https?://url → external link showing the domain, opens in new tab
 *   - everything else → plain string
 */
export function renderWithMentions(text: string): ReactNode[] {
  // Split on mentions or URLs (capturing groups keep the delimiters)
  const parts = text.split(RICH_SPLIT_RE).filter((p) => p !== undefined && p !== '')

  return parts.map((part, i) => {
    // @mention
    if (/^@[A-Za-z0-9_]{1,30}$/.test(part)) {
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

    // URL
    if (/^https?:\/\//.test(part)) {
      let domain = ''
      try {
        domain = new URL(part).hostname.replace(/^www\./, '')
      } catch {
        domain = part.slice(0, 40)
      }
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-for-400 hover:text-for-300 underline underline-offset-2 decoration-for-500/40 hover:decoration-for-400 transition-colors font-medium"
          onClick={(e) => e.stopPropagation()}
          title={part}
        >
          {domain}
          <ExternalLink className="h-3 w-3 shrink-0 opacity-70" aria-hidden="true" />
        </a>
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
