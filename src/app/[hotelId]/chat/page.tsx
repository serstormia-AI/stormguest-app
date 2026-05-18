"use client";

import { motion } from "framer-motion";
import { use, useEffect, useState, useRef } from "react";
import { Send, ArrowLeft, Bot } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

// Instancia única del browser client (cookie-based session)
const supabase = createBrowserSupabase();

export default function GuestChatPage({ params }: { params: Promise<{ hotelId: string }> }) {
    const { hotelId } = use(params);
    const router = useRouter();
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [loading, setLoading] = useState(true);

    const [dbHotelId, setDbHotelId] = useState("");
    const [guestId, setGuestId] = useState("");

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Fetch initial data
    useEffect(() => {
        const initChat = async () => {
            // 1. Verificar sesión autenticada del huésped
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.replace(`/${hotelId}/login`);
                return;
            }

            // 2. Obtener el registro de guest vinculado al usuario autenticado
            const { data: guest } = await supabase
                .from('guests')
                .select('id, hotel_id')
                .eq('auth_user_id', user.id)
                .single();

            if (!guest) {
                router.replace(`/${hotelId}/login`);
                return;
            }

            setGuestId(guest.id);
            setDbHotelId(guest.hotel_id);

            // 3. Fetch Messages iniciales
            fetchMessages(guest.hotel_id, guest.id);
        };
        initChat();
    }, [hotelId]);

    const fetchMessages = async (hId: string, gId: string) => {
        const { data } = await supabase
            .from('messages')
            .select('*')
            .eq('hotel_id', hId)
            .eq('guest_id', gId)
            .order('created_at', { ascending: true });
        
        if (data) setMessages(data);
        setLoading(false);
        scrollToBottom();
    };

    // Suscripción en Tiempo Real
    useEffect(() => {
        if (!dbHotelId || !guestId) return;

        // Canal con nombre único por guest y filtro server-side para no recibir
        // mensajes de otros huéspedes
        const channel = supabase
            .channel(`chat-${guestId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `guest_id=eq.${guestId}`
                },
                (payload) => {
                    setMessages(prev => [...prev, payload.new]);
                    scrollToBottom();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [dbHotelId, guestId]);

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
    };

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !dbHotelId || !guestId) return;

        const msgText = newMessage.trim();
        setNewMessage(""); 

        const { error } = await supabase.from('messages').insert({
            hotel_id: dbHotelId,
            guest_id: guestId,
            sender_type: 'guest',
            content: msgText
        });

        if (error) {
            console.error("Error inserting message:", error);
            alert("No se pudo enviar el mensaje. Revisa la consola.");
        }
    };

    // Quick actions for the guest to tap easily
    const quickActions = ["Room Service", "Limpieza", "Late Check-out"];

    const handleQuickAction = (action: string) => {
        setNewMessage(action);
        // We could auto-send here, but letting them see it in the input is safer
    };

    return (
        <div className="flex-1 flex flex-col h-screen max-w-lg mx-auto w-full relative">
            {/* Background Base */}
            <div className="fixed inset-0 bg-[#0A0A0A] -z-20" />
            <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-hotel-primary/5 rounded-full blur-[100px] -z-10 pointer-events-none" />

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-48 hide-scrollbar mt-4">
                {/* Welcome Message */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 text-stone-200 rounded-[2rem] rounded-tl-sm p-5 max-w-[85%] text-[15px] leading-relaxed shadow-lg">
                        ¡Hola! Soy Julia, tu Concierge Digital. ¿En qué puedo asistirte durante tu estadía?
                    </div>
                </motion.div>

                {messages.map((msg, idx) => {
                    const isGuest = msg.sender_type === 'guest';
                    return (
                        <motion.div 
                            key={msg.id || idx} 
                            initial={{ opacity: 0, y: 10 }} 
                            animate={{ opacity: 1, y: 0 }} 
                            className={`flex ${isGuest ? 'justify-end' : 'justify-start'}`}
                        >
                            <div className={`p-5 max-w-[85%] text-[15px] leading-relaxed shadow-lg ${
                                isGuest 
                                ? 'bg-hotel-primary text-black font-medium rounded-[2rem] rounded-tr-sm' 
                                : 'bg-white/5 backdrop-blur-xl border border-white/10 text-stone-200 rounded-[2rem] rounded-tl-sm'
                            }`}>
                                {msg.content}
                            </div>
                        </motion.div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area (Fixed at bottom above nav) */}
            <div className="fixed bottom-[100px] left-0 w-full px-6 z-40">
                <div className="max-w-md mx-auto flex flex-col space-y-3">
                    {/* Quick Actions Scroll */}
                    <div className="flex space-x-2 overflow-x-auto hide-scrollbar pb-1">
                        {quickActions.map((action) => (
                            <button
                                key={action}
                                onClick={() => handleQuickAction(action)}
                                className="whitespace-nowrap px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 text-xs font-medium text-white transition-all active:scale-95"
                            >
                                {action}
                            </button>
                        ))}
                    </div>

                    {/* Chat Input Pill */}
                    <form onSubmit={sendMessage} className="relative flex items-center bg-[#121212]/80 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-1.5 shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
                        <input 
                            type="text" 
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Escribe aquí..." 
                            className="flex-1 bg-transparent border-none text-white px-5 py-3 focus:outline-none placeholder:text-stone-500 text-[15px]"
                        />
                        <button 
                            type="submit" 
                            disabled={!newMessage.trim()}
                            className="w-12 h-12 rounded-full bg-hotel-primary flex items-center justify-center text-black hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100 mr-1"
                        >
                            <Send className="w-5 h-5 ml-1" />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
