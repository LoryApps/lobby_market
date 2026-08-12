import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function fallback(tag: string) {
  return new ImageResponse(
    (
      <div style={{ width: '1200px', height: '630px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0a0a0f', fontFamily: 'system-ui, -apple-system, sans-serif', gap: '12px' }}>
        <span style={{ color: '#fafafa', fontSize: '48px', fontWeight: 800, letterSpacing: '0.18em' }}>LOBBY MARKET</span>
        <span style={{ color: '#52525b', fontSize: '28px', fontWeight: 700 }}>#{tag}</span>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { tag: string } }
) {
  const tagName = decodeURIComponent(params.tag)

  try {
    const supabase = await createClient()
    const [{ count: topicCount }, { count: followerCount }] = await Promise.all([
      supabase.from('topic_tags').select('id', { count: 'exact', head: true }).eq('tag', tagName),
      supabase.from('user_tag_follows').select('id', { count: 'exact', head: true }).eq('tag', tagName),
    ])

    return new ImageResponse(
      (
        <div
          style={{
            width: '1200px',
            height: '630px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0a0a0f',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ position: 'absolute', top: '50%', left: '50%', width: '700px', height: '700px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.10) 0%, transparent 70%)', marginTop: '-350px', marginLeft: '-350px' }} />
          <div style={{ position: 'absolute', top: '32px', left: '60px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', display: 'flex' }} />
            <span style={{ color: '#fafafa', fontSize: '14px', fontWeight: 700, letterSpacing: '0.18em' }}>LOBBY MARKET</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <span style={{ color: '#52525b', fontSize: '18px', fontWeight: 700, letterSpacing: '0.2em' }}>TAG</span>
            <span style={{ color: '#fafafa', fontSize: tagName.length > 30 ? '52px' : '64px', fontWeight: 900, letterSpacing: '-0.02em' }}>
              #{tagName}
            </span>
            <div style={{ display: 'flex', gap: '40px', marginTop: '16px' }}>
              {(topicCount ?? 0) > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <span style={{ color: '#fafafa', fontSize: '28px', fontWeight: 800 }}>{topicCount}</span>
                  <span style={{ color: '#52525b', fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em' }}>TOPICS</span>
                </div>
              )}
              {(followerCount ?? 0) > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <span style={{ color: '#fafafa', fontSize: '28px', fontWeight: 800 }}>{followerCount}</span>
                  <span style={{ color: '#52525b', fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em' }}>FOLLOWERS</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    )
  } catch {
    return fallback(tagName)
  }
}
