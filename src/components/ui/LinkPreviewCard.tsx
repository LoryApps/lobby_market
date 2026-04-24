'use client'

/**
 * LinkPreviewCard
 *
 * Fetches Open Graph / Twitter Card metadata for a URL via /api/link-preview
 * and renders a compact preview card (title, description, domain, optional image).
 *
 * - Renders nothing while loading or if the fetch fails with no usable data.
 * - Images are lazy-loaded and hidden on error.
 * - Clicking the card opens the URL in a new tab.
 */

import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { LinkPreviewData } from '@/app/api/link-preview/route'

interface LinkPreviewCardProps {
  url: string
  className?: string
}

// Simple module-level cache so the same URL isn't fetched twice per session.
const previewCache = new Map<string, LinkPreviewData | null>()

export function LinkPreviewCard({ url, className }: LinkPreviewCardProps) {
  const [data, setData] = useState<LinkPreviewData | null>(
    previewCache.has(url) ? previewCache.get(url)! : null
  )
  const [loading, setLoading] = useState(!previewCache.has(url))
  const [imgError, setImgError] = useState(false)

  useEffect(() => {
    if (previewCache.has(url)) return
    let cancelled = false

    async function load() {
      try {
        const res = await fetch(
          `/api/link-preview?url=${encodeURIComponent(url)}`,
          { cache: 'force-cache' }
        )
        if (!res.ok || cancelled) return
        const json = (await res.json()) as LinkPreviewData
        if (!cancelled) {
          previewCache.set(url, json)
          setData(json)
        }
      } catch {
        previewCache.set(url, null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [url])

  if (loading) {
    return (
      <div
        className={cn(
          'mt-2 rounded-xl border border-surface-300 bg-surface-200/40 px-3.5 py-2.5 animate-pulse',
          className
        )}
      >
        <div className="h-3 w-32 rounded bg-surface-300/60 mb-1.5" />
        <div className="h-2.5 w-48 rounded bg-surface-300/40" />
      </div>
    )
  }

  // If we have no data at all, don't render
  if (!data || (!data.title && !data.description)) return null

  const hasImage = !!data.image && !imgError

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'mt-2 flex items-start gap-3 rounded-xl border border-surface-300 bg-surface-200/50',
        'px-3.5 py-3 transition-colors hover:border-for-500/30 hover:bg-surface-200',
        'group no-underline',
        className
      )}
    >
      {/* Thumbnail */}
      {hasImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={data.image!}
          alt=""
          width={56}
          height={56}
          className="h-14 w-14 shrink-0 rounded-lg object-cover bg-surface-300"
          onError={() => setImgError(true)}
          loading="lazy"
        />
      )}

      {/* Text content */}
      <div className="min-w-0 flex-1">
        {/* Domain + site name */}
        <div className="flex items-center gap-1 mb-0.5">
          {data.favicon && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.favicon}
              alt=""
              width={12}
              height={12}
              className="h-3 w-3 rounded shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              loading="lazy"
            />
          )}
          <span className="text-[11px] font-mono text-surface-500 truncate">
            {data.siteName ?? data.domain}
          </span>
          <ExternalLink
            className="h-2.5 w-2.5 text-surface-600 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            aria-hidden="true"
          />
        </div>

        {/* Title */}
        {data.title && (
          <p className="text-[13px] font-semibold text-white leading-snug line-clamp-2 group-hover:text-for-300 transition-colors">
            {data.title}
          </p>
        )}

        {/* Description */}
        {data.description && (
          <p className="mt-0.5 text-[11px] text-surface-500 line-clamp-2 leading-relaxed">
            {data.description}
          </p>
        )}
      </div>
    </a>
  )
}
