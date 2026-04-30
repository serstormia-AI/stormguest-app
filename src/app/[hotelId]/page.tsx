import { getAdminSupabase } from "@/lib/supabase";
import GuestDashboardClient from "@/components/GuestDashboardClient";

export const revalidate = 0; // Dynamic

export default async function GuestDashboardPage({ params }: { params: Promise<{ hotelId: string }> }) {
    // 1. Resolve Params
    const { hotelId } = await params;

    // 2. Fetch data from Supabase on the server
    const supabase = getAdminSupabase();
    
    // First find the hotel internal UUID
    const { data: hotelData } = await supabase
        .from('hotels')
        .select('id')
        .eq('slug', hotelId)
        .single();

    let experiences = [];
    let guestId = "";
    
    if (hotelData) {
        // Fetch active experiences
        const { data: expData } = await supabase
            .from('experiences')
            .select('*')
            .eq('hotel_id', hotelData.id)
            .eq('is_active', true)
            .order('created_at', { ascending: false });
            
        if (expData) {
            experiences = expData;
        }

        // Fetch mock guest
        const { data: guest } = await supabase
            .from('guests')
            .select('id')
            .eq('hotel_id', hotelData.id)
            .limit(1)
            .single();
        
        if (guest) {
            guestId = guest.id;
        }
    }

    // 3. Pass data to the Client Component
    return (
        <GuestDashboardClient 
            hotelId={hotelId} 
            dbHotelId={hotelData?.id || ""}
            guestId={guestId}
            experiences={experiences} 
        />
    );
}
