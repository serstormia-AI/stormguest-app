import { getAdminSupabase } from "@/lib/supabase";
import { createSSRSupabase } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import CheckinClient from "./CheckinClient";

export const revalidate = 0;

export default async function CheckinPage({ params }: { params: Promise<{ hotelId: string }> }) {
    const { hotelId } = await params;

    // Guest must be authenticated
    const ssrSupabase = await createSSRSupabase();
    const { data: { user }, error: authError } = await ssrSupabase.auth.getUser();
    if (authError || !user) redirect(`/${hotelId}/login`);

    const supabase = getAdminSupabase();

    // Fetch guest
    const { data: guest } = await supabase
        .from('guests')
        .select('id, name')
        .eq('auth_user_id', user.id)
        .single();
    if (!guest) redirect(`/${hotelId}/login`);

    // Fetch active reservation
    const today = new Date().toISOString().split('T')[0];
    const { data: reservation } = await supabase
        .from('reservations')
        .select('id, room_number, check_in, check_out, status')
        .eq('guest_id', guest.id)
        .gte('check_out', today)
        .order('check_in', { ascending: false })
        .limit(1)
        .maybeSingle();

    return (
        <CheckinClient
            hotelId={hotelId}
            guestId={guest.id}
            guestName={guest.name}
            reservationId={reservation?.id ?? null}
            roomNumber={reservation?.room_number ?? null}
            alreadyCheckedIn={reservation?.status === 'checked_in'}
        />
    );
}
