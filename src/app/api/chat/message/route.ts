import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAdminSupabase } from "@/lib/supabase";

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { content, guestId, dbHotelId } = body as {
            content: string;
            guestId: string;
            dbHotelId: string;
        };

        if (!content || !guestId || !dbHotelId) {
            return NextResponse.json(
                { error: "Faltan campos requeridos: content, guestId, dbHotelId" },
                { status: 400 }
            );
        }

        const supabase = getAdminSupabase();

        // 1. Find or create conversation for this guest + hotel
        let convId: string;
        const { data: existing } = await supabase
            .from("conversations")
            .select("id")
            .eq("guest_id", guestId)
            .eq("hotel_id", dbHotelId)
            .maybeSingle();

        if (existing) {
            convId = existing.id;
        } else {
            const { data: newConv, error: convErr } = await supabase
                .from("conversations")
                .insert({ guest_id: guestId, hotel_id: dbHotelId, channel: "app", status: "open" })
                .select("id")
                .single();
            if (convErr || !newConv) {
                console.error("Error creating conversation:", convErr);
                return NextResponse.json({ error: "No se pudo crear la conversación" }, { status: 500 });
            }
            convId = newConv.id;
        }

        // 2. Insert guest message
        const { error: insertGuestError } = await supabase.from("messages").insert({
            conversation_id: convId,
            sender: "guest",
            content,
        });

        if (insertGuestError) {
            console.error("Error inserting guest message:", insertGuestError);
            return NextResponse.json({ error: "No se pudo guardar el mensaje" }, { status: 500 });
        }

        // 3. Fetch all context in parallel
        const [
            { data: recentMessages },
            { data: hotelData },
            { data: guestData },
            { data: experiences },
        ] = await Promise.all([
            supabase
                .from("messages")
                .select("sender, content")
                .eq("conversation_id", convId)
                .order("created_at", { ascending: false })
                .limit(10),
            supabase
                .from("hotels")
                .select("name, concierge_name, concierge_personality")
                .eq("id", dbHotelId)
                .single(),
            supabase
                .from("guests")
                .select("name, notes")
                .eq("id", guestId)
                .single(),
            supabase
                .from("experiences")
                .select("title, description, price")
                .eq("hotel_id", dbHotelId)
                .order("price", { ascending: true }),
        ]);

        // 4. Fetch guest reservation separately (no FK joins)
        const { data: reservation } = await supabase
            .from("reservations")
            .select("room_number, check_in, check_out, status")
            .eq("guest_id", guestId)
            .eq("hotel_id", dbHotelId)
            .order("check_in", { ascending: false })
            .limit(1)
            .single();

        const conciergeName = (hotelData as { concierge_name?: string } | null)?.concierge_name ?? "Julia";
        const hotelName = hotelData?.name ?? "el hotel";
        const guestName = guestData?.name ?? "el huésped";
        const guestNotes = guestData?.notes ?? "";

        const experiencesList = (experiences ?? [])
            .map((e) => `  - ${e.title}${e.description ? `: ${e.description}` : ""}${e.price ? ` ($${e.price})` : ""}`)
            .join("\n");

        const reservationInfo = reservation
            ? `Habitación: ${reservation.room_number} | Check-in: ${reservation.check_in} | Check-out: ${reservation.check_out}`
            : "Sin reserva activa";

        const personalityBlock = (hotelData as { concierge_personality?: string } | null)?.concierge_personality
            ? `\n${(hotelData as { concierge_personality?: string }).concierge_personality}\n`
            : "";

        // 5. Build rich system prompt
        const systemPrompt = `Sos ${conciergeName}, la Concierge Digital de ${hotelName}.${personalityBlock}
Sos cálida, profesional y resolutiva. Respondés siempre en español, con respuestas breves (1-3 oraciones).

HUÉSPED: ${guestName}
ESTADÍA: ${reservationInfo}
${guestNotes ? `NOTAS DEL HUÉSPED: ${guestNotes}` : ""}

SERVICIOS Y EXPERIENCIAS DISPONIBLES:
${experiencesList || "  - Consultá con recepción para conocer los servicios disponibles"}

PODÉS AYUDAR CON:
- Información sobre servicios del hotel y precios
- Solicitar room service, limpieza, amenities
- Recomendaciones locales y actividades
- Consultas sobre la estadía (horarios, facilidades)
- Coordinar servicios especiales

Cuando el huésped pide algo concreto, confirmá que lo gestionás de inmediato con tiempo estimado.
Si no podés resolver algo, decí que avisás a recepción.
Nunca inventés servicios o precios que no estén en la lista.`;

        // 6. Call Claude Haiku
        const conversationHistory = (recentMessages ?? []).reverse();
        const claudeMessages: Anthropic.MessageParam[] = conversationHistory.map((msg) => ({
            role: msg.sender === "guest" ? "user" : "assistant",
            content: msg.content as string,
        }));

        const validMessages =
            claudeMessages.length > 0 && claudeMessages[0].role === "user"
                ? claudeMessages
                : [{ role: "user" as const, content }];

        const claudeResponse = await anthropic.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 400,
            system: systemPrompt,
            messages: validMessages,
        });

        const responseText =
            claudeResponse.content[0].type === "text"
                ? claudeResponse.content[0].text
                : "Disculpá, no pude procesar tu mensaje. ¿Podés repetirlo?";

        // 7. Insert bot response
        const { error: insertBotError } = await supabase.from("messages").insert({
            conversation_id: convId,
            sender: "bot",
            content: responseText,
        });

        if (insertBotError) {
            console.error("Error inserting bot message:", insertBotError);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Error desconocido";
        console.error("Chat message route error:", error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
