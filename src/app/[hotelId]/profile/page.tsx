import { getAdminSupabase } from "@/lib/supabase";
import { createSSRSupabase } from "@/lib/supabase-server";
import { User, KeyRound, Calendar, CreditCard, Receipt } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const revalidate = 0; // Dynamic

export default async function GuestProfilePage({ params }: { params: Promise<{ hotelId: string }> }) {
    const { hotelId } = await params;

    // 1. Identify the authenticated guest via the SSR client (cookie-based session)
    const ssrSupabase = await createSSRSupabase();
    const { data: { user }, error: authError } = await ssrSupabase.auth.getUser();
    if (authError || !user) redirect(`/${hotelId}/login`);

    const { data: guest, error: guestError } = await ssrSupabase
        .from('guests')
        .select('*')
        .eq('auth_user_id', user.id)
        .single();
    if (guestError || !guest) redirect(`/${hotelId}/login`);

    // 2. Get Hotel (non-sensitive, can use admin client)
    const supabase = getAdminSupabase();
    const { data: hotel } = await supabase.from('hotels').select('id, name, primary_color').eq('slug', hotelId).single();
    if (!hotel) return <div>Hotel not found</div>;

    // 3. Get Reservation
    const { data: reservation } = await supabase.from('reservations').select('*').eq('guest_id', guest.id).order('created_at', { ascending: false }).limit(1).single();

    // 4. Get Requests (Estado de Cuenta)
    const { data: requests } = await supabase.from('requests')
        .select(`
            *,
            experiences ( title )
        `)
        .eq('guest_id', guest.id)
        .order('created_at', { ascending: false });

    // Calculate total folio
    const totalFolio = requests?.reduce((sum, req) => sum + Number(req.total_price), 0) || 0;

    return (
        <div className="flex-1 p-6 pb-24 max-w-lg mx-auto w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="space-y-1 mt-4">
                <h2 className="font-heading text-3xl font-bold text-white">Mi Perfil</h2>
                <p className="text-stone-400 text-sm">{hotel.name}</p>
            </div>

            {/* Guest Info Card */}
            <div className="bg-zinc-900 border border-white/10 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-hotel-primary/10 rounded-full -mr-10 -mt-10 blur-2xl" />
                
                <div className="flex items-center space-x-4 mb-6 relative z-10">
                    <div className="w-16 h-16 rounded-full bg-hotel-primary/20 flex items-center justify-center border border-hotel-primary/30">
                        <User className="w-8 h-8 text-hotel-primary" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white">{guest.first_name} {guest.last_name}</h3>
                        <p className="text-sm text-stone-400">{guest.email}</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 relative z-10">
                    <div className="bg-black/30 rounded-2xl p-4 border border-white/5">
                        <KeyRound className="w-5 h-5 text-hotel-primary mb-2" />
                        <p className="text-xs text-stone-500">Habitación</p>
                        <p className="font-bold text-white text-lg">{reservation?.room_number || 'Pendiente'}</p>
                    </div>
                    <div className="bg-black/30 rounded-2xl p-4 border border-white/5">
                        <Calendar className="w-5 h-5 text-hotel-primary mb-2" />
                        <p className="text-xs text-stone-500">Check-out</p>
                        <p className="font-bold text-white text-sm">
                            {reservation?.checkout_date ? new Date(reservation.checkout_date).toLocaleDateString() : '-'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Estado de Cuenta */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-heading text-xl font-bold text-white flex items-center">
                        <Receipt className="w-5 h-5 mr-2 text-hotel-primary" /> Estado de Cuenta
                    </h3>
                </div>

                <div className="bg-zinc-900 border border-white/10 rounded-3xl p-6 shadow-xl space-y-6">
                    
                    {/* Lista de Consumos */}
                    <div className="space-y-4">
                        {(!requests || requests.length === 0) ? (
                            <p className="text-stone-500 text-sm text-center py-4">No tienes consumos adicionales.</p>
                        ) : (
                            requests.map(req => (
                                <div key={req.id} className="flex justify-between items-center border-b border-white/5 pb-4 last:border-0 last:pb-0">
                                    <div className="flex flex-col">
                                        <span className="text-white font-medium">{req.experiences?.title || 'Servicio'}</span>
                                        <span className="text-xs text-stone-500">{new Date(req.created_at).toLocaleString()}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-white font-bold">${req.total_price}</span>
                                        <div className="text-[10px] uppercase text-hotel-primary tracking-wider">{req.status}</div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Total */}
                    <div className="bg-black/40 rounded-2xl p-5 border border-white/5 flex justify-between items-center">
                        <div>
                            <p className="text-sm text-stone-400">Total a pagar</p>
                            <p className="text-xs text-stone-600">Se abonará en recepción</p>
                        </div>
                        <p className="font-heading text-3xl font-bold text-hotel-primary">${totalFolio.toFixed(2)}</p>
                    </div>
                </div>
            </div>

            {/* Settings (Mock) */}
            <div className="space-y-2 pt-4">
                <button className="w-full bg-zinc-900 border border-white/10 text-stone-300 py-4 px-6 rounded-2xl flex justify-between items-center hover:bg-zinc-800 transition-colors">
                    <span className="font-medium">Gestionar Tarjetas</span>
                    <CreditCard className="w-5 h-5 text-stone-500" />
                </button>
            </div>
        </div>
    );
}
