"use client";

import { motion } from "framer-motion";
import { useEffect, useState, useRef } from "react";
import { Send } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase";

type Message = {
    id: string;
    hotel_id: string;
    guest_id: string;
    sender_type: "guest" | "staff" | "bot";
    content: string;
    created_at: string;
};

const supabase = createBrowserSupabase();

type Props = {
    hotelId: string;
    guestId: string;
    dbHotelId: string;
};

export default function ChatClient({ hotelId, guestId, dbHotelId }: Props) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const [isJuliaTyping, setIsJuliaTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchMessages();
    }, []);

    useEffect(() => {
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
                    setMessages(prev => [...prev, payload.new as Message]);
                    if ((payload.new as Message).sender_type !== 'guest') {
                        setIsJuliaTyping(false);
                    }
                    scrollToBottom();
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [guestId]);

    const fetchMessages = async () => {
        const { data } = await supabase
            .from('messages')
            .select('*')
            .eq('hotel_id', dbHotelId)
            .eq('guest_id', guestId)
            .order('created_at', { ascending: true });

        if (data) setMessages(data);
        setLoading(false);
        scrollToBottom();
    };

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
    };

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        const msgText = newMessage.trim();
        setNewMessage("");
        setIsJuliaTyping(true);

        const res = await fetch('/api/chat/message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: msgText,
                guestId,
                dbHotelId,
                hotelId
            })
        });

        if (!res.ok) {
            console.error('Error sending message:', await res.text());
            setIsJuliaTyping(false);
        }
        // The Supabase Realtime subscription will pick up both messages automatically
    };

    const quickActions = ["Room Service", "Limpieza", "Late Check-out"];

    return (
        <div className="flex-1 flex flex-col h-screen max-w-lg mx-auto w-full relative">
            <div className="fixed inset-0 bg-[#0A0A0A] -z-20" />
            <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-hotel-primary/5 rounded-full blur-[100px] -z-10 pointer-events-none" />

            <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-48 hide-scrollbar mt-4">
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
                {isJuliaTyping && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
                        <div className="bg-white/5 backdrop-blur-xl border border-white/10 text-stone-400 rounded-[2rem] rounded-tl-sm px-5 py-4 text-sm flex items-center gap-2">
                            <span className="flex gap-1">
                                <span className="w-1.5 h-1.5 bg-hotel-primary rounded-full animate-bounce [animation-delay:0ms]" />
                                <span className="w-1.5 h-1.5 bg-hotel-primary rounded-full animate-bounce [animation-delay:150ms]" />
                                <span className="w-1.5 h-1.5 bg-hotel-primary rounded-full animate-bounce [animation-delay:300ms]" />
                            </span>
                            <span>Julia está escribiendo...</span>
                        </div>
                    </motion.div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="fixed bottom-[100px] left-0 w-full px-6 z-40">
                <div className="max-w-md mx-auto flex flex-col space-y-3">
                    <div className="flex space-x-2 overflow-x-auto hide-scrollbar pb-1">
                        {quickActions.map((action) => (
                            <button
                                key={action}
                                onClick={() => setNewMessage(action)}
                                className="whitespace-nowrap px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 text-xs font-medium text-white transition-all active:scale-95"
                            >
                                {action}
                            </button>
                        ))}
                    </div>

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
