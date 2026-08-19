import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active:     { label: 'ACTIVE',     color: '#3b82f6' },
  vindicated: { label: 'VINDICATED', color: '#10b981' },
  refuted:    { label: 'REFUTED',    color: '#ef4444' },
  expired:    { label: 'EXPIRED',    color: '#71717a' },
}

const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
  economics:   { label: 'Economics',   color: '#f59e0b' },
  politics:    { label: 'Politics',    color: '#3b82f6' },
  technology:  { label: 'Technology',  color: '#a855f7' },
  science:     { label: 'Science',     color: '#10b981' },
  ethics:      { label: 'Ethics',      color: '#94a3b8' },
  philosophy:  { label: 'Philosophy',  color: '#94a3b8' },
  culture:     { label: 'Culture',     color: '#f87171' },
  health:      { label: 'Health',      color: '#10b981' },
  environment: { label: 'Environment', color: '#10b981' },
  education:   { label: 'Education',   color: '#60a5fa' },
}

function fallback() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0f',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <span style={{ color: '#fafafa', fontSize: '48px', fontWeight: 800, letterSpacing: '0.18em' }}>
          LOBBY MARKET
        </span>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = await createClient()

    const { data: thesis } = await supabase
      .from('civic_theses')
      .select('statement, category, status, agree_count, disagree_count, user_id, created_at')
      .eq('id', params.id)
      .maybeSingle()

    if (!thesis) return fallback()

    const { data: author } = await supabase
      .from('profiles')
      .select('username, display_name, avatar_url')
      .eq('id', thesis.user_id)
      .maybeSingle()

    const statement = thesis.statement ?? ''
    const fontSize = statement.length > 180 ? 26 : statement.length > 100 ? 34 : 42

    const statusConf = STATUS_CONFIG[thesis.status] ?? STATUS_CONFIG.active
    const catConf = CATEGORY_CONFIG[thesis.category] ?? CATEGORY_CONFIG.politics

    const agreeCount = thesis.agree_count ?? 0
    const disagreeCount = thesis.disagree_count ?? 0
    const total = agreeCount + disagreeCount
    const agreePct = total > 0 ? Math.round((agreeCount / total) * 100) : 50

    const authorName = author?.display_name ?? (author ? `@${author.username}` : 'Anonymous')

    return new ImageResponse(
      (
        <div
          style={{
            width: '1200px',
            height: '630px',
            display: 'flex',
            flexDirection: 'column',
            background: '#0a0a0f',
            padding: '64px 72px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            position: 'relative',
          }}
        >
          {/* Top bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '36px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ color: '#fafafa', fontSize: '18px', fontWeight: 800, letterSpacing: '0.14em' }}>
                LOBBY MARKET
              </span>
              <span style={{ color: '#3f3f5a', fontSize: '14px', fontWeight: 400 }}>·</span>
              <span style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 500 }}>
                Civic Thesis
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  padding: '4px 10px',
                  borderRadius: '999px',
                  border: `1px solid ${catConf.color}40`,
                  background: `${catConf.color}15`,
                  color: catConf.color,
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                }}
              >
                {catConf.label.toUpperCase()}
              </div>
              <div
                style={{
                  padding: '4px 10px',
                  borderRadius: '999px',
                  border: `1px solid ${statusConf.color}40`,
                  background: `${statusConf.color}15`,
                  color: statusConf.color,
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                }}
              >
                {statusConf.label}
              </div>
            </div>
          </div>

          {/* Statement */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <p
              style={{
                color: '#f1f5f9',
                fontSize: `${fontSize}px`,
                fontWeight: 700,
                lineHeight: 1.3,
                margin: 0,
                maxWidth: '980px',
              }}
            >
              &ldquo;{statement}&rdquo;
            </p>
          </div>

          {/* Bottom */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: '36px' }}>
            {/* Author */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: '#1e1e3a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #3f3f5a',
                  color: '#94a3b8',
                  fontSize: '14px',
                  fontWeight: 700,
                }}
              >
                {authorName.replace('@', '').charAt(0).toUpperCase()}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ color: '#f1f5f9', fontSize: '13px', fontWeight: 600 }}>
                  {authorName}
                </span>
                <span style={{ color: '#64748b', fontSize: '11px' }}>
                  Civic citizen
                </span>
              </div>
            </div>

            {/* Agree/Disagree bar */}
            {total > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', minWidth: '200px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: '#10b981', fontSize: '12px', fontWeight: 700 }}>
                    {agreeCount} agree
                  </span>
                  <span style={{ color: '#3f3f5a', fontSize: '12px' }}>·</span>
                  <span style={{ color: '#f87171', fontSize: '12px', fontWeight: 700 }}>
                    {disagreeCount} disagree
                  </span>
                </div>
                <div
                  style={{
                    width: '200px',
                    height: '6px',
                    borderRadius: '999px',
                    background: '#1e1e3a',
                    overflow: 'hidden',
                    display: 'flex',
                  }}
                >
                  <div
                    style={{
                      width: `${agreePct}%`,
                      height: '100%',
                      background: '#10b981',
                      borderRadius: '999px 0 0 999px',
                    }}
                  />
                  <div
                    style={{
                      flex: 1,
                      height: '100%',
                      background: '#ef4444',
                      borderRadius: '0 999px 999px 0',
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      ),
      { width: 1200, height: 630 },
    )
  } catch {
    return fallback()
  }
}
