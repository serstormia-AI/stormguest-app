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

        // 3. Fetch last 10 messages for Claude context
        const { data: recentMessages } = await supabase
            .from("messages")
            .select("sender, content")
            .eq("conversation_id", convId)
            .order("created_at", { ascending: false })
            .limit(10);

        const conversationHistory = (recentMessages ?? []).reverse();

        // 4. Fetch hotel name
        const { data: hotelData } = await supabase
            .from("hotels")
            .select("name")
            .eq("id", dbHotelId)
            .single();

        const hotelName = (hotelData?.name as string) ?? "el hotel";

        // 5. Call Claude Haiku
        const systemPrompt = `Eres Julia, la Concierge Digital del ${hotelName}. Eres cálida, profesional y servicial.
Respuestas breves (1-3 oraciones). Siempre en español.
Podés ayudar con: room service, limpieza, late check-out, información del hotel,
recomendaciones locales, solicitar amenities.
Cuando el huésped pide algo concreto (ej: toallas, desayuno), confirmá que lo gestionás
de inmediato y decile el tiempo estimado (ej: "En 15 minutos estará en tu habitación.").`;

        const claudeMessages: Anthropic.MessageParam[] = conversationHistory.map((msg) => ({
            role: msg.sender === "guest" ? "user" : "assistant",
            content: msg.content as string,
        }));

        // Ensure conversation starts with a user message
        const validMessages = claudeMessages.length > 0 && claudeMessages[0].role === "user"
            ? claudeMessages
            : [{ role: "user" as const, content }];

        const claudeResponse = await anthropic.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 300,
            system: systemPrompt,
            messages: validMessages,
        });

        const responseText =
            claudeResponse.content[0].type === "text"
                ? claudeResponse.content[0].text
                : "Disculpá, no pude procesar tu mensaje. ¿Podés repetirlo?";

        // 6. Insert bot response
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
