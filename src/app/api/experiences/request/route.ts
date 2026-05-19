import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { guestId, dbHotelId, experienceId, totalPrice } = body as {
            guestId: string;
            dbHotelId: string;
            experienceId: string;
            totalPrice: number;
        };

        if (!guestId || !dbHotelId || !experienceId || totalPrice == null) {
            return NextResponse.json({ error: "Faltan datos requeridos" }, { status: 400 });
        }

        const supabase = getAdminSupabase();

        const { error } = await supabase.from("requests").insert({
            hotel_id: dbHotelId,
            guest_id: guestId,
            experience_id: experienceId,
            total_price: totalPrice,
            status: "pending",
        });

        if (error) {
            console.error("Error inserting request:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
