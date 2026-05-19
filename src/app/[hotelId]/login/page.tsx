"use client";

import { motion } from "framer-motion";
import { use, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DoorOpen, User, Loader2, AlertCircle, Hotel } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase";

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

            // 1. Create an anonymous Supabase session first so we get a valid auth.uid()
            const { data: { user }, error: authError } = await supabase.auth.signInAnonymously();
            if (authError || !user) {
                throw new Error("No se pudo establecer una conexión segura. Inténtalo de nuevo.");
            }

            // 2. Verify the reservation against the backend API
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
                // Sign out the anonymous session so the user can try again cleanly
                await supabase.auth.signOut();
                throw new Error(data.error || "No encontramos una reserva activa con esos datos.");
            }

            // 3. Stamp the hotel slug and force session refresh so middleware
            //    reads the updated metadata from the cookie before redirecting.
            await supabase.auth.updateUser({ data: { hotelSlug: hotelId } });
            await supabase.auth.refreshSession();

            // 4. Redirect to the original destination (or the hotel dashboard)
            router.replace(redirectTo);

        } catch (err: any) {
            setError(err.message);
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-[#0A0A0A]">
            {/* Ambient glow */}
            <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-hotel-primary/8 rounded-full blur-[120px] -z-10 pointer-events-none" />

            <div className="flex-1 flex flex-col items-center justify-center p-6">
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                    className="w-full max-w-sm space-y-8"
                >
                    {/* Logo / Hotel identity */}
                    <div className="text-center space-y-3">
                        <div className="w-16 h-16 rounded-2xl bg-hotel-primary/20 border border-hotel-primary/30 flex items-center justify-center mx-auto">
                            <Hotel className="w-8 h-8 text-hotel-primary" />
                        </div>
                        <div className="space-y-1">
                            <h1 className="font-heading text-2xl font-bold text-white tracking-wide">
                                Bienvenido
                            </h1>
                            <p className="text-stone-400 text-sm">
                                Ingresa los datos de tu reserva para acceder
                            </p>
                        </div>
                    </div>

                    {/* Login Card */}
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-xl space-y-5">

                        {/* Error banner */}
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -8 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-2xl text-sm flex items-start gap-2"
                            >
                                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                <span>{error}</span>
                            </motion.div>
                        )}

                        <form onSubmit={handleLogin} className="space-y-4">
                            {/* Room Number */}
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-hotel-primary uppercase tracking-wider block">
                                    Número de habitación
                                </label>
                                <div className="relative">
                                    <DoorOpen className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-500" />
                                    <input
                                        type="text"
                                        value={roomNumber}
                                        onChange={(e) => setRoomNumber(e.target.value)}
                                        placeholder="Ej: 101"
                                        autoComplete="off"
                                        autoCapitalize="characters"
                                        className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-hotel-primary focus:ring-1 focus:ring-hotel-primary transition-all placeholder:text-stone-600"
                                    />
                                </div>
                            </div>

                            {/* Last Name */}
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-hotel-primary uppercase tracking-wider block">
                                    Apellido
                                </label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-500" />
                                    <input
                                        type="text"
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        placeholder="Tu apellido"
                                        autoComplete="family-name"
                                        autoCapitalize="words"
                                        className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-hotel-primary focus:ring-1 focus:ring-hotel-primary transition-all placeholder:text-stone-600"
                                    />
                                </div>
                            </div>

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-hotel-primary hover:bg-hotel-primary-light text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60 mt-2"
                            >
                                {loading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    "Acceder a mi estadía"
                                )}
                            </button>
                        </form>
                    </div>

                    <p className="text-center text-xs text-stone-600">
                        ¿Problemas para acceder?{" "}
                        <span className="text-stone-400 underline underline-offset-2 cursor-pointer">
                            Contacta a recepción
                        </span>
                    </p>
                </motion.div>
            </div>
        </div>
    );
}
