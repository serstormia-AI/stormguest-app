"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useRef } from "react";
import { Send, Sparkles } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase";

type Message = {
    id: string;
    sender: "guest" | "staff" | "bot";
    content: string;
    created_at: string;
};

type Props = {
    hotelId: string;
    guestId: string;
    dbHotelId: string;
    conciergeName: string;
    initialConvId: string | null;
};

const supabase = createBrowserSupabase();

const QUICK_ACTIONS = ["🛎 Room Service", "🧹 Limpieza", "🕐 Late Check-out", "🗺 Recomendaciones"];

export default function ChatClient({ hotelId, guestId, dbHotelId, conciergeName, initialConvId }: Props) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const [isTyping, setIsTyping] = useState(false);
    const [convId, setConvId] = useState<string | null>(initialConvId);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { fetchMessages(); }, []);

    // Realtime — scoped to conversation_id once we have it
    useEffect(() => {
        if (!convId) return;

        const channel = supabase
            .channel(`chat-conv-${convId}`)
            .on('postgres_changes', {
                event: 'INSERT', schema: 'public', table: 'messages',
                filter: `conversation_id=eq.${convId}`
            }, (payload) => {
                const msg = payload.new as Message;
                setMessages(prev => {
                    if (prev.some(m => m.id === msg.id)) return prev;
                    return [...prev, msg];
                });
                if (msg.sender !== 'guest') setIsTyping(false);
                scrollToBottom();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [convId]);

    const fetchMessages = async () => {
        // Use convId from state (pre-fetched server-side or set after first message)
        let currentConvId = convId;

        if (!currentConvId) {
            // First message case: conversation was just created, find it
            const { data: conv } = await supabase
                .from('conversations')
                .select('id')
                .eq('guest_id', guestId)
                .eq('hotel_id', dbHotelId)
                .maybeSingle();

            if (!conv) {
                setLoading(false);
                return;
            }
            currentConvId = conv.id;
            setConvId(conv.id);
        }

        const { data } = await supabase
            .from('messages')
            .select('id, sender, content, created_at')
            .eq('conversation_id', currentConvId)
            .order('created_at', { ascending: true });

        if (data) setMessages(data as Message[]);
        setLoading(false);
        scrollToBottom();
    };

    const scrollToBottom = () => setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 80);

    const sendMessage = async (text?: string) => {
        const content = (text ?? newMessage).trim();
        if (!content) return;
        setNewMessage("");
        setIsTyping(true);

        const res = await fetch('/api/chat/message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, guestId, dbHotelId, hotelId })
        });

        if (!res.ok) {
            setIsTyping(false);
            return;
        }

        // Always refetch — ensures bot response shows even if Realtime missed the event
        await fetchMessages();
        setIsTyping(false);
    };

    return (
        <div className="flex flex-col h-screen relative">
            {/* Background */}
            <div className="fixed inset-0 bg-[#080808] -z-20" />
            <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[500px] h-[400px] rounded-full pointer-events-none -z-10"
                style={{ background: 'radial-gradient(circle, var(--hotel-primary) 0%, transparent 70%)', opacity: 0.04 }} />

            {/* ── Julia header ── */}
            <div className="flex items-center gap-3 px-5 py-4 border-b"
                style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(8,8,8,0.6)', backdropFilter: 'blur(20px)' }}>
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 relative"
                    style={{ background: 'linear-gradient(135deg, rgba(201,150,74,0.2) 0%, rgba(201,150,74,0.08) 100%)', border: '1px solid rgba(201,150,74,0.3)' }}>
                    <Sparkles className="w-5 h-5" style={{ color: 'var(--hotel-primary)' }} />
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#080808]"
                        style={{ background: '#10b981' }} />
                </div>
                <div>
                    <p className="font-heading font-bold text-white text-sm leading-none">{conciergeName}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'rgba(240,235,227,0.4)' }}>
                        Concierge Digital · Disponible 24/7
                    </p>
                </div>
            </div>

            {/* ── Messages area ── */}
            <div className="flex-1 overflow-y-auto px-4 py-5 space-y-3 hide-scrollbar pb-48">

                {/* Welcome message */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="flex items-end gap-2 justify-start"
                >
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 mb-0.5"
                        style={{ background: 'rgba(201,150,74,0.15)', border: '1px solid rgba(201,150,74,0.25)' }}>
                        <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--hotel-primary)' }} />
                    </div>
                    <div className="max-w-[80%] px-4 py-3 rounded-3xl rounded-tl-lg text-sm leading-relaxed"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(240,235,227,0.85)' }}>
                        ¡Hola! Soy <span style={{ color: 'var(--hotel-primary)', fontWeight: 600 }}>{conciergeName}</span>, tu Concierge Digital. ¿En qué puedo asistirte durante tu estadía?
                    </div>
                </motion.div>

                {loading ? (
                    <div className="flex justify-center py-8">
                        <div className="flex gap-1">
                            {[0, 1, 2].map(i => (
                                <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce"
                                    style={{ background: 'var(--hotel-primary)', animationDelay: `${i * 150}ms` }} />
                            ))}
                        </div>
                    </div>
                ) : (
                    <AnimatePresence initial={false}>
                        {messages.map((msg) => {
                            const isGuest = msg.sender === 'guest';
                            const isBot = msg.sender === 'bot';
                            return (
                                <motion.div
                                    key={msg.id}
                                    initial={{ opacity: 0, y: 8, scale: 0.97 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    transition={{ duration: 0.25 }}
                                    className={`flex items-end gap-2 ${isGuest ? 'justify-end' : 'justify-start'}`}
                                >
                                    {isBot && (
                                        <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 mb-0.5"
                                            style={{ background: 'rgba(201,150,74,0.15)', border: '1px solid rgba(201,150,74,0.25)' }}>
                                            <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--hotel-primary)' }} />
                                        </div>
                                    )}
                                    <div className={`max-w-[80%] px-4 py-3 text-sm leading-relaxed ${
                                        isGuest
                                        ? 'rounded-3xl rounded-tr-lg text-[#080808] font-medium'
                                        : 'rounded-3xl rounded-tl-lg'
                                    }`}
                                        style={isGuest ? {
                                            background: 'var(--hotel-primary)',
                                        } : {
                                            background: 'rgba(255,255,255,0.06)',
                                            border: '1px solid rgba(255,255,255,0.08)',
                                            color: 'rgba(240,235,227,0.85)',
                                        }}>
                                        {msg.content}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                )}

                {/* Typing indicator */}
                <AnimatePresence>
                    {isTyping && (
                        <motion.div
                            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                            className="flex items-end gap-2 justify-start"
                        >
                            <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
                                style={{ background: 'rgba(201,150,74,0.15)', border: '1px solid rgba(201,150,74,0.25)' }}>
                                <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--hotel-primary)' }} />
                            </div>
                            <div className="px-4 py-3.5 rounded-3xl rounded-tl-lg flex gap-1.5 items-center"
                                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                                {[0, 1, 2].map(i => (
                                    <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce"
                                        style={{ background: 'var(--hotel-primary)', opacity: 0.7, animationDelay: `${i * 150}ms` }} />
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div ref={messagesEndRef} />
            </div>

            {/* ── Input area ── */}
            <div className="fixed bottom-[88px] left-0 w-full px-4 z-40 space-y-2.5">
                {/* Quick actions */}
                <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-0.5">
                    {QUICK_ACTIONS.map(action => (
                        <button key={action} onClick={() => sendMessage(action)}
                            className="whitespace-nowrap px-3.5 py-2 rounded-full text-xs font-medium transition-all active:scale-95 flex-shrink-0"
                            style={{
                                background: 'rgba(255,255,255,0.07)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                color: 'rgba(240,235,227,0.7)',
                                backdropFilter: 'blur(12px)',
                            }}>
                            {action}
                        </button>
                    ))}
                </div>

                {/* Input */}
                <div className="flex items-center gap-2 p-1.5 rounded-3xl"
                    style={{
                        background: 'rgba(18,18,18,0.9)',
                        border: '1px solid rgba(255,255,255,0.09)',
                        backdropFilter: 'blur(28px)',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                    }}>
                    <input
                        ref={inputRef}
                        type="text"
                        value={newMessage}
                        onChange={e => setNewMessage(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && sendMessage()}
                        placeholder="Escribe un mensaje..."
                        className="flex-1 bg-transparent border-none text-white px-4 py-3 focus:outline-none text-sm placeholder:opacity-30"
                    />
                    <button
                        onClick={() => sendMessage()}
                        disabled={!newMessage.trim() || isTyping}
                        className="w-11 h-11 rounded-2xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-40 flex-shrink-0"
                        style={{ background: 'var(--hotel-primary)' }}
                    >
                        <Send className="w-4 h-4 text-[#080808] ml-0.5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
