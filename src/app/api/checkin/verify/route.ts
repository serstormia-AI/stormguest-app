import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase";

function normalizeString(str: string): string {
    return str.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { reservationId, roomNumber, lastName, hotelId, authUserId } = body;

        if (!lastName || !hotelId || !authUserId) {
            return NextResponse.json({ error: "Faltan datos requeridos" }, { status: 400 });
        }
        if (!reservationId && !roomNumber) {
            return NextResponse.json({ error: "Se requiere reservationId o roomNumber" }, { status: 400 });
        }

        const supabase = getAdminSupabase();

        // 1. Buscar hotel por slug
        const { data: hotelData } = await supabase
            .from('hotels')
            .select('id')
            .eq('slug', hotelId)
            .single();

        if (!hotelData) {
            return NextResponse.json({ error: "Hotel no encontrado" }, { status: 404 });
        }

        const today = new Date().toISOString().split('T')[0];
        const ACTIVE_STATUSES = ['confirmed', 'checked_in'];

        // 2. Buscar reserva (sin join)
        let reservationQuery = supabase
            .from('reservations')
            .select('id, status, check_in, check_out, room_number, guest_id')
            .eq('hotel_id', hotelData.id)
            .in('status', ACTIVE_STATUSES);

        if (reservationId) {
            reservationQuery = reservationQuery.eq('id', reservationId.trim());
        } else {
            reservationQuery = reservationQuery
                .eq('room_number', roomNumber.trim())
                .gte('check_out', today)
                .order('check_in', { ascending: false })
                .limit(1);
        }

        const { data: reservation } = await reservationQuery.single();

        if (!reservation) {
            return NextResponse.json(
                { error: "No pudimos encontrar una reserva activa con esos datos" },
                { status: 404 }
            );
        }

        // 3. Buscar guest por separado
        const { data: guest } = await supabase
            .from('guests')
            .select('id, name')
            .eq('id', reservation.guest_id)
            .single();

        if (!guest) {
            return NextResponse.json(
                { error: "No pudimos encontrar una reserva activa con esos datos" },
                { status: 404 }
            );
        }

        // 4. Verificar apellido (última palabra del nombre)
        const guestLastName = normalizeString(guest.name.split(' ').pop() ?? guest.name);
        const inputLastName = normalizeString(lastName);

        if (guestLastName !== inputLastName) {
            return NextResponse.json(
                { error: "El apellido no coincide con la reserva" },
                { status: 401 }
            );
        }

        // 5. Vincular sesión anónima al guest
        await supabase
            .from('guests')
            .update({ auth_user_id: authUserId })
            .eq('id', guest.id);

        return NextResponse.json({
            success: true,
            reservation: {
                id: reservation.id,
                status: reservation.status,
                guestName: guest.name,
                guestId: guest.id,
                roomNumber: reservation.room_number,
                checkinDate: reservation.check_in,
                checkoutDate: reservation.check_out,
            }
        });

    } catch (error: any) {
        console.error("Check-in verify error:", error);
        return NextResponse.json({ error: "Ocurrió un error al verificar la reserva." }, { status: 500 });
    }
}
