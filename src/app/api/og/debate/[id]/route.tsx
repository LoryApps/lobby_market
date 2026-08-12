import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const STATUS_COLORS: Record<string, string> = {
  scheduled: '#f59e0b', live: '#10b981', ended: '#71717a', cancelled: '#ef4444',
}

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
    const { data: debate } = await supabase
      .from('debates')
      .select('topic_id, status, scheduled_at')
      .eq('id', params.id)
      .single()

    if (!debate) return fallback()

    let topicStatement = 'A live debate'
    let category: string | null = null

    if (debate.topic_id) {
      const { data: topic } = await supabase
        .from('topics')
        .select('statement, category')
        .eq('id', debate.topic_id)
        .single()
      if (topic) { topicStatement = topic.statement; category = topic.category }
    }

    const status = debate.status ?? 'scheduled'
    const statusColor = STATUS_COLORS[status] ?? '#71717a'
    const statusLabel = status === 'live' ? 'LIVE NOW' : status.toUpperCase()
    const fontSize = topicStatement.length > 100 ? 30 : topicStatement.length > 60 ? 38 : 44

    let dateLabel: string | null = null
    if (debate.scheduled_at) {
      try {
        dateLabel = new Date(debate.scheduled_at).toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
        })
      } catch { dateLabel = null }
    }

    return new ImageResponse(
      (
        <div style={{ width: '1200px', height: '630px', display: 'flex', flexDirection: 'column', background: '#0a0a0f', fontFamily: 'system-ui, -apple-system, sans-serif', position: 'relative', overflow: 'hidden', padding: '64px 72px 60px' }}>
          <div style={{ position: 'absolute', top: '-80px', right: '-80px', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,158,11,0.12) 0%, transparent 70%)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', display: 'flex' }} />
              <span style={{ color: '#fafafa', fontSize: '16px', fontWeight: 700, letterSpacing: '0.18em' }}>LOBBY MARKET</span>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              {category && <div style={{ background: '#1a1a22', color: '#a1a1aa', fontSize: '13px', fontWeight: 600, padding: '6px 14px', borderRadius: '20px', border: '1px solid #24242e' }}>{category}</div>}
              <div style={{ background: `${statusColor}22`, color: statusColor, fontSize: '13px', fontWeight: 700, padding: '6px 14px', borderRadius: '20px', border: `1px solid ${statusColor}44`, letterSpacing: '0.08em' }}>{statusLabel}</div>
            </div>
          </div>
          <div style={{ background: '#111117', borderRadius: '10px', padding: '10px 16px', marginBottom: '24px', border: '1px solid #1a1a22', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: '#52525b', fontSize: '13px', fontWeight: 700, letterSpacing: '0.1em' }}>DEBATE</span>
            {dateLabel && <span style={{ color: '#3f3f4a', fontSize: '13px' }}>{dateLabel}</span>}
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            <p style={{ color: '#fafafa', fontSize: `${fontSize}px`, fontWeight: 700, lineHeight: 1.35, margin: 0, maxWidth: '980px' }}>
              {topicStatement}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '24px', marginTop: '32px' }}>
            <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: 'linear-gradient(90deg, #1d4ed8, #3b82f6)' }} />
            <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: 'linear-gradient(90deg, #ef4444, #b91c1c)' }} />
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    )
  } catch {
    return fallback()
  }
}
