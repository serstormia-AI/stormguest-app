import { createClient } from '@supabase/supabase-js';
import { createBrowserClient, createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Client-side Supabase instance (uses anon key)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Browser client for use in Client Components (with cookie-based session)
export const createBrowserSupabase = () =>
    createBrowserClient(supabaseUrl, supabaseAnonKey);

// Server-side admin client (uses service role key, bypassing RLS if needed)
export const getAdminSupabase = () => {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY is not defined in environment variables');
    }
    return createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
};

// Server Component client that reads/writes cookies — required for auth.getUser()
export async function createSSRSupabase() {
    const cookieStore = await cookies();
    return createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
            getAll() {
                return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
                try {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        cookieStore.set(name, value, options)
                    );
                } catch {
                    // setAll is called from a Server Component where mutations
                    // are not allowed — safe to ignore; middleware keeps tokens fresh.
                }
            },
        },
    });
}

// Get the current guest session metadata from an anonymous Supabase session.
// Returns null if no active session exists.
export async function getGuestSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) return null;

    return {
        userId: session.user.id,
        // user_metadata is set during signInAnonymously with the guest/reservation data
        guestData: session.user.user_metadata ?? null,
        expiresAt: session.expires_at,
    };
}
