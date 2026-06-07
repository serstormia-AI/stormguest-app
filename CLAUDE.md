# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start local dev server (http://localhost:3000)
npm run build      # TypeScript + Next.js production build — run before pushing
npm run lint       # ESLint check
```

No test suite exists. Validate changes manually via `npm run build` and the dev server.

## Architecture

**stormguest-app** is the guest-facing Next.js 16 app for a multi-tenant hotel SaaS. Each hotel lives at `/{hotelId}/*` where `hotelId` is the hotel's URL slug (e.g. `/demo`). The companion admin dashboard is the separate repo `stormguest-frontend`.

### Stack
- Next.js 16 / React 19 / TypeScript, App Router
- TailwindCSS 4 (`@theme inline` syntax, no `tailwind.config.js`)
- Framer Motion for page/card animations
- Supabase (PostgreSQL + Realtime) via `@supabase/ssr`
- Anthropic Claude Haiku (`claude-haiku-4-5-20251001`) for Julia AI concierge
- Deployed on Vercel; repo `serstormia-AI/stormguest-app` must remain **private**

---

## Supabase clients — three distinct clients, never mix them

| Client | File | When to use |
|--------|------|-------------|
| `createSSRSupabase()` | `src/lib/supabase-server.ts` | Server Components **only** — reads auth cookies via `next/headers`. Use exclusively for `auth.getUser()`. |
| `createBrowserSupabase()` | `src/lib/supabase.ts` | Client Components (`"use client"`) — cookie-synced session for Realtime subscriptions. |
| `getAdminSupabase()` | `src/lib/supabase.ts` | API routes and Server Components — service role key, bypasses RLS. All DB reads/writes except auth. |

**Rules:**
- `supabase-server.ts` imports `next/headers` — **never import it from a Client Component**.
- `getAdminSupabase()` uses `SUPABASE_SERVICE_ROLE_KEY` — **never put this in a `NEXT_PUBLIC_` var**.
- Client Components must use `createBrowserSupabase()` for Realtime; never call `getAdminSupabase()` from the browser.

---

## RLS bypass pattern — mandatory for all pages with auth

RLS policy 008 scopes tables to `hotel_id` via `current_setting('app.hotel_id')`. That setting is never populated in Next.js SSR, so any query against `guests` using the anon key returns 0 rows. Standard pattern for every authenticated Server Component:

```ts
// 1. Verify identity (SSR client is correct here — validates JWT cookie)
const ssrSupabase = await createSSRSupabase();
const { data: { user } } = await ssrSupabase.auth.getUser();
if (!user) redirect(`/${hotelId}/login`);

// 2. All data reads use admin client (bypasses RLS, identity already verified above)
const supabase = getAdminSupabase();
const { data: guest } = await supabase
    .from('guests')
    .select('id, name')
    .eq('auth_user_id', user.id)
    .single();
if (!guest) redirect(`/${hotelId}/login`);
```

---

## No FK constraints — never use `!inner` joins

The database has no foreign key constraints. PostgREST's `!inner` join notation silently returns empty results without FKs. Always do two separate queries and merge in JS:

```ts
// Wrong: .select('*, guests!inner(name)')
// Correct:
const { data: reservations } = await supabase.from('reservations').select('*').eq('hotel_id', hotelId);
const guestIds = reservations.map(r => r.guest_id);
const { data: guests } = await supabase.from('guests').select('id, name').in('id', guestIds);
const merged = reservations.map(r => ({ ...r, guest: guests.find(g => g.id === r.guest_id) }));
```

---

## Database column names (critical — do not guess)

| Table | Correct columns | Wrong (do not use) |
|-------|----------------|--------------------|
| `guests` | `name`, `email`, `hotel_id`, `auth_user_id`, `nationality`, `document_number`, `signature`, `notes` | `first_name`, `last_name` |
| `reservations` | `room_number`, `check_in`, `check_out`, `status`, `guest_id`, `hotel_id` | `checkin_date`, `checkout_date` |
| `messages` | `hotel_id`, `guest_id`, `sender_type`, `content`, `created_at` | — |
| `hotels` | `id`, `slug`, `name`, `primary_color`, `primary_color_light` | — |
| `experiences` | `id`, `hotel_id`, `title`, `description`, `price`, `currency`, `image_url`, `is_active` | — |
| `requests` | `hotel_id`, `guest_id`, `experience_id`, `total_price`, `status` | — |

`sender_type` values: `'guest'` | `'staff'` | `'bot'`
`reservations.status` values: `'pending'` | `'confirmed'` | `'checked_in'` | `'checked_out'`

---

## Auth flow

1. Guest hits `/{hotelId}/*` → middleware (`src/middleware.ts`) checks session → redirects to `/{hotelId}/login` if none
2. Login page: `supabase.auth.signInAnonymously()` → POST `/api/checkin/verify` (validates room + last name, sets `guests.auth_user_id = user.id`) → `auth.refreshSession()` → redirect to dashboard
3. Every page re-verifies via `getUser()` (SSR client) + admin client guest lookup
4. Middleware only checks session existence — tenant isolation enforced at page level (middleware race condition: cookie not yet refreshed after anonymous sign-in)

---

## API routes

All DB writes go through API routes using `getAdminSupabase()`. Never write to Supabase from browser code.

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/checkin/verify` | POST | Validates room + last name → sets `guests.auth_user_id` |
| `/api/checkin/complete` | POST | Updates `guests` with nationality/document/signature, sets `reservations.status = 'checked_in'` |
| `/api/chat/message` | POST | Inserts guest message → fetches last 10 msgs → calls Claude Haiku → inserts bot reply |
| `/api/experiences/request` | POST | Inserts into `requests` table with `status: 'pending'` |

---

## Julia AI (Anthropic Claude Haiku)

`/api/chat/message/route.ts` calls Anthropic directly:

```ts
const claudeResponse = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    system: systemPrompt,  // Julia persona, hotel name injected
    messages,              // last 10 messages, mapped to {role, content}
});
```

The API key is `ANTHROPIC_API_KEY` (server-only, never `NEXT_PUBLIC_`).

---

## Pages and components

| File | Type | Description |
|------|------|-------------|
| `src/middleware.ts` | Middleware | Session guard for all `/{hotelId}/*` routes |
| `src/app/[hotelId]/layout.tsx` | Server | Fetches hotel `primary_color`/`primary_color_light`, injects CSS vars for theming |
| `src/app/[hotelId]/page.tsx` | Server | Auth → admin guest lookup → reservation → renders `<GuestDashboardClient>` |
| `src/app/[hotelId]/login/page.tsx` | Client | Anonymous sign-in + room/name verification |
| `src/app/[hotelId]/chat/page.tsx` | Server | Auth → admin guest lookup → renders `<ChatClient>` |
| `src/app/[hotelId]/chat/ChatClient.tsx` | Client | Realtime messages, Julia typing indicator, sends via `/api/chat/message` |
| `src/app/[hotelId]/checkin/page.tsx` | Server | Auth → admin guest lookup → active reservation → renders `<CheckinClient>` |
| `src/app/[hotelId]/checkin/CheckinClient.tsx` | Client | 2-step flow: identity confirm → nationality/document/signature canvas → POST `/api/checkin/complete` |
| `src/app/[hotelId]/profile/page.tsx` | Server | Shows guest name, email, reservation check-out |
| `src/components/GuestDashboardClient.tsx` | Client | Hero greeting, room card, check-out card, check-in link, experiences catalog with purchase modal |
| `src/components/LogoutButton.tsx` | Client | `signOut()` → `router.replace('/{hotelId}/login')` |
| `src/components/BottomNav.tsx` | Client | Mobile bottom nav (Home, Chat, Check-in, Profile) |
| `src/lib/supabase.ts` | Lib | Exports `supabase`, `createBrowserSupabase()`, `getAdminSupabase()` |
| `src/lib/supabase-server.ts` | Lib | Exports `createSSRSupabase()` — server only |

---

## Multi-tenant theming

`[hotelId]/layout.tsx` fetches `hotels.primary_color` and `hotels.primary_color_light` from DB and injects them via inline `<style>`:

```html
<style>:root { --hotel-primary: #value; --hotel-primary-light: #value; }</style>
```

All UI uses `text-hotel-primary`, `bg-hotel-primary`, etc. (defined in `globals.css` via `@theme inline`). Never hardcode hex colors in components.

---

## Chat / Realtime pattern

`ChatClient.tsx` (Client Component) subscribes to Supabase Realtime filtered by `guest_id`:

```ts
const channel = supabase.channel(`chat-${guestId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages',
        filter: `guest_id=eq.${guestId}` }, (payload) => {
        setMessages(prev => [...prev, payload.new]);
        if (payload.new.sender_type !== 'guest') setIsJuliaTyping(false);
    }).subscribe();
```

Guest sends → `POST /api/chat/message` → server inserts guest msg + Claude reply → Realtime delivers both. `isJuliaTyping` shows animated dots between send and bot reply arrival.

---

## Environment variables

```
NEXT_PUBLIC_SUPABASE_URL         # Supabase project URL (safe for browser)
NEXT_PUBLIC_SUPABASE_ANON_KEY    # Supabase anon key (safe for browser)
SUPABASE_SERVICE_ROLE_KEY        # Service role — server only, NEVER NEXT_PUBLIC_
ANTHROPIC_API_KEY                # Claude API key — server only
```

All four must be set in Vercel project settings (Settings → Environment Variables). The GitHub repo **must remain private** — GitHub auto-revokes PATs found in public repo history.
