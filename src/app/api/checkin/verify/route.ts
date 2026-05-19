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
            return NextResponse.json(
                { error: "Faltan datos requeridos" },
                { status: 400 }
            );
        }

        if (!reservationId && !roomNumber) {
            return NextResponse.json(
                { error: "Se requiere reservationId o roomNumber" },
                { status: 400 }
            );
        }

        const supabase = getAdminSupabase();

        const { data: hotelData, error: hotelError } = await supabase
            .from('hotels')
            .select('id')
            .eq('slug', hotelId)
            .single();

        if (hotelError || !hotelData) {
            return NextResponse.json({ error: "Hotel no encontrado" }, { status: 404 });
        }

        const today = new Date().toISOString().split('T')[0];
        const ACTIVE_STATUSES = ['confirmed', 'checked_in'];

        let reservation: any = null;
        let resError: any = null;

        if (reservationId) {
            ({ data: reservation, error: resError } = await supabase
                .from('reservations')
                .select(`id, status, check_in, check_out, room_number, guests!inner(id, name)`)
                .eq('hotel_id', hotelData.id)
                .eq('id', reservationId.trim())
                .in('status', ACTIVE_STATUSES)
                .single());
        } else {
            ({ data: reservation, error: resError } = await supabase
                .from('reservations')
                .select(`id, status, check_in, check_out, room_number, guests!inner(id, name)`)
                .eq('hotel_id', hotelData.id)
                .eq('room_number', roomNumber.trim())
                .gte('check_out', today)
                .in('status', ACTIVE_STATUSES)
                .order('check_in', { ascending: false })
                .limit(1)
                .single());
        }

        if (resError || !reservation) {
            return NextResponse.json(
                { error: "No pudimos encontrar una reserva activa con esos datos" },
                { status: 404 }
            );
        }

        // guests.name es "Carlos Garcia" — comparamos contra la última palabra
        const guestName: string = (reservation.guests as any).name ?? '';
        const guestLastName = normalizeString(guestName.split(' ').pop() ?? guestName);
        const inputLastName = normalizeString(lastName);

        if (guestLastName !== inputLastName) {
            return NextResponse.json(
                { error: "El apellido no coincide con la reserva" },
                { status: 401 }
            );
        }

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

        return NextResponse.json({
            success: true,
            reservation: {
                id: reservation.id,
                status: reservation.status,
                guestName: guestName,
                guestId: (reservation.guests as any).id,
                roomNumber: reservation.room_number,
                checkinDate: reservation.check_in,
                checkoutDate: reservation.check_out,
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
