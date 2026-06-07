"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { MessageSquare, Sparkles, KeyRound, ChevronRight, X, Loader2, ClipboardCheck, Calendar, LogOut } from "lucide-react";
import Link from "next/link";
import { createBrowserSupabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

function getGreeting() {
    const h = new Date().getHours();
    if (h >= 6 && h < 12) return 'Buenos días';
    if (h >= 12 && h < 20) return 'Buenas tardes';
    return 'Buenas noches';
}

function formatDate(iso: string) {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es', {
        weekday: 'short', day: 'numeric', month: 'long'
    });
}

type Experience = {
    id: string;
    title: string;
    price: number;
    currency: string;
    description: string;
    image_url: string;
};

type Props = {
    hotelId: string;
    dbHotelId: string;
    guestId: string;
    experiences: Experience[];
    guestName: string;
    roomNumber: string;
    checkOut: string | null;
};

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const fadeUp  = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } } };

export default function GuestDashboardClient({ hotelId, dbHotelId, guestId, experiences, guestName, roomNumber, checkOut }: Props) {
    const router = useRouter();
    const [selectedExp, setSelectedExp] = useState<Experience | null>(null);
    const [isPurchasing, setIsPurchasing] = useState(false);
    const [purchaseSuccess, setPurchaseSuccess] = useState(false);

    const firstName = guestName.split(' ')[0] || 'Huésped';

    const handlePurchase = async () => {
        if (!selectedExp || !dbHotelId || !guestId) return;
        setIsPurchasing(true);
        const res = await fetch('/api/experiences/request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ guestId, dbHotelId, experienceId: selectedExp.id, totalPrice: selectedExp.price }),
        });
        setIsPurchasing(false);
        if (res.ok) {
            setPurchaseSuccess(true);
            setTimeout(() => { setSelectedExp(null); setPurchaseSuccess(false); }, 2200);
        } else {
            const data = await res.json();
            alert("Error: " + (data.error || res.statusText));
        }
    };

    const handleLogout = async () => {
        const supabase = createBrowserSupabase();
        await supabase.auth.signOut();
        router.replace(`/${hotelId}/login`);
    };

    return (
        <>
            {/* Background */}
            <div className="fixed inset-0 bg-[#080808] -z-20" />
            <div className="fixed top-[-10%] left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full pointer-events-none -z-10 ambient-pulse"
                style={{ background: 'radial-gradient(circle, var(--hotel-primary) 0%, transparent 65%)', opacity: 0.06 }} />
            <div className="fixed bottom-0 right-0 w-[400px] h-[400px] rounded-full pointer-events-none -z-10"
                style={{ background: 'radial-gradient(circle, var(--hotel-primary) 0%, transparent 70%)', opacity: 0.03 }} />

            <motion.div
                variants={stagger}
                initial="hidden"
                animate="show"
                className="flex-1 px-5 pt-6 pb-32 max-w-lg mx-auto w-full space-y-7"
            >
                {/* ── 1. Greeting ── */}
                <motion.div variants={fadeUp} className="space-y-1 pt-2">
                    <p className="text-[11px] tracking-[0.2em] uppercase" style={{ color: 'var(--hotel-primary)' }}>
                        {getGreeting()}
                    </p>
                    <h2 className="font-heading text-[2rem] font-bold text-white leading-tight">
                        {firstName}
                    </h2>
                    <p className="text-sm" style={{ color: 'rgba(240,235,227,0.4)' }}>
                        ¿En qué podemos asistirte hoy?
                    </p>
                </motion.div>

                {/* ── 2. Stay info cards ── */}
                <motion.div variants={fadeUp} className="grid grid-cols-2 gap-3">
                    {/* Room */}
                    <div className="rounded-3xl p-5 flex flex-col justify-between aspect-square relative overflow-hidden"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <div className="absolute top-0 right-0 w-24 h-24 rounded-full"
                            style={{ background: 'var(--hotel-primary)', opacity: 0.06, transform: 'translate(30%, -30%)' }} />
                        <div className="w-9 h-9 rounded-full flex items-center justify-center"
                            style={{ background: 'rgba(255,255,255,0.07)' }}>
                            <KeyRound className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <p className="text-[10px] font-semibold tracking-[0.15em] uppercase mb-1" style={{ color: 'var(--hotel-primary)' }}>
                                Habitación
                            </p>
                            <p className="font-heading text-3xl font-bold text-white">{roomNumber || '—'}</p>
                        </div>
                    </div>

                    {/* Check-out */}
                    <div className="rounded-3xl p-5 flex flex-col justify-between aspect-square relative overflow-hidden"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <div className="w-9 h-9 rounded-full flex items-center justify-center"
                            style={{ background: 'rgba(255,255,255,0.07)' }}>
                            <Calendar className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <p className="text-[10px] font-semibold tracking-[0.15em] uppercase mb-1" style={{ color: 'rgba(240,235,227,0.35)' }}>
                                Check-out
                            </p>
                            {checkOut ? (
                                <p className="font-heading text-base font-bold text-white leading-snug">
                                    {formatDate(checkOut)}
                                </p>
                            ) : (
                                <p className="font-heading text-2xl font-bold text-white">—</p>
                            )}
                        </div>
                    </div>
                </motion.div>

                {/* ── 3. Chat with Julia (hero action) ── */}
                <motion.div variants={fadeUp}>
                    <button
                        onClick={() => router.push(`/${hotelId}/chat`)}
                        className="w-full text-left relative overflow-hidden rounded-3xl p-6 transition-all active:scale-[0.98] group"
                        style={{
                            background: 'linear-gradient(135deg, rgba(201,150,74,0.15) 0%, rgba(201,150,74,0.05) 100%)',
                            border: '1px solid rgba(201,150,74,0.25)',
                        }}
                    >
                        {/* Decorative bg icon */}
                        <MessageSquare className="absolute bottom-4 right-4 w-20 h-20 opacity-[0.04] group-hover:opacity-[0.07] transition-opacity"
                            style={{ color: 'var(--hotel-primary)' }} />

                        <div className="relative z-10 space-y-2.5">
                            <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4"
                                style={{ background: 'rgba(201,150,74,0.15)', border: '1px solid rgba(201,150,74,0.3)' }}>
                                <Sparkles className="w-5 h-5" style={{ color: 'var(--hotel-primary)' }} />
                            </div>
                            <h3 className="font-heading text-xl font-bold text-white">Hablar con Julia</h3>
                            <p className="text-sm leading-relaxed" style={{ color: 'rgba(240,235,227,0.45)' }}>
                                Tu Concierge Digital. Room service, amenities, recomendaciones — 24/7.
                            </p>
                        </div>
                    </button>
                </motion.div>

                {/* ── 4. Secondary actions ── */}
                <motion.div variants={fadeUp} className="space-y-2.5">
                    {/* Check-in digital */}
                    <Link href={`/${hotelId}/checkin`}
                        className="flex items-center justify-between p-4 rounded-2xl transition-all active:scale-[0.98] group"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                                style={{ background: 'rgba(201,150,74,0.1)', border: '1px solid rgba(201,150,74,0.2)' }}>
                                <ClipboardCheck className="w-4 h-4" style={{ color: 'var(--hotel-primary)' }} />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-white">Check-in Digital</p>
                                <p className="text-xs mt-0.5" style={{ color: 'rgba(240,235,227,0.35)' }}>Evitá la fila en recepción</p>
                            </div>
                        </div>
                        <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5"
                            style={{ color: 'rgba(240,235,227,0.25)' }} />
                    </Link>

                    {/* Logout */}
                    <button
                        onClick={handleLogout}
                        className="flex items-center justify-between w-full p-4 rounded-2xl transition-all active:scale-[0.98] group"
                        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                                style={{ background: 'rgba(255,255,255,0.05)' }}>
                                <LogOut className="w-4 h-4" style={{ color: 'rgba(240,235,227,0.4)' }} />
                            </div>
                            <p className="text-sm font-medium" style={{ color: 'rgba(240,235,227,0.4)' }}>Cerrar sesión</p>
                        </div>
                    </button>
                </motion.div>

                {/* ── 5. Experiences catalog ── */}
                {experiences.length > 0 && (
                    <motion.div variants={fadeUp} className="space-y-4 pt-2">
                        <div className="flex items-end justify-between">
                            <div>
                                <p className="text-[10px] tracking-[0.2em] uppercase mb-1" style={{ color: 'var(--hotel-primary)' }}>
                                    Exclusivo para ti
                                </p>
                                <h3 className="font-heading text-2xl font-light text-white">Experiencias</h3>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {experiences.map((exp) => (
                                <motion.div
                                    key={exp.id}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setSelectedExp(exp)}
                                    className="relative rounded-3xl overflow-hidden cursor-pointer group"
                                    style={{ aspectRatio: '16/9', border: '1px solid rgba(255,255,255,0.07)' }}
                                >
                                    {/* Image */}
                                    <div
                                        className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                                        style={{ backgroundImage: `url(${exp.image_url || 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&q=80'})` }}
                                    />
                                    {/* Overlay */}
                                    <div className="absolute inset-0"
                                        style={{ background: 'linear-gradient(to top, rgba(8,8,8,0.92) 0%, rgba(8,8,8,0.3) 50%, transparent 100%)' }} />

                                    {/* Content */}
                                    <div className="relative z-10 p-5 h-full flex flex-col justify-end">
                                        <div className="flex items-end justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-heading text-xl font-bold text-white leading-tight">{exp.title}</h4>
                                                <p className="text-xs mt-1 line-clamp-2" style={{ color: 'rgba(240,235,227,0.5)' }}>{exp.description}</p>
                                            </div>
                                            <div className="flex-shrink-0 flex flex-col items-end gap-2">
                                                <span className="font-heading font-bold text-lg" style={{ color: 'var(--hotel-primary)' }}>
                                                    ${exp.price}
                                                </span>
                                                <div className="w-9 h-9 rounded-full flex items-center justify-center transition-colors group-hover:bg-opacity-100"
                                                    style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}>
                                                    <ChevronRight className="w-4 h-4 text-white" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </motion.div>

            {/* ── Purchase modal ── */}
            <AnimatePresence>
                {selectedExp && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setSelectedExp(null)}
                            className="fixed inset-0 z-[100]"
                            style={{ background: 'rgba(8,8,8,0.85)', backdropFilter: 'blur(8px)' }}
                        />
                        <motion.div
                            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 28, stiffness: 220 }}
                            className="fixed bottom-0 left-0 w-full z-[101] rounded-t-[2rem] pb-10 shadow-2xl overflow-hidden"
                            style={{ background: '#111', border: '1px solid rgba(255,255,255,0.08)', maxHeight: '85vh' }}
                        >
                            {/* Drag handle */}
                            <div className="flex justify-center pt-3 pb-2">
                                <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
                            </div>

                            <div className="px-5 overflow-y-auto max-h-[calc(85vh-40px)]">
                                <div className="max-w-lg mx-auto">
                                    {/* Close */}
                                    <div className="flex justify-end mb-3">
                                        <button onClick={() => setSelectedExp(null)}
                                            className="w-8 h-8 rounded-full flex items-center justify-center"
                                            style={{ background: 'rgba(255,255,255,0.08)' }}>
                                            <X className="w-4 h-4 text-white" />
                                        </button>
                                    </div>

                                    {/* Image */}
                                    <div className="w-full rounded-2xl overflow-hidden mb-5" style={{ aspectRatio: '16/9' }}>
                                        <img src={selectedExp.image_url} alt={selectedExp.title} className="w-full h-full object-cover" />
                                    </div>

                                    {/* Info */}
                                    <p className="text-[10px] tracking-[0.2em] uppercase mb-1" style={{ color: 'var(--hotel-primary)' }}>
                                        Experiencia exclusiva
                                    </p>
                                    <h3 className="font-heading text-2xl font-bold text-white mb-2">{selectedExp.title}</h3>
                                    <p className="text-sm leading-relaxed mb-6" style={{ color: 'rgba(240,235,227,0.5)' }}>
                                        {selectedExp.description}
                                    </p>

                                    {/* Price + charge row */}
                                    <div className="flex items-center justify-between p-4 rounded-2xl mb-6"
                                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                                        <div>
                                            <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'rgba(240,235,227,0.35)' }}>Total</p>
                                            <p className="font-heading text-2xl font-bold text-white">
                                                ${selectedExp.price}
                                                <span className="text-sm font-normal ml-1" style={{ color: 'rgba(240,235,227,0.4)' }}>
                                                    {selectedExp.currency}
                                                </span>
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-semibold" style={{ color: 'var(--hotel-primary)' }}>Cargo a la</p>
                                            <p className="text-sm font-semibold" style={{ color: 'var(--hotel-primary)' }}>habitación</p>
                                        </div>
                                    </div>

                                    {/* CTA */}
                                    <button
                                        onClick={handlePurchase}
                                        disabled={isPurchasing || purchaseSuccess}
                                        className="w-full py-4 rounded-2xl font-heading font-bold text-base tracking-wide flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-70"
                                        style={{ background: purchaseSuccess ? '#10b981' : 'var(--hotel-primary)', color: '#080808' }}
                                    >
                                        {isPurchasing ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : purchaseSuccess ? (
                                            "¡Solicitud enviada!"
                                        ) : (
                                            "Cargar a mi habitación"
                                        )}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
