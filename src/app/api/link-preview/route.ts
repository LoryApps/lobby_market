import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Cache previews at the CDN for 1 hour
export const revalidate = 3600

const FETCH_TIMEOUT_MS = 5000
const MAX_RESPONSE_BYTES = 150_000 // read at most 150 KB of HTML

// Only allow http/https to prevent SSRF via other schemes
const ALLOWED_PROTOCOLS = new Set(['https:', 'http:'])

// Block internal/private IP ranges to prevent SSRF
function isPrivateUrl(url: URL): boolean {
  const h = url.hostname
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '::1' ||
    h.startsWith('192.168.') ||
    h.startsWith('10.') ||
    h.startsWith('172.16.') ||
    h.endsWith('.local') ||
    h.endsWith('.internal')
  )
}

function extractMeta(html: string, property: string): string | null {
  // Handles both property= and name= variants
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']|` +
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`,
    'i'
  )
  const m = html.match(re)
  return m ? (m[1] ?? m[2] ?? null) : null
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  return m ? m[1].trim() : null
}

function extractFavicon(html: string, base: URL): string | null {
  const m = html.match(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i)
  if (!m) return null
  try {
    return new URL(m[1], base.origin).href
  } catch {
    return null
  }
}

export interface LinkPreviewData {
  url: string
  title: string | null
  description: string | null
  image: string | null
  siteName: string | null
  favicon: string | null
  domain: string
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const rawUrl = searchParams.get('url')

  if (!rawUrl) {
    return NextResponse.json({ error: 'Missing url param' }, { status: 400 })
  }

  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    return NextResponse.json({ error: 'Unsupported protocol' }, { status: 400 })
  }

  if (isPrivateUrl(parsed)) {
    return NextResponse.json({ error: 'Private URL' }, { status: 400 })
  }

  const domain = parsed.hostname.replace(/^www\./, '')

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    let html = ''
    try {
      const res = await fetch(rawUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'LobbyMarket/1.0 (+https://lobby.market; link preview bot)',
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en',
        },
      })

      clearTimeout(timeout)

      if (!res.ok) {
        // Return minimal data so the card can still show the domain
        return NextResponse.json({
          url: rawUrl,
          title: null,
          description: null,
          image: null,
          siteName: null,
          favicon: null,
          domain,
        } satisfies LinkPreviewData, {
          headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
        })
      }

      // Only read HTML — skip large files or binary content
      const contentType = res.headers.get('content-type') ?? ''
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
        clearTimeout(timeout)
        return NextResponse.json({
          url: rawUrl,
          title: null,
          description: null,
          image: null,
          siteName: null,
          favicon: null,
          domain,
        } satisfies LinkPreviewData, {
          headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
        })
      }

      // Read at most MAX_RESPONSE_BYTES to avoid parsing huge pages
      const reader = res.body?.getReader()
      if (reader) {
        let bytes = 0
        const chunks: Uint8Array[] = []
        while (bytes < MAX_RESPONSE_BYTES) {
          const { done, value } = await reader.read()
          if (done || !value) break
          chunks.push(value)
          bytes += value.length
          // Stop early once we've seen </head> — OG tags are in <head>
          const partial = new TextDecoder().decode(value)
          if (partial.includes('</head>') || partial.includes('<body')) break
        }
        reader.cancel()
        html = new TextDecoder().decode(
          chunks.reduce((acc, c) => {
            const merged = new Uint8Array(acc.length + c.length)
            merged.set(acc)
            merged.set(c, acc.length)
            return merged
          }, new Uint8Array(0))
        )
      }
    } finally {
      clearTimeout(timeout)
    }

    const ogTitle = extractMeta(html, 'og:title')
    const ogDesc = extractMeta(html, 'og:description')
    const ogImage = extractMeta(html, 'og:image')
    const ogSite = extractMeta(html, 'og:site_name')
    const twitterTitle = extractMeta(html, 'twitter:title')
    const twitterDesc = extractMeta(html, 'twitter:description')
    const twitterImage = extractMeta(html, 'twitter:image')
    const metaDesc = extractMeta(html, 'description')
    const htmlTitle = extractTitle(html)
    const favicon = extractFavicon(html, parsed)

    const data: LinkPreviewData = {
      url: rawUrl,
      title: ogTitle ?? twitterTitle ?? htmlTitle,
      description: ogDesc ?? twitterDesc ?? metaDesc,
      image: ogImage ?? twitterImage ?? null,
      siteName: ogSite,
      favicon,
      domain,
    }

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
    })
  } catch {
    // Timeout or network error — return minimal fallback
    return NextResponse.json({
      url: rawUrl,
      title: null,
      description: null,
      image: null,
      siteName: null,
      favicon: null,
      domain,
    } satisfies LinkPreviewData, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    })
  }
}
