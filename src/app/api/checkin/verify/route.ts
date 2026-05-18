import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase";

// Normalize strings for case-insensitive + accent-insensitive comparison
function normalizeString(str: string): string {
    return str.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { reservationId, roomNumber, lastName, hotelId, authUserId } = body;

        // authUserId and lastName are always required. One of reservationId or roomNumber must be present.
        if (!lastName || !hotelId || !authUserId) {
            return NextResponse.json(
                { error: "Faltan datos requeridos (lastName, hotelId, authUserId)" },
                { status: 400 }
            );
        }

        if (!reservationId && !roomNumber) {
            return NextResponse.json(
                { error: "Se requiere reservationId o roomNumber" },
                { status: 400 }
            );
        }

        // Use the admin client — user is not authenticated yet.
        const supabase = getAdminSupabase();

        // 1. Find the hotel by slug to get its UUID
        const { data: hotelData, error: hotelError } = await supabase
            .from('hotels')
            .select('id')
            .eq('slug', hotelId)
            .single();

        if (hotelError || !hotelData) {
            return NextResponse.json({ error: "Hotel no encontrado" }, { status: 404 });
        }

        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        let reservation: any = null;
        let resError: any = null;

        // Only reservations in an active state are accepted.
        // 'cancelled', 'checked_out', and 'pending' are all rejected.
        const ACTIVE_STATUSES = ['confirmed', 'checked_in'] as const;

        if (reservationId) {
            // ── Flow A: Verify by PMS reservation ID (used by the check-in flow) ──
            ({ data: reservation, error: resError } = await supabase
                .from('reservations')
                .select(`
                    id,
                    pms_id,
                    status,
                    checkin_date,
                    checkout_date,
                    room_number,
                    guests!inner (
                        id,
                        first_name,
                        last_name
                    )
                `)
                .eq('hotel_id', hotelData.id)
                .eq('pms_id', reservationId.trim().toUpperCase())
                .in('status', ACTIVE_STATUSES)
                .single());
        } else {
            // ── Flow B: Verify by room number (used by the guest login page) ──
            // Requires an active reservation (checkout_date >= today)
            ({ data: reservation, error: resError } = await supabase
                .from('reservations')
                .select(`
                    id,
                    pms_id,
                    status,
                    checkin_date,
                    checkout_date,
                    room_number,
                    guests!inner (
                        id,
                        first_name,
                        last_name
                    )
                `)
                .eq('hotel_id', hotelData.id)
                .eq('room_number', roomNumber.trim())
                .gte('checkout_date', today)
                .in('status', ACTIVE_STATUSES)
                // Prefer the reservation whose check-in date is closest to today
                .order('checkin_date', { ascending: false })
                .limit(1)
                .single());
        }

        if (resError || !reservation) {
            return NextResponse.json(
                { error: "No pudimos encontrar una reserva activa con esos datos" },
                { status: 404 }
            );
        }

        // 2. Verify checkout date is not in the past (for reservation ID flow too)
        if (reservation.checkout_date < today) {
            return NextResponse.json(
                { error: "La reserva ya venció. Si necesitas ayuda contacta recepción." },
                { status: 401 }
            );
        }

        // 3. Verify last name (case-insensitive, accent-insensitive)
        const guestLastName = normalizeString((reservation.guests as any).last_name);
        const inputLastName = normalizeString(lastName);

        if (guestLastName !== inputLastName) {
            return NextResponse.json(
                { error: "El apellido no coincide con la reserva" },
                { status: 401 }
            );
        }

        // 4. Link the anonymous auth session to the guest profile
        const { error: updateError } = await supabase
            .from('guests')
            .update({ auth_user_id: authUserId })
            .eq('id', (reservation.guests as any).id);

        if (updateError) {
            console.error("Error updating guest auth_user_id:", updateError);
            return NextResponse.json(
                { error: "Error al asegurar la sesión del huésped." },
                { status: 500 }
            );
        }

        // 5. Return verified guest + reservation data
        return NextResponse.json({
            success: true,
            reservation: {
                id: reservation.id,
                pmsId: reservation.pms_id,
                status: reservation.status,
                guestName: `${(reservation.guests as any).first_name} ${(reservation.guests as any).last_name}`,
                guestId: (reservation.guests as any).id,
                roomNumber: reservation.room_number,
                checkinDate: reservation.checkin_date,
                checkoutDate: reservation.checkout_date,
            }
        });

    } catch (error: any) {
        console.error("Check-in verify error:", error);
        return NextResponse.json(
            { error: "Ocurrió un error al verificar la reserva." },
            { status: 500 }
        );
    }
}
