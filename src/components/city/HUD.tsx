'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Award,
  Building2,
  Crown,
  Eye,
  Maximize2,
  Minimize2,
  Mouse,
  Navigation,
  Shield,
  Sparkles,
  X,
} from 'lucide-react'
import type { Profile } from '@/lib/supabase/types'
import {
  buildingTier,
  plotPosition,
  tierName,
  tierProgress,
  tierRange,
} from '@/lib/city/plot-math'

export interface HUDProps {
  currentUser: Profile | null
  selectedUser: Profile | null
  onClearSelection: () => void
  fullscreen: boolean
  onToggleFullscreen: () => void
  /** All users in the scene (used to draw the minimap). */
  users?: Profile[]
  /** Live world-space position of the player character. */
  playerPosition?: { x: number; z: number } | null
  /** Current camera mode; controls which hint is emphasized. */
  cameraMode?: 'follow' | 'orbit'
}

export function HUD({
  currentUser,
  selectedUser,
  onClearSelection,
  fullscreen,
  onToggleFullscreen,
  users = [],
  playerPosition = null,
  cameraMode = 'follow',
}: HUDProps) {
  const router = useRouter()

  return (
    <>
      {/* Top-left: stats for the current user */}
      {currentUser && <PlayerStats user={currentUser} />}

      {/* Top-right: controls */}
      <div className="pointer-events-none fixed right-4 top-4 z-20 flex flex-col items-end gap-2">
        <div className="pointer-events-auto flex gap-2">
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/70 px-3 py-2 text-xs text-white backdrop-blur-md hover:bg-black/90"
            aria-label="Back to feed"
          >
            <ArrowLeft className="h-4 w-4" />
            Exit
          </Link>
          <button
            onClick={onToggleFullscreen}
            className="flex items-center justify-center rounded-lg border border-white/10 bg-black/70 p-2 text-white backdrop-blur-md hover:bg-black/90"
            aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {fullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>
        </div>
        <ControlsHint cameraMode={cameraMode} />
      </div>

      {/* Bottom: upgrade progress */}
      {currentUser && <UpgradeProgressBar user={currentUser} />}

      {/* Selected plot card */}
      {selectedUser && (
        <SelectedPlotCard
          user={selectedUser}
          onClose={onClearSelection}
          onVisit={() => router.push(`/city/${selectedUser.username}`)}
        />
      )}

      {/* Minimap (bottom-right) */}
      <Minimap
        users={users}
        playerPosition={playerPosition}
        currentUserId={currentUser?.id ?? null}
        selectedUserId={selectedUser?.id ?? null}
      />

      {/* Title banner */}
      <div className="pointer-events-none fixed left-1/2 top-4 z-10 -translate-x-1/2">
        <div className="rounded-full border border-white/10 bg-black/70 px-4 py-1.5 text-center backdrop-blur-md">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-for-400" />
            <span className="text-sm font-semibold tracking-wider text-white">
              THE LOBBY
            </span>
            <div className="flex h-1 w-6">
              <div className="flex-1 rounded-l-full bg-for-500" />
              <div className="flex-1 rounded-r-full bg-against-500" />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function PlayerStats({ user }: { user: Profile }) {
  const tier = buildingTier(user.reputation_score)
  return (
    <div className="pointer-events-auto fixed left-4 top-4 z-20 w-64 rounded-xl border border-white/10 bg-black/75 p-4 backdrop-blur-md">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-for-500/20 text-for-400">
          <Building2 className="h-4 w-4" />
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="truncate text-sm font-semibold text-white">
            {user.display_name ?? user.username}
          </div>
          <div className="truncate text-[11px] text-white/50">
            @{user.username}
          </div>
        </div>
        {user.is_influencer && (
          <Crown className="h-4 w-4 flex-shrink-0 text-gold" />
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
        <StatPill label="Influence" value={user.reputation_score.toLocaleString()} accent="blue" />
        <StatPill label="Clout" value={user.clout.toLocaleString()} accent="gold" />
        <StatPill label="Role" value={roleLabel(user.role)} accent="neutral" />
        <StatPill label="Tier" value={tierName(tier)} accent="red" />
      </div>
    </div>
  )
}

function StatPill({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent: 'blue' | 'red' | 'gold' | 'neutral'
}) {
  const accentClasses = {
    blue: 'bg-for-500/15 text-for-300 border-for-500/30',
    red: 'bg-against-500/15 text-against-300 border-against-500/30',
    gold: 'bg-gold/15 text-gold border-gold/30',
    neutral: 'bg-white/5 text-white border-white/10',
  }[accent]
  return (
    <div className={`rounded-md border px-2 py-1.5 ${accentClasses}`}>
      <div className="text-[9px] uppercase tracking-wider opacity-70">
        {label}
      </div>
      <div className="truncate text-xs font-semibold">{value}</div>
    </div>
  )
}

function UpgradeProgressBar({ user }: { user: Profile }) {
  const tier = buildingTier(user.reputation_score)
  const progress = tierProgress(user.reputation_score)
  const { max } = tierRange(tier)
  const nextName = tier >= 6 ? 'Max tier reached' : `Next: ${tierName(tier + 1)}`
  const needed = tier >= 6 ? 0 : Math.max(0, max - user.reputation_score)

  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-20 w-[min(520px,90vw)] -translate-x-1/2">
      <div className="pointer-events-auto rounded-xl border border-white/10 bg-black/75 p-3 backdrop-blur-md">
        <div className="mb-1.5 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5 text-white/70">
            <Building2 className="h-3 w-3" />
            <span className="font-medium">{tierName(tier)}</span>
          </div>
          <div className="text-white/50">{nextName}</div>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full bg-gradient-to-r from-for-500 via-gold to-against-500 transition-all duration-500"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <div className="mt-1 text-right text-[10px] text-white/50">
          {tier >= 6
            ? 'Glass Skyscraper unlocked'
            : `${needed.toLocaleString()} influence to next upgrade`}
        </div>
      </div>
    </div>
  )
}

function SelectedPlotCard({
  user,
  onClose,
  onVisit,
}: {
  user: Profile
  onClose: () => void
  onVisit: () => void
}) {
  const tier = buildingTier(user.reputation_score)
  return (
    <div className="pointer-events-auto fixed right-4 top-24 z-30 w-72 rounded-xl border border-white/10 bg-black/80 p-4 shadow-2xl backdrop-blur-md">
      <button
        onClick={onClose}
        className="absolute right-2 top-2 rounded-md p-1 text-white/50 hover:bg-white/10 hover:text-white"
        aria-label="Close"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-for-500/20">
          <RoleIcon role={user.role} />
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="truncate text-sm font-bold text-white">
            {user.display_name ?? user.username}
          </div>
          <div className="truncate text-[11px] text-white/50">
            @{user.username}
          </div>
        </div>
        {user.is_influencer && <Crown className="h-4 w-4 text-gold" />}
      </div>

      {user.bio && (
        <p className="mb-3 line-clamp-3 text-[11px] leading-relaxed text-white/70">
          {user.bio}
        </p>
      )}

      <div className="mb-3 grid grid-cols-2 gap-2 text-[11px]">
        <Stat label="Influence" value={user.reputation_score.toLocaleString()} />
        <Stat label="Clout" value={user.clout.toLocaleString()} />
        <Stat label="Arguments" value={user.total_arguments.toLocaleString()} />
        <Stat label="Votes" value={user.total_votes.toLocaleString()} />
      </div>

      <div className="mb-3 rounded-lg bg-white/5 px-3 py-2">
        <div className="text-[10px] uppercase tracking-wider text-white/50">
          Building
        </div>
        <div className="text-sm font-semibold text-white">{tierName(tier)}</div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onVisit}
          className="flex-1 rounded-lg bg-for-500 px-3 py-2 text-xs font-semibold text-white hover:bg-for-600"
        >
          <Navigation className="mr-1 inline h-3 w-3" />
          Visit Plot
        </button>
        <Link
          href={`/profile/${user.username}`}
          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-center text-xs font-semibold text-white hover:bg-white/10"
        >
          <Eye className="mr-1 inline h-3 w-3" />
          Profile
        </Link>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white/5 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-white/40">
        {label}
      </div>
      <div className="text-xs font-semibold text-white">{value}</div>
    </div>
  )
}

function RoleIcon({ role }: { role: Profile['role'] }) {
  if (role === 'elder') return <Award className="h-4 w-4 text-gold" />
  if (role === 'troll_catcher') return <Shield className="h-4 w-4 text-for-400" />
  if (role === 'debator') return <Sparkles className="h-4 w-4 text-for-400" />
  return <Building2 className="h-4 w-4 text-for-400" />
}

function roleLabel(role: Profile['role']): string {
  switch (role) {
    case 'elder':
      return 'Elder'
    case 'troll_catcher':
      return 'Troll Catcher'
    case 'debator':
      return 'Debator'
    default:
      return 'Person'
  }
}

function ControlsHint({ cameraMode }: { cameraMode: 'follow' | 'orbit' }) {
  return (
    <div className="pointer-events-auto hidden max-w-[240px] rounded-lg border border-white/10 bg-black/65 p-2.5 text-[10px] text-white/70 backdrop-blur-md md:block">
      <div className="mb-1 flex items-center gap-1 font-semibold text-white/90">
        <Mouse className="h-3 w-3" />
        Controls
      </div>
      {cameraMode === 'follow' ? (
        <>
          <div>
            <span className="font-mono text-white/90">WASD</span> / arrows: move
          </div>
          <div>
            <span className="font-mono text-white/90">E</span>: interact with plot
          </div>
          <div>
            <span className="font-mono text-white/90">O</span>: orbit camera mode
          </div>
        </>
      ) : (
        <>
          <div>Left-drag: rotate</div>
          <div>Right-drag: pan</div>
          <div>Scroll: zoom</div>
          <div>
            <span className="font-mono text-white/90">O</span>: back to follow cam
          </div>
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Minimap                                                             */
/* ------------------------------------------------------------------ */
function Minimap({
  users,
  playerPosition,
  currentUserId,
  selectedUserId,
}: {
  users: Profile[]
  playerPosition: { x: number; z: number } | null
  currentUserId: string | null
  selectedUserId: string | null
}) {
  const SIZE = 160
  // Show a 120-unit radius around the player (or origin) in world units.
  const VIEW_RADIUS = 120
  const center = playerPosition ?? { x: 0, z: 0 }

  const toMap = (wx: number, wz: number) => {
    const dx = wx - center.x
    const dz = wz - center.z
    const px = SIZE / 2 + (dx / VIEW_RADIUS) * (SIZE / 2)
    const py = SIZE / 2 + (dz / VIEW_RADIUS) * (SIZE / 2)
    return { px, py }
  }

  // Only draw dots for plots within the viewport to keep the DOM light.
  const dots = users
    .map((u) => {
      const [x, z] = plotPosition(u.id)
      const dx = x - center.x
      const dz = z - center.z
      const dist = Math.hypot(dx, dz)
      if (dist > VIEW_RADIUS) return null
      const { px, py } = toMap(x, z)
      const isCurrent = u.id === currentUserId
      const isSelected = u.id === selectedUserId
      const tier = buildingTier(u.reputation_score)
      const color = isSelected
        ? '#fbbf24'
        : isCurrent
          ? '#60a5fa'
          : tier >= 5
            ? '#a78bfa'
            : tier >= 3
              ? '#94a3b8'
              : '#475569'
      const r = isCurrent || isSelected ? 3 : tier >= 5 ? 2.5 : 1.6
      return { id: u.id, px, py, color, r }
    })
    .filter((d): d is NonNullable<typeof d> => d !== null)

  return (
    <div className="pointer-events-none fixed bottom-6 right-4 z-20">
      <div className="pointer-events-auto rounded-xl border border-white/10 bg-black/75 p-2 shadow-xl backdrop-blur-md">
        <div className="mb-1 flex items-center justify-between px-1 text-[9px] uppercase tracking-widest text-white/60">
          <span>Lobby map</span>
          <span className="text-white/30">{VIEW_RADIUS * 2}u</span>
        </div>
        <svg
          width={SIZE}
          height={SIZE}
          className="block rounded-md"
          style={{ background: 'radial-gradient(circle at center, #0b1024 0%, #03050c 80%)' }}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
        >
          {/* Compass crosshair */}
          <line
            x1={SIZE / 2}
            y1={0}
            x2={SIZE / 2}
            y2={SIZE}
            stroke="#1e293b"
            strokeWidth={0.5}
          />
          <line
            x1={0}
            y1={SIZE / 2}
            x2={SIZE}
            y2={SIZE / 2}
            stroke="#1e293b"
            strokeWidth={0.5}
          />
          {/* Concentric rings */}
          {[0.25, 0.5, 0.75].map((r) => (
            <circle
              key={r}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={(SIZE / 2) * r}
              fill="none"
              stroke="#1e293b"
              strokeWidth={0.5}
            />
          ))}
          {/* Plot dots */}
          {dots.map((d) => (
            <circle
              key={d.id}
              cx={d.px}
              cy={d.py}
              r={d.r}
              fill={d.color}
              opacity={0.9}
            />
          ))}
          {/* Player marker (always at center) */}
          <g>
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={4.5}
              fill="#f59e0b"
              stroke="#fde68a"
              strokeWidth={1}
            />
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={8}
              fill="none"
              stroke="#f59e0b"
              strokeWidth={0.7}
              opacity={0.5}
            />
          </g>
          {/* N label */}
          <text
            x={SIZE / 2}
            y={9}
            textAnchor="middle"
            fontSize={8}
            fill="#94a3b8"
            fontFamily="monospace"
          >
            N
          </text>
        </svg>
      </div>
    </div>
  )
}
