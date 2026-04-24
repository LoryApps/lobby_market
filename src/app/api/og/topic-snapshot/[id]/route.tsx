import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function truncate(text: string, max: number) {
  if (!text) return ''
  return text.length <= max ? text : text.slice(0, max - 1) + '…'
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

    const [topicRes, argsRes] = await Promise.all([
      supabase
        .from('topics')
        .select('statement, category, status, blue_pct, total_votes')
        .eq('id', params.id)
        .single(),
      supabase
        .from('topic_arguments')
        .select('id, side, content, upvotes')
        .eq('topic_id', params.id)
        .order('upvotes', { ascending: false })
        .limit(20),
    ])

    const topic = topicRes.data
    const args  = argsRes.data ?? []

    const statement   = topic?.statement ?? 'Community Debate'
    const forPct      = Math.round(topic?.blue_pct ?? 50)
    const againstPct  = 100 - forPct
    const totalVotes  = topic?.total_votes ?? 0
    const status      = topic?.status ?? 'active'
    const category    = topic?.category

    const topFor     = args.find((a) => a.side === 'blue')
    const topAgainst = args.find((a) => a.side === 'red')

    const statusColor = STATUS_COLOR[status] ?? '#6b7280'
    const fontSize    = statement.length > 100 ? 30 : statement.length > 70 ? 36 : 42

    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '1200px',
            height: '630px',
            backgroundColor: '#0d0f14',
            padding: '52px 60px 48px',
            position: 'relative',
            overflow: 'hidden',
            fontFamily: '"Courier New", monospace',
          }}
        >
          {/* Blue glow */}
          <div
            style={{
              position: 'absolute',
              top: '-100px',
              left: '-100px',
              width: '400px',
              height: '400px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(59,130,246,0.10) 0%, transparent 70%)',
            }}
          />
          {/* Red glow */}
          <div
            style={{
              position: 'absolute',
              bottom: '-100px',
              right: '-100px',
              width: '400px',
              height: '400px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(239,68,68,0.10) 0%, transparent 70%)',
            }}
          />

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '28px' }}>
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: statusColor,
              }}
            />
            <span style={{ color: statusColor, fontSize: '13px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              {category ? `${category} · ` : ''}THE DEBATE
            </span>
            <span style={{ color: '#4b5563', fontSize: '13px', marginLeft: 'auto' }}>
              lobby.market
            </span>
          </div>

          {/* Statement */}
          <div
            style={{
              color: '#f9fafb',
              fontSize: `${fontSize}px`,
              fontWeight: 800,
              lineHeight: 1.2,
              marginBottom: '32px',
              maxWidth: '960px',
            }}
          >
            {truncate(statement, 130)}
          </div>

          {/* Arguments row */}
          <div style={{ display: 'flex', gap: '16px', flex: 1, alignItems: 'stretch' }}>
            {/* FOR card */}
            <div
              style={{
                flex: 1,
                backgroundColor: 'rgba(59,130,246,0.06)',
                border: '1px solid rgba(59,130,246,0.25)',
                borderRadius: '12px',
                padding: '18px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <span style={{ color: '#60a5fa', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                FOR · {forPct}%
              </span>
              <div style={{ color: '#d1d5db', fontSize: '15px', lineHeight: 1.5, flex: 1 }}>
                {topFor
                  ? truncate(topFor.content, 120)
                  : 'No arguments yet — be the first to make the case FOR.'}
              </div>
              {topFor && (
                <span style={{ color: '#60a5fa', fontSize: '11px' }}>▲ {topFor.upvotes ?? 0}</span>
              )}
            </div>

            {/* VS divider */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
              <div style={{ width: '1px', flex: 1, backgroundColor: '#1f2937' }} />
              <span style={{ color: '#4b5563', fontSize: '13px', fontWeight: 800 }}>VS</span>
              <div style={{ width: '1px', flex: 1, backgroundColor: '#1f2937' }} />
            </div>

            {/* AGAINST card */}
            <div
              style={{
                flex: 1,
                backgroundColor: 'rgba(239,68,68,0.06)',
                border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: '12px',
                padding: '18px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <span style={{ color: '#f87171', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                AGAINST · {againstPct}%
              </span>
              <div style={{ color: '#d1d5db', fontSize: '15px', lineHeight: 1.5, flex: 1 }}>
                {topAgainst
                  ? truncate(topAgainst.content, 120)
                  : 'No arguments yet — be the first to make the case AGAINST.'}
              </div>
              {topAgainst && (
                <span style={{ color: '#f87171', fontSize: '11px' }}>▲ {topAgainst.upvotes ?? 0}</span>
              )}
            </div>
          </div>

          {/* Footer vote bar */}
          <div style={{ display: 'flex', alignItems: 'center', marginTop: '20px', gap: '8px' }}>
            <div style={{ flex: 1, height: '6px', borderRadius: '3px', backgroundColor: '#1f2937', overflow: 'hidden', display: 'flex' }}>
              <div style={{ width: `${forPct}%`, backgroundColor: '#3b82f6' }} />
              <div style={{ flex: 1, backgroundColor: '#ef4444' }} />
            </div>
            <span style={{ color: '#6b7280', fontSize: '12px', whiteSpace: 'nowrap' }}>
              {totalVotes.toLocaleString()} votes cast
            </span>
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    )
  } catch {
    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            width: '1200px',
            height: '630px',
            backgroundColor: '#0d0f14',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#f9fafb',
            fontSize: '32px',
            fontFamily: 'monospace',
          }}
        >
          Lobby Market
        </div>
      ),
      { width: 1200, height: 630 }
    )
  }
}
