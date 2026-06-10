'use client'

import { useState } from 'react'
import { Check, Share2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface VerdictShareProps {
  title: string
  url: string
}

export function VerdictShare({ title, url }: VerdictShareProps) {
  const [copied, setCopied] = useState(false)

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title, url })
        return
      } catch {
        // fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // silent
    }
  }

  return (
    <button
      onClick={handleShare}
      aria-label="Share debate verdict"
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono font-semibold transition-all',
        copied
          ? 'bg-emerald/10 border-emerald/30 text-emerald'
          : 'bg-surface-200/60 border-surface-300/60 text-surface-500 hover:text-white hover:border-surface-400/60'
      )}
    >
      {copied ? (
        <><Check className="h-3.5 w-3.5" />Copied</>
      ) : (
        <><Share2 className="h-3.5 w-3.5" />Share Verdict</>
      )}
    </button>
  )
}
