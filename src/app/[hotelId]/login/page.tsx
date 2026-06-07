"use client";

import { motion } from "framer-motion";
import { use, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DoorOpen, User, Loader2, AlertCircle } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase";

const HOTEL_BG = "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1080&q=80";

export default function GuestLoginPage({ params }: { params: Promise<{ hotelId: string }> }) {
    const { hotelId } = use(params);
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectTo = searchParams.get("redirectTo") ?? `/${hotelId}`;

    const [roomNumber, setRoomNumber] = useState("");
    const [lastName, setLastName] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!roomNumber.trim() || !lastName.trim()) {
            setError("Por favor, completa tu número de habitación y apellido.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const supabase = createBrowserSupabase();
            const { data: { user }, error: authError } = await supabase.auth.signInAnonymously();
            if (authError || !user) throw new Error("No se pudo establecer una conexión segura.");

            const res = await fetch("/api/checkin/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    roomNumber: roomNumber.trim(),
                    lastName: lastName.trim(),
                    hotelId,
                    authUserId: user.id,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                await supabase.auth.signOut();
                throw new Error(data.error || "No encontramos una reserva activa con esos datos.");
            }

            await supabase.auth.updateUser({ data: { hotelSlug: hotelId } });
            await supabase.auth.refreshSession();
            router.replace(redirectTo);

        } catch (err: any) {
            setError(err.message);
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col relative overflow-hidden bg-[#080808]">

            {/* ── Hero background ── */}
            <div className="absolute inset-0 z-0">
                <img
                    src={HOTEL_BG}
                    alt="Hotel"
                    className="w-full h-full object-cover object-center"
                    style={{ filter: 'brightness(0.35) saturate(0.8)' }}
                />
                {/* Gradient overlay: transparent top → solid black bottom */}
                <div className="absolute inset-0"
                    style={{ background: 'linear-gradient(to bottom, rgba(8,8,8,0.2) 0%, rgba(8,8,8,0.5) 40%, rgba(8,8,8,0.92) 70%, #080808 100%)' }} />
            </div>

            {/* ── Ambient glow ── */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full pointer-events-none z-[1] ambient-pulse"
                style={{ background: 'radial-gradient(circle, var(--hotel-primary) 0%, transparent 70%)', opacity: 0.07 }} />

            {/* ── Content ── */}
            <div className="relative z-10 flex flex-col min-h-screen">

                {/* Top branding — visible in hero area */}
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="flex flex-col items-center pt-16 pb-8 px-6"
                >
                    {/* Monogram */}
                    <div className="w-16 h-16 rounded-2xl mb-5 flex items-center justify-center"
                        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(20px)' }}>
                        <span className="font-heading font-black text-3xl" style={{ color: 'var(--hotel-primary)' }}>S</span>
                    </div>

                    <p className="text-[11px] tracking-[0.3em] uppercase mb-2" style={{ color: 'var(--hotel-primary)' }}>
                        Luxury Collection
                    </p>
                    <h1 className="font-heading text-3xl font-bold text-white text-center leading-tight">
                        Serstormia<br />Hotel & Suites
                    </h1>
                    <div className="flex items-center gap-1 mt-2">
                        {[...Array(5)].map((_, i) => (
                            <svg key={i} className="w-3 h-3" viewBox="0 0 24 24" style={{ fill: 'var(--hotel-primary)' }}>
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                            </svg>
                        ))}
                    </div>
                </motion.div>

                {/* Spacer — pushes form to bottom */}
                <div className="flex-1" />

                {/* ── Login form card ── */}
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.15, ease: "easeOut" }}
                    className="px-5 pb-10"
                >
                    <div className="max-w-sm mx-auto">
                        {/* Tagline */}
                        <div className="text-center mb-6">
                            <h2 className="font-heading text-xl font-semibold text-white">Accedé a tu estadía</h2>
                            <p className="text-sm mt-1" style={{ color: 'rgba(240,235,227,0.45)' }}>
                                Ingresá los datos de tu reserva
                            </p>
                        </div>

                        {/* Card */}
                        <div className="rounded-3xl p-6 space-y-5"
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)' }}>

                            {/* Error */}
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, y: -6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex items-start gap-2.5 p-3 rounded-2xl text-sm"
                                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#FCA5A5' }}
                                >
                                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                    <span>{error}</span>
                                </motion.div>
                            )}

                            <form onSubmit={handleLogin} className="space-y-4">
                                {/* Room */}
                                <div className="space-y-2">
                                    <label className="text-[11px] font-semibold tracking-[0.15em] uppercase block"
                                        style={{ color: 'var(--hotel-primary)' }}>
                                        Número de habitación
                                    </label>
                                    <div className="relative">
                                        <DoorOpen className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4"
                                            style={{ color: 'rgba(240,235,227,0.3)' }} />
                                        <input
                                            type="text"
                                            value={roomNumber}
                                            onChange={(e) => setRoomNumber(e.target.value)}
                                            placeholder="Ej: 101"
                                            autoComplete="off"
                                            className="w-full py-4 pl-11 pr-4 rounded-2xl text-white text-sm outline-none transition-all placeholder:opacity-30"
                                            style={{
                                                background: 'rgba(255,255,255,0.05)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                            }}
                                            onFocus={e => e.target.style.borderColor = 'var(--hotel-primary)'}
                                            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                                        />
                                    </div>
                                </div>

                                {/* Last name */}
                                <div className="space-y-2">
                                    <label className="text-[11px] font-semibold tracking-[0.15em] uppercase block"
                                        style={{ color: 'var(--hotel-primary)' }}>
                                        Apellido
                                    </label>
                                    <div className="relative">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4"
                                            style={{ color: 'rgba(240,235,227,0.3)' }} />
                                        <input
                                            type="text"
                                            value={lastName}
                                            onChange={(e) => setLastName(e.target.value)}
                                            placeholder="Tu apellido"
                                            autoComplete="family-name"
                                            className="w-full py-4 pl-11 pr-4 rounded-2xl text-white text-sm outline-none transition-all placeholder:opacity-30"
                                            style={{
                                                background: 'rgba(255,255,255,0.05)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                            }}
                                            onFocus={e => e.target.style.borderColor = 'var(--hotel-primary)'}
                                            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                                        />
                                    </div>
                                </div>

                                {/* Divider */}
                                <div className="h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />

                                {/* Submit */}
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-4 rounded-2xl font-heading font-bold text-[15px] tracking-wide transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
                                    style={{ background: 'var(--hotel-primary)', color: '#080808' }}
                                >
                                    {loading ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        "Acceder a mi estadía"
                                    )}
                                </button>
                            </form>
                        </div>

                        <p className="text-center text-xs mt-5" style={{ color: 'rgba(240,235,227,0.25)' }}>
                            ¿Problemas para acceder?{" "}
                            <span className="underline underline-offset-2 cursor-pointer" style={{ color: 'rgba(240,235,227,0.45)' }}>
                                Contactá a recepción
                            </span>
                        </p>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
