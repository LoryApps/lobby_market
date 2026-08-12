import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function fallback() {
  return new ImageResponse(
    (
      <div style={{ width: '1200px', height: '630px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0f', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <span style={{ color: '#fafafa', fontSize: '48px', fontWeight: 800, letterSpacing: '0.18em' }}>LOBBY MARKET</span>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: relay } = await supabase
      .from('civic_relays')
      .select('topic_id, side, status, max_legs, vote_compelling, vote_not_compelling')
      .eq('id', params.id)
      .single()

    if (!relay) return fallback()

    const [{ data: topic }, { count: legCount }] = await Promise.all([
      relay.topic_id
        ? supabase.from('topics').select('statement, category').eq('id', relay.topic_id).single()
        : Promise.resolve({ data: null }),
      supabase.from('relay_legs').select('id', { count: 'exact', head: true }).eq('relay_id', params.id),
    ])

    const topicStatement = topic?.statement ?? 'A civic relay'
    const category = topic?.category ?? null
    const side = relay.side ?? 'for'
    const status = relay.status ?? 'open'
    const legs = legCount ?? 0
    const maxLegs = relay.max_legs ?? 5

    const isFor = side === 'for'
    const sideColor = isFor ? '#3b82f6' : '#ef4444'
    const STATUS_COLORS: Record<string, string> = {
      open: '#10b981', in_progress: '#f59e0b', complete: '#8b5cf6', voted: '#71717a',
    }
    const statusColor = STATUS_COLORS[status] ?? '#71717a'
    const statusLabel = status === 'in_progress' ? 'IN PROGRESS' : status.toUpperCase()
    const fontSize = topicStatement.length > 100 ? 32 : topicStatement.length > 60 ? 40 : 48

    return new ImageResponse(
      (
        <div style={{ width: '1200px', height: '630px', display: 'flex', flexDirection: 'column', background: '#0a0a0f', fontFamily: 'system-ui, -apple-system, sans-serif', position: 'relative', overflow: 'hidden', padding: '64px 72px 60px' }}>
          <div style={{ position: 'absolute', top: '-80px', left: '-80px', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', display: 'flex' }} />
              <span style={{ color: '#fafafa', fontSize: '16px', fontWeight: 700, letterSpacing: '0.18em' }}>LOBBY MARKET</span>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              {category && <div style={{ background: '#1a1a22', color: '#a1a1aa', fontSize: '13px', fontWeight: 600, padding: '6px 14px', borderRadius: '20px', border: '1px solid #24242e' }}>{category}</div>}
              <div style={{ background: `${sideColor}22`, color: sideColor, fontSize: '13px', fontWeight: 700, padding: '6px 14px', borderRadius: '20px', border: `1px solid ${sideColor}44`, letterSpacing: '0.08em' }}>RELAY {side.toUpperCase()}</div>
              <div style={{ background: `${statusColor}22`, color: statusColor, fontSize: '13px', fontWeight: 700, padding: '6px 14px', borderRadius: '20px', border: `1px solid ${statusColor}44`, letterSpacing: '0.08em' }}>{statusLabel}</div>
            </div>
          </div>
          {/* Progress bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '28px' }}>
            {[...Array(maxLegs)].map((_, i) => (
              <div key={i} style={{ flex: 1, height: '6px', borderRadius: '3px', background: i < legs ? sideColor : '#1a1a22' }} />
            ))}
            <span style={{ color: '#52525b', fontSize: '14px', marginLeft: '8px', flexShrink: 0 }}>{legs}/{maxLegs}</span>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            <p style={{ color: '#fafafa', fontSize: `${fontSize}px`, fontWeight: 700, lineHeight: 1.35, margin: 0, maxWidth: '980px' }}>
              {topicStatement}
            </p>
          </div>
          {(relay.vote_compelling > 0 || relay.vote_not_compelling > 0) && (
            <div style={{ marginTop: '28px', display: 'flex', gap: '24px', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: '#10b981', fontSize: '24px', fontWeight: 800 }}>{relay.vote_compelling}</span>
                <span style={{ color: '#52525b', fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em' }}>COMPELLING</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: '#ef4444', fontSize: '24px', fontWeight: 800 }}>{relay.vote_not_compelling}</span>
                <span style={{ color: '#52525b', fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em' }}>NOT COMPELLING</span>
              </div>
            </div>
          )}
        </div>
      ),
      { width: 1200, height: 630 }
    )
  } catch {
    return fallback()
  }
}
