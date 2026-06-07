import { getAdminSupabase } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";
import { notFound } from "next/navigation";

export const revalidate = 3600;

export default async function HotelLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ hotelId: string }>;
}) {
    const { hotelId } = await params;

    let hotelData: {
        name: string;
        primary_color: string;
        primary_color_light: string;
        logo_url?: string;
        category?: string;
    } | null = null;

    try {
        const { data, error } = await getAdminSupabase()
            .from('hotels')
            .select('name, primary_color, primary_color_light, logo_url')
            .eq('slug', hotelId)
            .single();

        if (!error && data) {
            hotelData = {
                primary_color: "#C9964A",
                primary_color_light: "#E2B96E",
                category: "Luxury Collection",
                ...data,
            };
        }
    } catch (e) {
        console.error("Hotel layout error:", e);
    }

    // Hotel slug not found in DB → 404
    if (!hotelData) notFound();

    const dynamicStyles = {
        '--hotel-primary': hotelData.primary_color,
        '--hotel-primary-light': hotelData.primary_color_light,
    } as React.CSSProperties;

    const initial = hotelData.name?.[0]?.toUpperCase() ?? 'S';
    const isUrl = (hotelData.logo_url?.length ?? 0) > 5;

    return (
        <div style={dynamicStyles} className="min-h-screen flex flex-col">

            {/* ── Top Navigation Bar ── */}
            <header className="px-5 py-3.5 flex items-center justify-between sticky top-0 z-50 border-b border-white/[0.06]"
                style={{ background: 'rgba(8,8,8,0.75)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}>

                <div className="flex items-center gap-3">
                    {/* Logo / Monogram */}
                    <div className="relative w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
                        style={{ background: `linear-gradient(135deg, ${hotelData.primary_color}30, ${hotelData.primary_color}15)`, border: `1px solid ${hotelData.primary_color}40`, boxShadow: `0 0 16px ${hotelData.primary_color}20` }}>
                        {isUrl ? (
                            <img src={hotelData.logo_url} alt="Logo" className="w-6 h-6 object-contain" />
                        ) : (
                            <span className="font-heading font-black text-lg" style={{ color: hotelData.primary_color }}>
                                {hotelData.logo_url || initial}
                            </span>
                        )}
                    </div>

                    {/* Hotel Name + Category */}
                    <div className="flex flex-col leading-none">
                        <span className="font-heading font-bold text-[15px] text-white tracking-wide">
                            {hotelData.name}
                        </span>
                        <div className="flex items-center gap-1 mt-[3px]">
                            {[...Array(5)].map((_, i) => (
                                <svg key={i} className="w-2.5 h-2.5" viewBox="0 0 24 24" fill={hotelData.primary_color}>
                                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                                </svg>
                            ))}
                            <span className="text-[10px] tracking-widest uppercase ml-1" style={{ color: `${hotelData.primary_color}80` }}>
                                {hotelData.category || 'Luxury Collection'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Right side: subtle indicator */}
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: hotelData.primary_color, boxShadow: `0 0 6px ${hotelData.primary_color}` }} />
            </header>

            {/* Dynamic Content */}
            <main className="flex-1 flex flex-col pb-24">
                {children}
            </main>

            <BottomNav hotelId={hotelId} />
        </div>
    );
}
