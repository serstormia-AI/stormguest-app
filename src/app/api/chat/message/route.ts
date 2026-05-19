import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAdminSupabase } from "@/lib/supabase";

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { content, guestId, dbHotelId, hotelId } = body as {
            content: string;
            guestId: string;
            dbHotelId: string;
            hotelId: string;
        };

        if (!content || !guestId || !dbHotelId || !hotelId) {
            return NextResponse.json(
                { error: "Faltan campos requeridos: content, guestId, dbHotelId, hotelId" },
                { status: 400 }
            );
        }

        const supabase = getAdminSupabase();

        // 1. Insert the guest message
        const { error: insertGuestError } = await supabase.from("messages").insert({
            hotel_id: dbHotelId,
            guest_id: guestId,
            sender_type: "guest",
            content,
        });

        if (insertGuestError) {
            console.error("Error inserting guest message:", insertGuestError);
            return NextResponse.json(
                { error: "No se pudo guardar el mensaje del huésped" },
                { status: 500 }
            );
        }

        // 2. Fetch last 10 messages for context (after the insert so the new one is included)
        const { data: recentMessages, error: fetchError } = await supabase
            .from("messages")
            .select("sender_type, content")
            .eq("hotel_id", dbHotelId)
            .eq("guest_id", guestId)
            .order("created_at", { ascending: false })
            .limit(10);

        if (fetchError) {
            console.error("Error fetching messages:", fetchError);
            return NextResponse.json(
                { error: "No se pudo obtener el historial de mensajes" },
                { status: 500 }
            );
        }

        const conversationHistory = (recentMessages ?? []).reverse();

        // 3. Fetch hotel name
        const { data: hotelData, error: hotelError } = await supabase
            .from("hotels")
            .select("name")
            .eq("id", dbHotelId)
            .single();

        if (hotelError || !hotelData) {
            console.error("Error fetching hotel:", hotelError);
            return NextResponse.json(
                { error: "Hotel no encontrado" },
                { status: 404 }
            );
        }

        const hotelName = hotelData.name as string;

        // 4. Call Anthropic Claude
        const systemPrompt = `Eres Julia, la Concierge Digital del ${hotelName}. Eres cálida, profesional y servicial.
Respuestas breves (1-3 oraciones). Siempre en español.
Puedes ayudar con: room service, limpieza, late check-out, información del hotel,
recomendaciones locales, solicitar amenities.
Cuando el huésped pide algo concreto (ej: toallas, desayuno), confirma que lo gestionas
de inmediato y dile el tiempo estimado (ej: "En 15 minutos estará en tu habitación.").`;

        const messages: Anthropic.MessageParam[] = conversationHistory.map((msg) => ({
            role: msg.sender_type === "guest" ? "user" : "assistant",
            content: msg.content as string,
        }));

        const claudeResponse = await anthropic.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 300,
            system: systemPrompt,
            messages,
        });

        const responseText =
            claudeResponse.content[0].type === "text"
                ? claudeResponse.content[0].text
                : "";

        // 5. Insert the bot response
        const { error: insertBotError } = await supabase.from("messages").insert({
            hotel_id: dbHotelId,
            guest_id: guestId,
            sender_type: "bot",
            content: responseText,
        });

        if (insertBotError) {
            console.error("Error inserting bot message:", insertBotError);
            return NextResponse.json(
                { error: "No se pudo guardar la respuesta de Julia" },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Error desconocido";
        console.error("Chat message route error:", error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
