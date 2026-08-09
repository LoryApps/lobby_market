import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const GRADE_COLORS: Record<string, string> = {
  A: '#10b981', B: '#3b82f6', C: '#f59e0b', D: '#ef4444', F: '#7f1d1d',
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
    const { data: arg } = await supabase
      .from('topic_arguments')
      .select('content, side, upvotes, topic_id, user_id, ai_grade')
      .eq('id', params.id)
      .single()

    if (!arg) return fallback()

    const [topicRes, profileRes] = await Promise.all([
      supabase.from('topics').select('statement, category').eq('id', arg.topic_id).single(),
      supabase.from('profiles').select('username, display_name').eq('id', arg.user_id).maybeSingle(),
    ])

    const topicStatement = topicRes.data?.statement ?? null
    const authorName = profileRes.data
      ? (profileRes.data.display_name ?? profileRes.data.username)
      : null

    const isFor = arg.side === 'blue'
    const accentColor = isFor ? '#3b82f6' : '#ef4444'
    const accentColorDeep = isFor ? '#1d4ed8' : '#b91c1c'
    const sideLabel = isFor ? 'FOR' : 'AGAINST'
    const content = arg.content ?? ''
    const contentFontSize = content.length > 200 ? 22 : content.length > 120 ? 27 : 32
    const aiGrade = arg.ai_grade
    const gradeColor = aiGrade ? (GRADE_COLORS[aiGrade[0]] ?? '#71717a') : null
    const upvotes = arg.upvotes ?? 0

    return new ImageResponse(
      (
        <div
          style={{
            width: '1200px',
            height: '630px',
            display: 'flex',
            flexDirection: 'column',
            background: '#0a0a0f',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Glow */}
          <div style={{ position: 'absolute', top: '-100px', right: '-100px', width: '500px', height: '500px', borderRadius: '50%', background: `radial-gradient(circle, ${accentColor}15 0%, transparent 70%)` }} />
          {/* Side stripe */}
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '5px', background: `linear-gradient(180deg, ${accentColor}, ${accentColorDeep})` }} />

          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '56px 72px 56px 88px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '36px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', display: 'flex' }} />
                <span style={{ color: '#fafafa', fontSize: '16px', fontWeight: 700, letterSpacing: '0.18em' }}>LOBBY MARKET</span>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {aiGrade && gradeColor && (
                  <div style={{ background: `${gradeColor}22`, color: gradeColor, fontSize: '15px', fontWeight: 800, padding: '5px 14px', borderRadius: '20px', border: `1px solid ${gradeColor}44` }}>
                    GRADE {aiGrade}
                  </div>
                )}
                <div style={{ background: `${accentColor}22`, color: accentColor, fontSize: '13px', fontWeight: 700, padding: '5px 12px', borderRadius: '20px', border: `1px solid ${accentColor}44`, letterSpacing: '0.1em' }}>
                  ARGUMENT {sideLabel}
                </div>
              </div>
            </div>

            {/* Topic context */}
            {topicStatement && (
              <div style={{ background: '#111117', borderRadius: '10px', padding: '14px 18px', marginBottom: '24px', border: '1px solid #1a1a22' }}>
                <span style={{ color: '#52525b', fontSize: '13px', fontWeight: 600, letterSpacing: '0.06em' }}>ON: </span>
                <span style={{ color: '#71717a', fontSize: '14px' }}>
                  {topicStatement.length > 120 ? topicStatement.slice(0, 117) + '…' : topicStatement}
                </span>
              </div>
            )}

            {/* Content */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
              <p style={{ color: '#e4e4e7', fontSize: `${contentFontSize}px`, fontWeight: 500, lineHeight: 1.5, margin: 0, maxWidth: '980px' }}>
                {content.length > 300 ? content.slice(0, 297) + '…' : content}
              </p>
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '28px' }}>
              {authorName && <span style={{ color: '#52525b', fontSize: '16px' }}>By {authorName}</span>}
              {upvotes > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: accentColor, fontSize: '20px', fontWeight: 800 }}>{upvotes}</span>
                  <span style={{ color: '#52525b', fontSize: '15px' }}>upvotes</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    )
  } catch {
    return fallback()
  }
}
