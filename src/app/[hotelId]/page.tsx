import { getAdminSupabase } from "@/lib/supabase";
import { createSSRSupabase } from "@/lib/supabase-server";
import GuestDashboardClient from "@/components/GuestDashboardClient";
import { redirect } from "next/navigation";

export const revalidate = 0; // Dynamic

export default async function GuestDashboardPage({ params }: { params: Promise<{ hotelId: string }> }) {
    // 1. Resolve Params
    const { hotelId } = await params;

    // 2. Identify the authenticated guest via the SSR client (cookie-based session)
    const ssrSupabase = await createSSRSupabase();
    const { data: { user }, error: authError } = await ssrSupabase.auth.getUser();
    if (authError || !user) redirect(`/${hotelId}/login`);

    // Use admin client so RLS doesn't block the auth_user_id lookup
    // (identity already verified above via getUser())
    const adminSupabase = getAdminSupabase();
    const { data: guest } = await adminSupabase
        .from('guests')
        .select('id, name')
        .eq('auth_user_id', user.id)
        .single();
    if (!guest) redirect(`/${hotelId}/login`);

    const guestId = guest.id;
    const guestName: string = guest.name ?? 'Huésped';

    // 3. Fetch hotel and experiences with admin client (public, non-sensitive data)
    const supabase = getAdminSupabase();

    const { data: hotelData } = await supabase
        .from('hotels')
        .select('id')
        .eq('slug', hotelId)
        .single();

    type Experience = { id: string; title: string; price: number; currency: string; description: string; image_url: string; };
    let experiences: Experience[] = [];

    if (hotelData) {
        const { data: expData } = await supabase
            .from('experiences')
            .select('id, title, description, price, image_url')
            .eq('hotel_id', hotelData.id)
            .order('created_at', { ascending: false });

        if (expData) {
            experiences = expData;
        }
    }

    // Fetch active reservation for the guest
    const today = new Date().toISOString().split('T')[0];
    const { data: reservation } = await supabase
        .from('reservations')
        .select('room_number, check_in, check_out')
        .eq('guest_id', guestId)
        .gte('check_out', today)
        .order('check_in', { ascending: false })
        .limit(1)
        .maybeSingle();

    // 4. Pass data to the Client Component
    return (
        <GuestDashboardClient
            hotelId={hotelId}
            dbHotelId={hotelData?.id || ""}
            guestId={guestId}
            experiences={experiences}
            guestName={guestName}
            roomNumber={reservation?.room_number ?? ''}
            checkOut={reservation?.check_out ?? null}
        />
    );
}
