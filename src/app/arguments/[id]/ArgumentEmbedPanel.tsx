'use client'

import { useState } from 'react'
import { Check, Code2, Copy } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface ArgumentEmbedPanelProps {
  argumentId: string
  isFor: boolean
}

export function ArgumentEmbedPanel({ argumentId, isFor }: ArgumentEmbedPanelProps) {
  const [copied, setCopied] = useState(false)

  const iframeSrc = `https://lobby.market/api/embed/argument/${argumentId}`
  const embedCode = `<iframe
  src="${iframeSrc}"
  width="480"
  height="260"
  frameborder="0"
  scrolling="no"
  style="border-radius:14px;overflow:hidden;"
  title="Lobby Market — Civic Argument"
  loading="lazy"
></iframe>`

  async function copy() {
    try {
      await navigator.clipboard.writeText(embedCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard unavailable — silently skip
    }
  }

  const accentColor = isFor ? 'text-for-400' : 'text-against-400'
  const accentBorder = isFor ? 'border-for-500/30' : 'border-against-500/30'
  const accentBg = isFor ? 'bg-for-500/5' : 'bg-against-500/5'
  const btnBg = isFor
    ? 'bg-for-500/10 hover:bg-for-500/20 border-for-500/30 text-for-400'
    : 'bg-against-500/10 hover:bg-against-500/20 border-against-500/30 text-against-400'

  return (
    <div
      className={cn(
        'rounded-2xl border overflow-hidden mb-6',
        accentBorder,
        accentBg,
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-surface-300/60">
        <Code2 className={cn('h-3.5 w-3.5', accentColor)} aria-hidden />
        <span className="text-xs font-mono font-semibold text-surface-600 uppercase tracking-wide">
          Embed this argument
        </span>
      </div>

      {/* Code block */}
      <div className="relative">
        <pre
          className="overflow-x-auto px-4 py-3 text-[11px] leading-relaxed font-mono text-surface-500 whitespace-pre"
          aria-label="Iframe embed code"
        >
          {embedCode}
        </pre>
        <button
          onClick={copy}
          className={cn(
            'absolute top-2 right-2 flex items-center gap-1.5',
            'px-2.5 py-1.5 rounded-lg border text-[10px] font-mono font-bold',
            'transition-colors duration-150',
            btnBg,
          )}
          aria-label={copied ? 'Copied!' : 'Copy embed code'}
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              Copy
            </>
          )}
        </button>
      </div>

      <p className="px-4 pb-3 text-[10px] font-mono text-surface-600">
        Paste into any webpage to display this argument as a live card.
      </p>
    </div>
  )
}
