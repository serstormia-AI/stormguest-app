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

    const { data: guest, error: guestError } = await ssrSupabase
        .from('guests')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();
    if (guestError || !guest) redirect(`/${hotelId}/login`);

    const guestId = guest.id;

    // 3. Fetch hotel and experiences with admin client (public, non-sensitive data)
    const supabase = getAdminSupabase();

    const { data: hotelData } = await supabase
        .from('hotels')
        .select('id')
        .eq('slug', hotelId)
        .single();

    let experiences: Record<string, unknown>[] = [];

    if (hotelData) {
        const { data: expData } = await supabase
            .from('experiences')
            .select('*')
            .eq('hotel_id', hotelData.id)
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (expData) {
            experiences = expData;
        }
    }

    // 4. Pass data to the Client Component
    return (
        <GuestDashboardClient
            hotelId={hotelId}
            dbHotelId={hotelData?.id || ""}
            guestId={guestId}
            experiences={experiences}
        />
    );
}
