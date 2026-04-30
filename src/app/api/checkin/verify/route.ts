import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { reservationId, lastName, hotelId, authUserId } = body;

        if (!reservationId || !lastName || !hotelId || !authUserId) {
            return NextResponse.json(
                { error: "Faltan datos requeridos (reservationId, lastName, hotelId, authUserId)" },
                { status: 400 }
            );
        }

        // We use the admin client because the user is not authenticated yet.
        // We need to safely verify the reservation based on exact matches.
        const supabase = getAdminSupabase();

        // 1. First find the hotel by slug to get its UUID
        const { data: hotelData, error: hotelError } = await supabase
            .from('hotels')
            .select('id')
            .eq('slug', hotelId)
            .single();

        if (hotelError || !hotelData) {
            return NextResponse.json({ error: "Hotel no encontrado" }, { status: 404 });
        }

        // 2. Search for the reservation matching the pms_id and hotel UUID
        // We join with guests to verify the last name.
        const { data: reservation, error: resError } = await supabase
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
            .single();

        if (resError || !reservation) {
            return NextResponse.json(
                { error: "No pudimos encontrar una reserva con ese ID" },
                { status: 404 }
            );
        }

        // 3. Verify Last Name (case insensitive & ignore accents)
        const normalizeString = (str: string) => {
            return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
        };

        const guestLastName = normalizeString((reservation.guests as any).last_name);
        const inputLastName = normalizeString(lastName);

        if (guestLastName !== inputLastName) {
            return NextResponse.json(
                { error: "El apellido no coincide con la reserva" },
                { status: 400 }
            );
        }

        // 4. Enlazar la sesión anónima (auth.uid) con el perfil del huésped en la DB
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

        // All good!
        return NextResponse.json({
            success: true,
            reservation: {
                id: reservation.id,
                status: reservation.status,
                guestName: `${(reservation.guests as any).first_name} ${(reservation.guests as any).last_name}`,
                checkinDate: reservation.checkin_date
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
