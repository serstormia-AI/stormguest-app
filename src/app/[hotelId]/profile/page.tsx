import { getAdminSupabase } from "@/lib/supabase";
import { createSSRSupabase } from "@/lib/supabase-server";
import { User, KeyRound, Calendar, Receipt } from "lucide-react";
import { redirect } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";
import GuestRequestsClient from "@/components/GuestRequestsClient";
import GuestReviewForm from "@/components/GuestReviewForm";

export const revalidate = 0;

function formatDate(iso: string) {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es', {
        day: 'numeric', month: 'long', year: 'numeric'
    });
}


function getInitials(name: string) {
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default async function GuestProfilePage({ params }: { params: Promise<{ hotelId: string }> }) {
    const { hotelId } = await params;

    const ssrSupabase = await createSSRSupabase();
    const { data: { user }, error: authError } = await ssrSupabase.auth.getUser();
    if (authError || !user) redirect(`/${hotelId}/login`);

    const supabase = getAdminSupabase();

    const { data: guest } = await supabase
        .from('guests').select('id, name, email, nationality, document_number')
        .eq('auth_user_id', user.id).single();
    if (!guest) redirect(`/${hotelId}/login`);

    const today = new Date().toISOString().split('T')[0];
    const { data: reservation } = await supabase
        .from('reservations').select('id, room_number, check_in, check_out, status')
        .eq('guest_id', guest.id)
        .gte('check_out', today)
        .order('check_in', { ascending: false })
        .limit(1).maybeSingle();

    // Get hotel UUID for review form
    const { data: hotelData } = await supabase
        .from('hotels').select('id').eq('slug', hotelId).single();
    const dbHotelId = hotelData?.id ?? '';

    const initials = getInitials(guest.name || 'Huésped');

    return (
        <div className="flex-1 px-5 pt-6 pb-28 max-w-lg mx-auto w-full space-y-6">

            {/* Ambient */}
            <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[500px] h-[400px] rounded-full pointer-events-none -z-10"
                style={{ background: 'radial-gradient(circle, var(--hotel-primary) 0%, transparent 70%)', opacity: 0.05 }} />

            {/* Header */}
            <div className="pt-2">
                <p className="text-[11px] tracking-[0.2em] uppercase mb-1" style={{ color: 'var(--hotel-primary)' }}>Tu cuenta</p>
                <h2 className="font-heading text-[2rem] font-bold text-white leading-tight">Mi Perfil</h2>
            </div>

            {/* ── Guest identity card ── */}
            <div className="rounded-3xl p-6 relative overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>

                {/* Decorative glow */}
                <div className="absolute top-0 right-0 w-40 h-40 rounded-full pointer-events-none"
                    style={{ background: 'var(--hotel-primary)', opacity: 0.06, transform: 'translate(40%, -40%)' }} />

                <div className="flex items-center gap-4 mb-6 relative z-10">
                    {/* Avatar */}
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-heading font-black text-xl flex-shrink-0"
                        style={{
                            background: 'linear-gradient(135deg, rgba(201,150,74,0.25) 0%, rgba(201,150,74,0.1) 100%)',
                            border: '1px solid rgba(201,150,74,0.35)',
                            color: 'var(--hotel-primary)',
                        }}>
                        {initials}
                    </div>
                    <div>
                        <h3 className="font-heading text-xl font-bold text-white leading-tight">{guest.name}</h3>
                        {guest.email && (
                            <p className="text-sm mt-0.5" style={{ color: 'rgba(240,235,227,0.4)' }}>{guest.email}</p>
                        )}
                        {guest.nationality && (
                            <p className="text-xs mt-1" style={{ color: 'rgba(240,235,227,0.3)' }}>
                                {guest.nationality} {guest.document_number && `· ${guest.document_number}`}
                            </p>
                        )}
                    </div>
                </div>

                {/* Stay info */}
                <div className="grid grid-cols-2 gap-3 relative z-10">
                    <div className="rounded-2xl p-4" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <KeyRound className="w-4 h-4 mb-2" style={{ color: 'var(--hotel-primary)' }} />
                        <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'rgba(240,235,227,0.35)' }}>Habitación</p>
                        <p className="font-heading font-bold text-white text-xl">{reservation?.room_number || '—'}</p>
                    </div>
                    <div className="rounded-2xl p-4" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <Calendar className="w-4 h-4 mb-2" style={{ color: 'rgba(240,235,227,0.35)' }} />
                        <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'rgba(240,235,227,0.35)' }}>Check-out</p>
                        <p className="font-heading font-bold text-white text-sm leading-snug">
                            {reservation?.check_out ? formatDate(reservation.check_out) : '—'}
                        </p>
                    </div>
                </div>

                {/* Stay status */}
                {reservation && (
                    <div className="mt-3 flex items-center gap-2 relative z-10">
                        <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#10b981' }} />
                        <span className="text-xs" style={{ color: 'rgba(240,235,227,0.4)' }}>
                            Estadía activa · desde {formatDate(reservation.check_in)}
                        </span>
                    </div>
                )}
            </div>

            {/* ── Estado de cuenta (real-time) ── */}
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4" style={{ color: 'var(--hotel-primary)' }} />
                    <h3 className="font-heading text-lg font-bold text-white">Estado de cuenta</h3>
                </div>
                <GuestRequestsClient guestId={guest.id} />
            </div>

            {/* ── Reseña ── */}
            <GuestReviewForm
                guestId={guest.id}
                dbHotelId={dbHotelId}
                reservationId={reservation?.id ?? null}
            />

            {/* ── Logout ── */}
            <LogoutButton hotelId={hotelId} />
        </div>
    );
}
