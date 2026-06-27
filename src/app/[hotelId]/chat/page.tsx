import { getAdminSupabase } from "@/lib/supabase";
import { createSSRSupabase } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import ChatClient from "./ChatClient";

export const revalidate = 0;

export default async function GuestChatPage({ params }: { params: Promise<{ hotelId: string }> }) {
    const { hotelId } = await params;

    const ssrSupabase = await createSSRSupabase();
    const { data: { user }, error: authError } = await ssrSupabase.auth.getUser();
    if (authError || !user) redirect(`/${hotelId}/login`);

    const supabase = getAdminSupabase();

    const { data: guest } = await supabase
        .from('guests')
        .select('id, hotel_id')
        .eq('auth_user_id', user.id)
        .single();
    if (!guest) redirect(`/${hotelId}/login`);

    // Fetch hotel concierge name
    const { data: hotel } = await supabase
        .from('hotels')
        .select('concierge_name')
        .eq('id', guest.hotel_id)
        .single();

    // Pre-fetch conversation ID and mode server-side (admin client bypasses RLS)
    const { data: conv } = await supabase
        .from('conversations')
        .select('id, mode')
        .eq('guest_id', guest.id)
        .eq('hotel_id', guest.hotel_id)
        .maybeSingle();

    return (
        <ChatClient
            hotelId={hotelId}
            guestId={guest.id}
            dbHotelId={guest.hotel_id}
            conciergeName={(hotel as { concierge_name?: string } | null)?.concierge_name ?? 'Julia'}
            initialConvId={conv?.id ?? null}
            initialMode={(conv as { mode?: string } | null)?.mode ?? 'bot'}
        />
    );
}
