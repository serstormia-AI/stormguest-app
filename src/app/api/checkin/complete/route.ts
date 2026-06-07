import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase";

export async function POST(request: Request) {
    try {
        const { guestId, reservationId, nationality, documentNumber, signature } = await request.json();

        if (!guestId || !nationality || !documentNumber) {
            return NextResponse.json({ error: "Faltan datos requeridos" }, { status: 400 });
        }

        const supabase = getAdminSupabase();

        // Update guest with legal data
        const { error: guestError } = await supabase
            .from("guests")
            .update({
                nationality,
                document_number: documentNumber,
                ...(signature ? { signature } : {}),
            })
            .eq("id", guestId);

        if (guestError) {
            // Columns might not exist yet — store in notes as fallback
            await supabase
                .from("guests")
                .update({ notes: JSON.stringify({ nationality, documentNumber }) })
                .eq("id", guestId);
        }

        // Update reservation status
        if (reservationId) {
            await supabase
                .from("reservations")
                .update({ status: "checked_in" })
                .eq("id", reservationId);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
