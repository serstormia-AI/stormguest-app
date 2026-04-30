import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import BottomNav from "@/components/BottomNav";

export const revalidate = 3600; // Cache for 1 hour

export default async function HotelLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ hotelId: string }>;
}) {
    // Await params in Next.js 15+
    const resolvedParams = await params;
    const { hotelId } = resolvedParams;

    // 1. Fetch hotel data from Supabase
    let hotelData = null;
    
    try {
        const { data, error } = await supabase
            .from('hotels')
            .select('*')
            .eq('slug', hotelId)
            .single();
            
        if (!error && data) {
            hotelData = data;
        }
    } catch (e) {
        console.error("Supabase error:", e);
    }

    // Fallback Mock Data if Supabase is empty
    if (!hotelData) {
        if (hotelId === 'demo') {
            hotelData = {
                name: "Hotel Interamericano",
                primary_color: "#10b981", // Emerald
                primary_color_light: "#34d399",
                logo_url: "🏨"
            };
        } else {
            // Optional: return notFound() if strict
            hotelData = {
                name: "StormGuest Hotel",
                primary_color: "#3b82f6", // Blue
                primary_color_light: "#60a5fa",
                logo_url: "⚡"
            };
        }
    }

    // 2. Inject CSS Variables dynamically
    const dynamicStyles = {
        '--hotel-primary': hotelData.primary_color,
        '--hotel-primary-light': hotelData.primary_color_light,
    } as React.CSSProperties;

    return (
        <div style={dynamicStyles} className="min-h-screen flex flex-col">
            {/* Top Navigation Bar Dynamic */}
            <header className="px-6 py-4 border-b border-white/5 flex items-center justify-between backdrop-blur-md bg-black/20 sticky top-0 z-50">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-hotel-primary/20 flex items-center justify-center border border-hotel-primary/30">
                        {/* If logo_url is an emoji or URL */}
                        {hotelData.logo_url?.length < 5 ? (
                            <span className="text-xl">{hotelData.logo_url}</span>
                        ) : (
                            <img src={hotelData.logo_url} alt="Logo" className="w-6 h-6 object-contain" />
                        )}
                    </div>
                    <h1 className="font-heading font-bold text-lg tracking-wide text-white">
                        {hotelData.name}
                    </h1>
                </div>
            </header>

            {/* Dynamic Content */}
            <main className="flex-1 flex flex-col pb-24">
                {children}
            </main>

            {/* Bottom Navigation (Only show if not on checkin page) */}
            <BottomNav hotelId={hotelId} />
        </div>
    );
}
