import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function fallback() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '1200px',
          height: '630px',
          backgroundColor: '#0d0f14',
          color: '#c9a84c',
          fontSize: '28px',
          fontWeight: 700,
          letterSpacing: '0.18em',
        }}
      >
        LOBBY MARKET
      </div>
    ),
    { width: 1200, height: 630 }
  )
}

function statBlock(value: string, label: string, color: string) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '14px 24px',
        borderRadius: '10px',
        backgroundColor: `${color}10`,
        border: `1px solid ${color}30`,
        minWidth: '120px',
      }}
    >
      <span style={{ fontSize: '28px', fontWeight: 800, color }}>{value}</span>
      <span
        style={{
          fontSize: '10px',
          fontWeight: 600,
          color: '#6b7280',
          letterSpacing: '0.12em',
          marginTop: '4px',
        }}
      >
        {label}
      </span>
    </div>
  )
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()

    const { data: coalition } = await supabase
      .from('coalitions')
      .select(
        'name, description, member_count, max_members, coalition_influence, wins, losses, is_public, creator_id'
      )
      .eq('id', params.id)
      .single()

    if (!coalition) return fallback()

    const { data: creator } = await supabase
      .from('profiles')
      .select('username, display_name')
      .eq('id', coalition.creator_id)
      .single()

    const name = coalition.name ?? 'Unnamed Coalition'
    const description = coalition.description ?? null
    const memberCount = coalition.member_count ?? 0
    const maxMembers = coalition.max_members ?? 50
    const influence = coalition.coalition_influence ?? 0
    const wins = coalition.wins ?? 0
    const losses = coalition.losses ?? 0
    const isPublic = coalition.is_public !== false
    const creatorName =
      creator?.display_name ?? creator?.username ?? 'Unknown'

    const totalCampaigns = wins + losses
    const winRate =
      totalCampaigns > 0 ? Math.round((wins / totalCampaigns) * 100) : null
    const memberPct = Math.round((memberCount / maxMembers) * 100)

    const nameFontSize = name.length > 40 ? 46 : name.length > 25 ? 54 : 62

    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '1200px',
            height: '630px',
            backgroundColor: '#0d0f14',
            padding: '56px 60px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Ambient purple glow — coalition = purple theme */}
          <div
            style={{
              position: 'absolute',
              top: '-180px',
              right: '-180px',
              width: '600px',
              height: '600px',
              borderRadius: '50%',
              background:
                'radial-gradient(circle, rgba(139,92,246,0.10) 0%, transparent 70%)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '-160px',
              left: '-160px',
              width: '500px',
              height: '500px',
              borderRadius: '50%',
              background:
                'radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)',
            }}
          />

          {/* Header row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '36px',
            }}
          >
            {/* Wordmark */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#c9a84c',
                }}
              />
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: '#c9a84c',
                  letterSpacing: '0.18em',
                }}
              >
                LOBBY MARKET
              </span>
            </div>

            {/* Public/private badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '5px 14px',
                borderRadius: '6px',
                backgroundColor: isPublic ? '#8b5cf618' : '#6b728018',
                border: `1px solid ${isPublic ? '#8b5cf645' : '#6b728045'}`,
                fontSize: '11px',
                fontWeight: 700,
                color: isPublic ? '#8b5cf6' : '#6b7280',
                letterSpacing: '0.12em',
              }}
            >
              {isPublic ? 'PUBLIC COALITION' : 'PRIVATE COALITION'}
            </div>
          </div>

          {/* Coalition accent bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px',
            }}
          >
            <div
              style={{
                width: '3px',
                height: '20px',
                borderRadius: '2px',
                backgroundColor: '#8b5cf6',
              }}
            />
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#8b5cf6',
                letterSpacing: '0.12em',
              }}
            >
              COALITION
            </span>
          </div>

          {/* Name */}
          <div
            style={{
              fontSize: `${nameFontSize}px`,
              fontWeight: 800,
              color: '#f1f5f9',
              lineHeight: 1.15,
              maxWidth: '1000px',
              marginBottom: description ? '16px' : '0',
            }}
          >
            {name}
          </div>

          {/* Description */}
          {description && (
            <div
              style={{
                fontSize: '17px',
                color: '#94a3b8',
                lineHeight: 1.5,
                maxWidth: '820px',
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {description}
            </div>
          )}

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Stats row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '24px',
            }}
          >
            {statBlock(memberCount.toString(), 'MEMBERS', '#8b5cf6')}
            {statBlock(influence.toLocaleString(), 'INFLUENCE', '#c9a84c')}
            {winRate !== null &&
              statBlock(`${winRate}%`, 'WIN RATE', '#10b981')}
            {totalCampaigns > 0 &&
              statBlock(totalCampaigns.toString(), 'CAMPAIGNS', '#6b7280')}
          </div>

          {/* Member fill bar */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              marginBottom: '20px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '11px',
                color: '#6b7280',
                fontWeight: 600,
                letterSpacing: '0.08em',
              }}
            >
              <span>{memberCount} / {maxMembers} members</span>
              <span>{memberPct}% capacity</span>
            </div>
            <div
              style={{
                display: 'flex',
                height: '6px',
                borderRadius: '3px',
                overflow: 'hidden',
                backgroundColor: '#1a1a22',
              }}
            >
              <div
                style={{
                  width: `${Math.min(memberPct, 100)}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #7c3aed 0%, #8b5cf6 100%)',
                  borderRadius: '3px',
                }}
              />
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              fontSize: '13px',
              color: '#4b5563',
            }}
          >
            <span style={{ color: '#6b7280' }}>
              Founded by {creatorName}
            </span>
            <div style={{ flex: 1 }} />
            <span style={{ color: '#374151', fontSize: '12px' }}>
              lobby.market
            </span>
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    )
  } catch {
    return fallback()
  }
}
