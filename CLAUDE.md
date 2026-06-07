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
- Client Components must use `createBrowserSupabase()` for Realtime. Never call `getAdminSupabase()` from the browser.

---

## RLS bypass pattern — mandatory for all pages with auth

Standard pattern for every authenticated Server Component:

```ts
// 1. Verify identity (SSR client — validates JWT cookie)
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

## No FK constraints — always two-step fetches

The database has no foreign key constraints. PostgREST `!inner` join syntax silently returns empty results. Always do two separate queries and merge in JS:

```ts
// Wrong: .select('*, experiences!inner(title)')
// Correct:
const { data: requests } = await supabase.from('requests').select('id, experience_id').eq('guest_id', guestId);
const expIds = [...new Set(requests.map(r => r.experience_id).filter(Boolean))];
const { data: exps } = await supabase.from('experiences').select('id, title').in('id', expIds);
const expMap = Object.fromEntries(exps.map(e => [e.id, e.title]));
const merged = requests.map(r => ({ ...r, expTitle: expMap[r.experience_id] || 'Servicio' }));
```

---

## Database schema (verified — do not guess column names)

| Table | Columns | Notes |
|-------|---------|-------|
| `hotels` | `id` (uuid), `slug` (text), `name`, `primary_color`, `primary_color_light`, `logo_url` | `primary_color` defaults `'#C9964A'` |
| `guests` | `id` (uuid), `hotel_id` (uuid), `auth_user_id` (uuid), `name`, `email`, `nationality`, `document_number`, `signature`, `notes` | — |
| `reservations` | `id` (uuid), `hotel_id` (uuid), `guest_id` (uuid), `room_number`, `check_in`, `check_out`, `status` | status: `'pending'`\|`'checked_in'`\|`'checked_out'` |
| `conversations` | `id` (uuid), `hotel_id` (**text**), `guest_id` (uuid), `channel`, `status`, `created_at`, `updated_at` | hotel_id is TEXT (stores UUID as string) |
| `messages` | `id` (uuid), `conversation_id` (uuid), `sender` (text), `content`, `created_at` | sender: `'guest'`\|`'staff'`\|`'bot'` — NO hotel_id, NO guest_id directly |
| `experiences` | `id` (uuid), `hotel_id` (uuid), `title`, `description`, `price` (numeric), `image_url`, `created_at` | NO currency, NO is_active columns |
| `requests` | `id` (uuid), `hotel_id` (uuid), `guest_id` (uuid), `experience_id` (uuid), `total_price` (numeric), `status`, `created_at` | status: `'pending'`\|`'approved'`\|`'rejected'` |
| `reviews` | `id` (uuid), `hotel_id` (**text**), `guest_id` (uuid), `reservation_id` (uuid), `rating` (integer), `comment`, `created_at` | hotel_id is TEXT |

**Critical:** `messages` does NOT have `hotel_id`, `guest_id`, or `sender_type`. Messages are linked to guests through `conversations`.

---

## Chat architecture — conversations → messages

Messages are nested under conversations. Never query messages directly by `guest_id` or `hotel_id`.

```ts
// Step 1: find or create conversation
const { data: conv } = await supabase
    .from('conversations')
    .select('id')
    .eq('guest_id', guestId)
    .eq('hotel_id', dbHotelId)   // dbHotelId is UUID stored as text
    .maybeSingle();

// Step 2: fetch messages by conversation_id
const { data: messages } = await supabase
    .from('messages')
    .select('id, sender, content, created_at')
    .eq('conversation_id', conv.id)
    .order('created_at', { ascending: true });

// Realtime filter uses conversation_id, not guest_id
const channel = supabase.channel(`chat-conv-${conv.id}`)
    .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${conv.id}`
    }, handler).subscribe();
```

The `/api/chat/message` route does find-or-create on conversations, then inserts with `{ conversation_id, sender: 'guest'|'bot', content }`.

---

## Auth flow

1. Guest hits `/{hotelId}/*` → middleware checks session → redirects to `/{hotelId}/login` if none
2. Login page: `supabase.auth.signInAnonymously()` → POST `/api/checkin/verify` (validates room + last name, sets `guests.auth_user_id = user.id`) → `auth.refreshSession()` → redirect to dashboard
3. Every page re-verifies via `getUser()` (SSR client) + admin client guest lookup
4. Unknown hotel slug → `notFound()` in `[hotelId]/layout.tsx`

---

## API routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/checkin/verify` | POST | Validates room + last name → sets `guests.auth_user_id` |
| `/api/checkin/complete` | POST | Updates guest with nationality/document/signature, sets `reservations.status = 'checked_in'` |
| `/api/chat/message` | POST | Find-or-create conversation → insert guest msg → call Claude Haiku → insert bot reply |
| `/api/experiences/request` | POST | Inserts into `requests` with `status: 'pending'` |

---

## Julia AI (Anthropic Claude Haiku)

`/api/chat/message/route.ts` — finds/creates conversation, inserts guest message, fetches last 10 messages, calls Claude:

```ts
const claudeResponse = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    system: systemPrompt,  // Julia persona, hotel name injected
    messages: conversationHistory.map(msg => ({
        role: msg.sender === 'guest' ? 'user' : 'assistant',
        content: msg.content,
    })),
});
```

The API key is `ANTHROPIC_API_KEY` (server-only, never `NEXT_PUBLIC_`).

---

## Pages and components

| File | Type | Description |
|------|------|-------------|
| `src/middleware.ts` | Middleware | Session guard for all `/{hotelId}/*` routes |
| `src/app/[hotelId]/layout.tsx` | Server | Fetches hotel theming, injects CSS vars. Calls `notFound()` for unknown slugs |
| `src/app/[hotelId]/page.tsx` | Server | Auth → guest → reservation → experiences (no `is_active` filter) → `<GuestDashboardClient>` |
| `src/app/[hotelId]/login/page.tsx` | Client | Anonymous sign-in + room/name verification |
| `src/app/[hotelId]/chat/page.tsx` | Server | Auth → guest → `<ChatClient>` |
| `src/app/[hotelId]/chat/ChatClient.tsx` | Client | Finds conversation, Realtime on `conversation_id`, sends via `/api/chat/message` |
| `src/app/[hotelId]/checkin/page.tsx` | Server | Auth → guest → reservation → `<CheckinClient>` |
| `src/app/[hotelId]/checkin/CheckinClient.tsx` | Client | 2-step: identity confirm → nationality/document/signature → POST `/api/checkin/complete` |
| `src/app/[hotelId]/profile/page.tsx` | Server | Auth → guest → reservation (with id) → hotel UUID → renders GuestRequestsClient + GuestReviewForm |
| `src/components/GuestDashboardClient.tsx` | Client | Greeting, stay cards, Julia card, **GuestRequestsClient (compact)**, experiences catalog, check-in link |
| `src/components/GuestRequestsClient.tsx` | Client | Real-time requests list. `compact` prop for dashboard card vs full profile view. Realtime on `guest_id` |
| `src/components/GuestReviewForm.tsx` | Client | Star picker (1-5) + comment textarea. Saves to `reviews` via browser Supabase client |
| `src/components/LogoutButton.tsx` | Client | `signOut()` → `router.replace('/{hotelId}/login')` |
| `src/components/BottomNav.tsx` | Client | Mobile bottom nav (Home, Chat, Profile) |

---

## RLS policies in Supabase (must exist for guest browser client to work)

| Policy | Table | Effect |
|--------|-------|--------|
| `messages_guest_select` | `messages` | Authenticated guests can SELECT messages where `conversation_id` belongs to their `guest_id` |
| `guests_read_own_requests` | `requests` | Authenticated guests can SELECT requests where `guest_id = auth.uid() guest record` |
| `guests_insert_own_review` | `reviews` | Authenticated guests can INSERT reviews for their own `guest_id` |

```sql
-- messages_guest_select
CREATE POLICY "messages_guest_select" ON public.messages FOR SELECT TO authenticated
USING (conversation_id IN (
  SELECT id FROM public.conversations
  WHERE guest_id = (SELECT id FROM public.guests WHERE auth_user_id = auth.uid() LIMIT 1)
));

-- guests_read_own_requests
CREATE POLICY "guests_read_own_requests" ON public.requests FOR SELECT TO authenticated
USING (guest_id = (SELECT id FROM public.guests WHERE auth_user_id = auth.uid() LIMIT 1));

-- guests_insert_own_review
CREATE POLICY "guests_insert_own_review" ON public.reviews FOR INSERT TO authenticated
WITH CHECK (guest_id = (SELECT id FROM public.guests WHERE auth_user_id = auth.uid() LIMIT 1));
```

---

## Multi-tenant theming

`[hotelId]/layout.tsx` fetches `hotels.primary_color` and `hotels.primary_color_light` and injects as CSS vars. Defaults: `#C9964A` / `#E2B96E`.

```ts
hotelData = {
    ...data,
    primary_color: data.primary_color ?? "#C9964A",
    primary_color_light: data.primary_color_light ?? "#E2B96E",
};
```

All UI uses `var(--hotel-primary)` and `var(--hotel-primary-light)`. Never hardcode gold hex in components.

---

## Framer Motion — TypeScript gotcha

Always import `type Variants` to avoid TypeScript errors with `transition` inside variant objects:

```ts
import { motion, AnimatePresence, type Variants } from "framer-motion";
const fadeUp: Variants = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.45 } } };
```

Do **not** use `ease: [0.22, 1, 0.36, 1]` (array) inside variants — use `ease: "easeOut"` or omit it.

---

## Environment variables

```
NEXT_PUBLIC_SUPABASE_URL         # Supabase project URL (safe for browser)
NEXT_PUBLIC_SUPABASE_ANON_KEY    # Supabase anon key (safe for browser)
SUPABASE_SERVICE_ROLE_KEY        # Service role — server only, NEVER NEXT_PUBLIC_
ANTHROPIC_API_KEY                # Claude API key — server only
```

All four must be set in Vercel. The GitHub repo **must remain private** — GitHub auto-revokes PATs found in public repo history.
