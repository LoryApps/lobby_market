'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Share2, Link2, Check, Code2, ExternalLink } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils/cn'

const BASE_URL = 'https://lobby.market'

interface SharePanelProps {
  /** Full canonical URL to share */
  url: string
  /** Short text for the tweet / share message */
  text: string
  /**
   * When provided, a "Copy embed code" option appears in the dropdown.
   * Should be the topic ID — the embed API path is constructed internally
   * as /api/embed/topic/<topicId>.
   */
  topicId?: string
  /** Optional additional className for the root wrapper */
  className?: string
}

export function SharePanel({ url, text, topicId, className }: SharePanelProps) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [embedCopied, setEmbedCopied] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const embedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  async function handleShare() {
    // Try native share first (works on mobile)
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: text, url })
        return
      } catch {
        // User cancelled or not supported — fall through to panel
      }
    }
    setOpen((v) => !v)
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      if (copyTimer.current) clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: select text
    }
  }

  function handleTweet() {
    const tweetText = encodeURIComponent(`${text}\n\n${url}`)
    window.open(`https://twitter.com/intent/tweet?text=${tweetText}`, '_blank', 'noopener,noreferrer')
    setOpen(false)
  }

  async function handleCopyEmbed() {
    if (!topicId) return
    const embedSrc = `${BASE_URL}/api/embed/topic/${topicId}`
    const code = [
      `<iframe`,
      `  src="${embedSrc}"`,
      `  width="420"`,
      `  height="230"`,
      `  frameborder="0"`,
      `  scrolling="no"`,
      `  title="Lobby Market Vote Widget"`,
      `  style="border-radius:14px;overflow:hidden;display:block"`,
      `></iframe>`,
    ].join('\n')
    try {
      await navigator.clipboard.writeText(code)
      setEmbedCopied(true)
      if (embedTimer.current) clearTimeout(embedTimer.current)
      embedTimer.current = setTimeout(() => setEmbedCopied(false), 2500)
    } catch {
      // ignore
    }
  }

  return (
    <div ref={panelRef} className={cn('relative', className)}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={handleShare}
        aria-label="Share"
        aria-expanded={open}
        className={cn(
          'flex items-center justify-center h-9 w-9 rounded-lg',
          'bg-surface-200 text-surface-500',
          'hover:bg-surface-300 hover:text-white',
          'transition-colors focus:outline-none focus:ring-2 focus:ring-for-500/40',
          open && 'bg-surface-300 text-white'
        )}
      >
        <Share2 className="h-4 w-4" />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.12 }}
            className={cn(
              'absolute right-0 top-full mt-2 z-50',
              topicId ? 'w-56' : 'w-48',
              'rounded-xl border border-surface-300 bg-surface-100 shadow-xl',
              'overflow-hidden'
            )}
            role="menu"
            aria-label="Share options"
          >
            {/* Header */}
            <div className="px-3 py-2 border-b border-surface-300">
              <span className="text-[10px] font-mono uppercase tracking-widest text-surface-500">
                Share
              </span>
            </div>

            {/* Copy link */}
            <button
              type="button"
              role="menuitem"
              onClick={handleCopyLink}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                'text-white hover:bg-surface-200'
              )}
            >
              {copied ? (
                <Check className="h-4 w-4 text-emerald flex-shrink-0" />
              ) : (
                <Link2 className="h-4 w-4 text-surface-500 flex-shrink-0" />
              )}
              <span className={cn(copied && 'text-emerald')}>
                {copied ? 'Copied!' : 'Copy link'}
              </span>
            </button>

            {/* Tweet / Post on X */}
            <button
              type="button"
              role="menuitem"
              onClick={handleTweet}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-surface-200 transition-colors"
            >
              {/* X (formerly Twitter) logo */}
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4 text-surface-500 flex-shrink-0 fill-current"
                aria-hidden="true"
              >
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.261 5.633 5.902-5.633zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              Post on X
            </button>

            {/* Share card + embed — only rendered when topicId is provided */}
            {topicId && (
              <>
                <div className="border-t border-surface-300" />
                {/* Topic share card link */}
                <Link
                  href={`/share/topic/${topicId}`}
                  role="menuitem"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-surface-200 transition-colors"
                >
                  <ExternalLink className="h-4 w-4 text-surface-500 flex-shrink-0" aria-hidden="true" />
                  Share card
                </Link>
                {/* Embed code */}
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleCopyEmbed}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                    'text-white hover:bg-surface-200'
                  )}
                >
                  {embedCopied ? (
                    <Check className="h-4 w-4 text-emerald flex-shrink-0" />
                  ) : (
                    <Code2 className="h-4 w-4 text-surface-500 flex-shrink-0" />
                  )}
                  <span className={cn(embedCopied && 'text-emerald')}>
                    {embedCopied ? 'Embed copied!' : 'Copy embed code'}
                  </span>
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
