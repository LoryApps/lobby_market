import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  proposed: 'PROPOSED',
  active: 'ACTIVE',
  voting: 'VOTING',
  law: 'ESTABLISHED LAW',
  failed: 'FAILED',
}

const STATUS_COLOR: Record<string, string> = {
  proposed: '#6b7280',
  active: '#10b981',
  voting: '#a78bfa',
  law: '#c9a84c',
  failed: '#6b7280',
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()

    const { data: arg } = await supabase
      .from('topic_arguments')
      .select('id, content, side, upvotes, user_id, topic_id')
      .eq('id', params.id)
      .single()

    if (!arg) {
      return new Response('Not found', { status: 404 })
    }

    const [topicRes, profileRes] = await Promise.all([
      supabase
        .from('topics')
        .select('statement, category, status')
        .eq('id', arg.topic_id)
        .single(),
      supabase
        .from('profiles')
        .select('username, display_name')
        .eq('id', arg.user_id)
        .maybeSingle(),
    ])

    const topic = topicRes.data
    const author = profileRes.data

    const isFor = arg.side === 'blue'
    const sideLabel = isFor ? 'FOR' : 'AGAINST'
    const sideColor = isFor ? '#60a5fa' : '#f87171'
    const sideBg = isFor ? 'rgba(59,130,246,0.08)' : 'rgba(239,68,68,0.08)'
    const sideBorder = isFor ? 'rgba(59,130,246,0.3)' : 'rgba(239,68,68,0.3)'
    const sideGlow = isFor
      ? 'rgba(59,130,246,0.12)'
      : 'rgba(239,68,68,0.10)'

    const topicStatement = topic?.statement ?? 'Topic'
    const category = topic?.category ?? null
    const status = topic?.status ?? 'active'
    const statusLabel = STATUS_LABEL[status] ?? status.toUpperCase()
    const statusColor = STATUS_COLOR[status] ?? '#6b7280'
    const authorName = author?.display_name || (author?.username ? `@${author.username}` : 'Anonymous')
    const content = arg.content

    // Truncate for display
    const truncatedContent =
      content.length > 220 ? content.slice(0, 219) + '…' : content
    const truncatedTopic =
      topicStatement.length > 100 ? topicStatement.slice(0, 99) + '…' : topicStatement

    const contentFontSize = content.length > 140 ? 22 : content.length > 80 ? 26 : 30

    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '1200px',
            height: '630px',
            backgroundColor: '#0d0f14',
            padding: '56px 64px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Background glow */}
          <div
            style={{
              position: 'absolute',
              top: '-80px',
              right: '-80px',
              width: '500px',
              height: '500px',
              borderRadius: '50%',
              background: `radial-gradient(circle, ${sideGlow} 0%, transparent 70%)`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '-80px',
              left: '-80px',
              width: '400px',
              height: '400px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(30,30,50,0.6) 0%, transparent 70%)',
            }}
          />

          {/* Top bar: Lobby Market wordmark + status */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '36px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: sideColor,
                  boxShadow: `0 0 12px ${sideColor}`,
                }}
              />
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: '14px',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: '#6b7280',
                }}
              >
                LOBBY MARKET
              </span>
            </div>

            {/* Topic status pill */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                borderRadius: '9999px',
                border: `1px solid ${statusColor}40`,
                background: `${statusColor}12`,
              }}
            >
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color: statusColor,
                }}
              >
                {statusLabel}
              </span>
            </div>
          </div>

          {/* Side badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '20px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 16px',
                borderRadius: '9999px',
                border: `1px solid ${sideBorder}`,
                background: sideBg,
              }}
            >
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: sideColor,
                }}
              />
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  color: sideColor,
                }}
              >
                {sideLabel}
              </span>
            </div>
            {category && (
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  color: '#52525b',
                  letterSpacing: '0.05em',
                }}
              >
                {category.toUpperCase()}
              </span>
            )}
          </div>

          {/* Argument content */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'flex-start',
              marginBottom: '28px',
            }}
          >
            <span
              style={{
                fontFamily: 'system-ui, sans-serif',
                fontSize: `${contentFontSize}px`,
                fontWeight: 600,
                lineHeight: 1.45,
                color: '#e2e8f0',
                letterSpacing: '-0.01em',
              }}
            >
              {truncatedContent}
            </span>
          </div>

          {/* Divider */}
          <div
            style={{
              height: '1px',
              background: 'rgba(255,255,255,0.06)',
              marginBottom: '24px',
            }}
          />

          {/* Footer: topic context + upvotes + author */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: '24px',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: 0 }}>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: '#3f3f50',
                }}
              >
                RE: TOPIC
              </span>
              <span
                style={{
                  fontFamily: 'system-ui, sans-serif',
                  fontSize: '16px',
                  fontWeight: 500,
                  color: '#71717a',
                  lineHeight: 1.35,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '680px',
                }}
              >
                {truncatedTopic}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexShrink: 0 }}>
              {/* Upvotes */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '24px',
                    fontWeight: 700,
                    color: '#10b981',
                    lineHeight: 1,
                  }}
                >
                  {arg.upvotes}
                </span>
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '10px',
                    color: '#3f3f50',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  upvotes
                </span>
              </div>

              {/* Author */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#a1a1aa',
                  }}
                >
                  {authorName}
                </span>
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '10px',
                    color: '#3f3f50',
                    letterSpacing: '0.04em',
                  }}
                >
                  lobby.market
                </span>
              </div>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    )
  } catch {
    return new Response('Failed to generate image', { status: 500 })
  }
}
