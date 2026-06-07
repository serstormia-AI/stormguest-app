# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start local dev server (http://localhost:3000)
npm run build      # TypeScript + Next.js production build — run before pushing
npm run lint       # ESLint check
```

No test suite exists yet. Validate changes manually via `npm run build` and the dev server.

## Architecture

**stormguest-app** is the guest-facing Next.js 16 app for a multi-tenant hotel SaaS. Each hotel lives at `/{hotelId}/*` where `hotelId` is the hotel's slug (e.g. `/demo`). The companion admin dashboard is in a separate repo (`stormguest-backend`).

### Stack
- Next.js 16 / React 19 / TypeScript, App Router
- TailwindCSS 4 (`@theme inline` syntax, no config file)
- Framer Motion for animations
- Supabase (PostgreSQL + Realtime) via `@supabase/ssr`
- Anthropic Claude Haiku for Julia AI concierge
- Deployed on Vercel; repo at `serstormia-AI/stormguest-app` (must be **private**)

### Supabase client — three distinct clients, never mix them

| Client | File | When to use |
|--------|------|-------------|
| `createSSRSupabase()` | `src/lib/supabase-server.ts` | Server Components only — reads auth cookies via `next/headers`. Used exclusively for `auth.getUser()`. |
| `createBrowserSupabase()` | `src/lib/supabase.ts` | Client Components — cookie-synced session for Realtime subscriptions and reads. |
| `getAdminSupabase()` | `src/lib/supabase.ts` | API routes only — service role key, bypasses RLS. Used for all writes and identity lookups. |

**Critical**: `supabase-server.ts` imports `next/headers` and must never be imported by Client Components (`"use client"`). `getAdminSupabase()` uses `SUPABASE_SERVICE_ROLE_KEY` which must never be exposed to the browser.

### RLS is active — all guest-table queries from Server Components must use admin client

RLS migration 008 scopes tables to `hotel_id` via `current_setting('app.hotel_id')`. That setting is never populated in the Next.js SSR context, so any query against the `guests` table using the anon key (SSR client) returns 0 rows. The pattern for every authenticated page:

```ts
// 1. Verify identity — SSR client is correct here
const ssrSupabase = await createSSRSupabase();
const { data: { user } } = await ssrSupabase.auth.getUser();
if (!user) redirect(`/${hotelId}/login`);

// 2. Look up guest — must use admin client, NOT ssrSupabase
const supabase = getAdminSupabase();
const { data: guest } = await supabase
    .from('guests')
    .select('id, name')
    .eq('auth_user_id', user.id)
    .single();
if (!guest) redirect(`/${hotelId}/login`);
```

### No FK constraints — never use `!inner` joins

The Supabase database has no foreign key constraints. Supabase's `!inner` join syntax relies on FKs and silently returns empty results without them. Always do two separate queries and merge in JS.

### Auth flow

1. Guest hits `/{hotelId}` → middleware checks session → redirects to `/{hotelId}/login` if none
2. Login page: `signInAnonymously()` → POST `/api/checkin/verify` (validates room + last name, links `auth_user_id` to `guests` row) → `refreshSession()` → redirect to dashboard
3. Dashboard (`page.tsx`) re-verifies via `getUser()` + admin client guest lookup

Middleware only checks session existence — tenant isolation is enforced at the page level, not in middleware (race condition if done in middleware immediately after anonymous sign-in).

### API routes pattern

All DB writes go through API routes using `getAdminSupabase()`:

| Route | Purpose |
|-------|---------|
| `POST /api/checkin/verify` | Validates reservation by room + last name, sets `guests.auth_user_id` |
| `POST /api/chat/message` | Inserts guest message, calls Claude Haiku, inserts bot reply |
| `POST /api/experiences/request` | Inserts purchase request into `requests` table |

### Key database tables

- `hotels` — identified by `slug` (URL) and `id` (UUID); has `primary_color`, `primary_color_light` for theming
- `guests` — has `auth_user_id UUID` (links Supabase anonymous user to hotel guest), `name` (single field, not first/last), `hotel_id`
- `reservations` — columns: `room_number`, `check_in`, `check_out` (not `checkout_date`), `status` (`confirmed` | `checked_in`)
- `messages` — columns: `hotel_id`, `guest_id`, `sender_type` (`guest` | `staff` | `bot`), `content`
- `experiences` — the service catalog; filtered by `is_active = true`
- `requests` — guest purchase requests; columns: `hotel_id`, `guest_id`, `experience_id`, `total_price`, `status`

### Multi-tenant theming

`src/app/[hotelId]/layout.tsx` fetches the hotel's `primary_color` and `primary_color_light` from the DB and injects them as CSS variables on the root element. All components use `text-hotel-primary`, `bg-hotel-primary`, etc. (defined in `globals.css` via `@theme inline`).

### Chat / Realtime

`ChatClient.tsx` (Client Component) subscribes to Supabase Realtime on the `messages` table filtered by `guest_id`. The typing indicator (`isJuliaTyping`) is set to `true` when the guest sends a message and cleared when a non-guest message arrives via the Realtime subscription. Message sends go through `/api/chat/message` — never direct Supabase inserts from the browser.

### Server Component / Client Component split for pages with auth

Pages with auth use a server wrapper + client component pattern:
- `chat/page.tsx` — Server Component: fetches `guestId` via admin client, renders `<ChatClient>` with props
- `[hotelId]/page.tsx` — Server Component: renders `<GuestDashboardClient>` with guest data as props
- Login and chat UI are Client Components (`"use client"`)

### Environment variables

```
NEXT_PUBLIC_SUPABASE_URL         # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY    # Supabase anon/public key
SUPABASE_SERVICE_ROLE_KEY        # Service role key — server only, never NEXT_PUBLIC_
ANTHROPIC_API_KEY                # Claude API key — server only
```

All four must be set in Vercel project settings. The GitHub repo must remain **private** — GitHub auto-revokes any PAT found in a public repo's history.
