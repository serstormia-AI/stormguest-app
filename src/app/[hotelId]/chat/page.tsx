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

    return (
        <ChatClient
            hotelId={hotelId}
            guestId={guest.id}
            dbHotelId={guest.hotel_id}
        />
    );
}
