import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Only protect routes under /[hotelId]/* (dynamic hotel segments)
    // Skip: /api/*, static files, _next internals, root page
    const hotelRouteMatch = pathname.match(/^\/([^\/]+)(\/.*)?$/);
    if (!hotelRouteMatch) {
        return NextResponse.next();
    }

    const hotelId = hotelRouteMatch[1];

    // Skip Next.js internals, API routes, and static assets
    const skipSegments = ['_next', 'api', 'favicon.ico'];
    if (skipSegments.includes(hotelId)) {
        return NextResponse.next();
    }

    // The login page itself is always accessible — no redirect loop
    const subPath = hotelRouteMatch[2] ?? '/';
    if (subPath === '/login' || subPath.startsWith('/login')) {
        return NextResponse.next();
    }

    // Build a response we can attach cookie mutations to
    let response = NextResponse.next({
        request,
    });

    // Create a Supabase SSR client that reads/writes cookies on the request/response
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    );
                    response = NextResponse.next({ request });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // Refresh the session (rotates tokens if needed)
    const {
        data: { session },
    } = await supabase.auth.getSession();

    // No session → redirect to the hotel login page
    if (!session) {
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = `/${hotelId}/login`;
        // Preserve the original destination so we can redirect back after login
        loginUrl.searchParams.set('redirectTo', pathname);
        return NextResponse.redirect(loginUrl);
    }

    // Tenant isolation: verify the authenticated guest belongs to THIS hotel.
    // The hotel slug is stamped into user_metadata during login (zero extra DB queries).
    const sessionHotelSlug: string | undefined = session.user.user_metadata?.hotelSlug;
    if (!sessionHotelSlug || sessionHotelSlug !== hotelId) {
        // Guest is authenticated but for a different hotel — send them to THIS hotel's login.
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = `/${hotelId}/login`;
        loginUrl.searchParams.set('redirectTo', pathname);
        return NextResponse.redirect(loginUrl);
    }

    return response;
}

export const config = {
    // Match all paths except Next.js internals and static files
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
