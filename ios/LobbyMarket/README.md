# Lobby Market — iOS

Native SwiftUI iPhone app for Lobby Market: a consensus/debate platform where citizens vote Blue (FOR) or Red (AGAINST) on topics, watch live distribution on "The Floor" parliamentary chamber, and browse the Codex.

## Requirements

- **Xcode 15+** (iOS 16 deployment target)
- **iOS 16.0+** simulator or device
- No third-party packages — everything uses `URLSession`, SwiftUI's `Canvas`, and `URLSessionWebSocketTask` directly.

## Open & Run

1. Open the project:
   ```bash
   open ios/LobbyMarket/LobbyMarket.xcodeproj
   ```
2. In Xcode, select the **LobbyMarket** scheme and an **iOS Simulator** (e.g. iPhone 15 Pro) as the destination.
3. Build and run with **Cmd-R**.

The app launches into a 5-tab interface:

| Tab | Icon | Description |
|-----|------|-------------|
| Feed | `house.fill` | TikTok-style vertical paging through topics, with vote bar + FOR/AGAINST buttons |
| Floor | `building.columns.fill` | Isometric parliamentary chamber — ~280 seats animate to reflect live vote distribution |
| Create | `plus.circle.fill` | Draft a new motion for voting |
| Codex | `books.vertical.fill` | Wiki-style browser of Laws with search and linked references |
| Profile | `person.fill` | Sign in/up via Supabase Auth, view stats, sign out |

## Architecture

```
LobbyMarket/
  LobbyMarketApp.swift     # @main — StateObject holders, chrome config
  ContentView.swift        # Root TabView
  Config.swift             # Supabase URL + anon key

  Models/
    Topic.swift            # Codable Topic + sample data fallback
    Vote.swift             # VoteSide enum, Vote record, live VoteTally
    Profile.swift          # User profile
    Law.swift              # Codex entry with tags + links

  Services/
    SupabaseClient.swift   # URLSession PostgREST client w/ QueryParams builder
    AuthService.swift      # GoTrue sign in/up + Keychain token storage
    RealtimeService.swift  # URLSessionWebSocketTask client (Phoenix protocol)

  Views/
    Common/Colors.swift    # Brand color system (forBlue, againstRed, surface*, etc.)
    Common/Theme.swift     # Spacing, Radii, Font presets, CardStyle, Haptics
    Feed/                  # Feed + TopicCard + VoteBar + VoteButtons + VerticalPagingFeed
    Floor/                 # TheFloorView + Canvas-rendered ChamberCanvas + pure ChamberMath
    Topic/                 # TopicDetailView, CreateTopicView
    Law/                   # LawCodexView, LawDetailView (markdown-ish renderer)
    Profile/               # ProfileView, LoginView

  Resources/
    Assets.xcassets/       # AccentColor
    Info.plist             # Bundle info, orientation, light bar style
```

## Backend

Hard-coded in `Config.swift`:

- **Supabase URL:** `https://jysabvbfruvyhbqdhnmh.supabase.co`
- **Anon key:** already embedded — safe to ship (RLS enforced server-side)
- **REST:** `{supabase}/rest/v1/`
- **Auth:** `{supabase}/auth/v1/`
- **Realtime:** `wss://{supabase}/realtime/v1/websocket`

If the Supabase tables (`topics`, `laws`, `profiles`, `votes`) aren't yet populated, all views fall back to bundled sample data so the UI still demos correctly.

## Key implementations

### `VerticalPagingFeed`
iOS 16-compatible TikTok-style vertical snap paging built on `DragGesture` + spring animations (avoids the iOS 17-only `scrollTargetBehavior`).

### `ChamberCanvas`
SwiftUI `Canvas` API drives a 30fps isometric parliamentary chamber. ~280 seats are laid out in concentric arcs by `ChamberMath.generateSeats()`, projected to screen space with a configurable tilt, partitioned by affinity (seats closest to the FOR side flip blue first), and drawn painter's-algorithm style back-to-front with subtle breathing. Changing the current topic animates seat flips via spring transitions on the `bluePct` binding.

### `SupabaseClient`
Pure-`URLSession` PostgREST client. `QueryParams` builder for eq/order/limit/ilike. Custom ISO8601 date decoder handling both fractional-second and second-precision timestamps. Decodes into the strongly-typed models. Gracefully falls back to sample data when the table returns an error.

### `RealtimeService`
`URLSessionWebSocketTask` client speaking the Supabase Realtime (Phoenix) protocol. `subscribe(topicId:)` sends `phx_join` on `realtime:public:votes:topic_id=eq.<id>` and aggregates vote inserts into a `VoteTally` map, published to any subscribed view via `@Published`.

### `AuthService`
GoTrue sign-in/sign-up via plain HTTP JSON. Tokens are persisted to the iOS Keychain (`Keychain.save/read/delete`), and the bearer is propagated into `SupabaseClient.shared.accessToken` so authenticated REST calls just work.

## Design system

Centralized in `Views/Common/Colors.swift` and `Theme.swift`:

- Core palette: `forBlue #3b82f6`, `forBlueDark #2563eb`, `againstRed #ef4444`, `againstRedDark #dc2626`
- Surfaces: `surface0 #0a0a0f` … `surface300 #24242e`
- Accents: `gold #f59e0b`, `emerald #10b981`
- Typography: `.lmDisplayLarge`, `.lmDisplayMedium`, `.lmTitle`, `.lmBody`, `.lmBodyBold`, `.lmCaption`
- Spacing tokens: `Spacing.xxs` (4) … `Spacing.xxl` (48)
- `View.lmCard(padding:cornerRadius:)` modifier for consistent card styling
- `Haptics.impact(.medium) / .selection() / .notify(.success)` helpers

## Notes

- **iOS deployment target:** 16.0 — uses `NavigationStack`, `Canvas`, and `TextField(axis:)`
- **No third-party dependencies** — no SPM packages, no CocoaPods
- **Offline-first fallback:** every data view gracefully degrades to `sampleData` if Supabase is unreachable
- The project was authored to compile without modification — Xcode will re-sign automatically on first open with your personal team.
