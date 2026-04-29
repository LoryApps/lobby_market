'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface ShareCardButtonProps {
  cardUrl: string
  twitterUrl: string
  displayName: string
}

export function ShareCardButton({ cardUrl, twitterUrl, displayName }: ShareCardButtonProps) {
  const [copied, setCopied] = useState(false)

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(cardUrl)
    } catch {
      const el = document.createElement('input')
      el.value = cardUrl
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex gap-2 flex-1">
      {/* Copy link */}
      <button
        onClick={copyLink}
        className={cn(
          'flex-1 inline-flex items-center justify-center gap-1.5',
          'h-9 rounded-xl text-xs font-mono font-semibold transition-all',
          copied
            ? 'bg-emerald/20 border border-emerald/40 text-emerald'
            : 'bg-for-600/80 border border-for-500/60 text-white hover:bg-for-500',
        )}
        aria-label="Copy card link"
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" />
            Copy Link
          </>
        )}
      </button>

      {/* X / Twitter share */}
      <a
        href={twitterUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'inline-flex items-center justify-center',
          'h-9 w-9 rounded-xl flex-shrink-0',
          'bg-surface-200 border border-surface-300 text-surface-400',
          'hover:bg-[#1d9bf0]/10 hover:border-[#1d9bf0]/40 hover:text-[#1d9bf0]',
          'transition-colors',
        )}
        aria-label={`Share ${displayName}'s civic card on X`}
        title="Share on X"
      >
        {/* X logo SVG */}
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      </a>
    </div>
  )
}
