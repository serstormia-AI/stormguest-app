"use client";

import { motion } from "framer-motion";
import { use, useState } from "react";
import { ArrowRight, CheckCircle2, User, Key, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function CheckinPage({ params }: { params: Promise<{ hotelId: string }> }) {
    // In client components, use React.use() to unwrap the params promise
    const { hotelId } = use(params);
    const [step, setStep] = useState(1);
    
    // Form State
    const [reservationId, setReservationId] = useState("");
    const [lastName, setLastName] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [guestName, setGuestName] = useState("");

    const handleVerify = async () => {
        if (!reservationId || !lastName) {
            setError("Por favor, completa ambos campos.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // 1. Iniciar sesión anónima en Supabase (Genera el auth.uid() seguro)
            const { data: { user }, error: authError } = await supabase.auth.signInAnonymously();
            
            if (authError || !user) {
                throw new Error("No se pudo establecer una conexión segura.");
            }

            // 2. Verificar reserva y enlazar el auth_user_id con el huésped
            const res = await fetch("/api/checkin/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    reservationId, 
                    lastName, 
                    hotelId,
                    authUserId: user.id // Enviamos el ID para enlazarlo en el backend
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Error al verificar la reserva");
            }

            setGuestName(data.reservation.guestName);
            setStep(2);

        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <div className="flex-1 flex flex-col p-6 items-center justify-center max-w-md mx-auto w-full">
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full space-y-8"
            >
                {/* Header */}
                <div className="text-center space-y-2">
                    <h2 className="font-heading text-3xl font-bold text-white">Check-in Digital</h2>
                    <p className="text-stone-400 text-sm">Completa tu registro antes de llegar para evitar filas en la recepción.</p>
                </div>

                {/* Steps visualizer */}
                <div className="flex items-center justify-center space-x-4 mb-8">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                                step >= i ? 'bg-hotel-primary text-white shadow-[0_0_15px_rgba(var(--hotel-primary),0.5)]' : 'bg-white/5 text-stone-500'
                            }`}>
                                {step > i ? <CheckCircle2 className="w-4 h-4" /> : i}
                            </div>
                            {i < 3 && (
                                <div className={`w-12 h-0.5 mx-2 ${step > i ? 'bg-hotel-primary' : 'bg-white/5'}`} />
                            )}
                        </div>
                    ))}
                </div>

                {/* Form Card */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-xl">
                    {step === 1 && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                            {error && (
                                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm flex items-start space-x-2">
                                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-semibold text-hotel-primary uppercase tracking-wider mb-2 block">ID de Reserva</label>
                                    <div className="relative">
                                        <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-500" />
                                        <input 
                                            type="text" 
                                            value={reservationId}
                                            onChange={(e) => setReservationId(e.target.value)}
                                            placeholder="Ej: RES-12345" 
                                            className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-hotel-primary focus:ring-1 focus:ring-hotel-primary transition-all placeholder:text-stone-600"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-hotel-primary uppercase tracking-wider mb-2 block">Apellido</label>
                                    <div className="relative">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-500" />
                                        <input 
                                            type="text" 
                                            value={lastName}
                                            onChange={(e) => setLastName(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                                            placeholder="Tu apellido" 
                                            className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-hotel-primary focus:ring-1 focus:ring-hotel-primary transition-all placeholder:text-stone-600"
                                        />
                                    </div>
                                </div>
                            </div>
                            
                            <button 
                                onClick={handleVerify}
                                disabled={loading}
                                className="w-full bg-hotel-primary hover:bg-hotel-primary-light text-white font-bold py-4 rounded-2xl flex items-center justify-center space-x-2 transition-all group disabled:opacity-50"
                            >
                                {loading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        <span>Buscar Reserva</span>
                                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </button>
                        </motion.div>
                    )}

                    {step === 2 && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 text-center py-8">
                            <div className="w-16 h-16 bg-hotel-primary/20 rounded-full flex items-center justify-center mx-auto mb-4 text-hotel-primary">
                                <CheckCircle2 className="w-8 h-8" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">¡Hola, {guestName}!</h3>
                                <p className="text-stone-400 mt-2">Tu reserva ha sido confirmada con éxito.</p>
                            </div>
                            <button 
                                onClick={() => setStep(3)}
                                className="w-full bg-hotel-primary hover:bg-hotel-primary-light text-white font-bold py-4 rounded-2xl flex items-center justify-center space-x-2 mt-4"
                            >
                                Continuar Check-in
                            </button>
                        </motion.div>
                    )}
                    
                    {step === 3 && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                            <div className="text-center mb-6">
                                <h3 className="text-xl font-bold text-white">Completa tus datos</h3>
                                <p className="text-stone-400 text-sm mt-1">Por requerimientos legales necesitamos esta información.</p>
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2 block">Nacionalidad</label>
                                        <select className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-hotel-primary focus:ring-1 focus:ring-hotel-primary transition-all appearance-none">
                                            <option value="">Selecciona...</option>
                                            <option value="AR">Argentina</option>
                                            <option value="BR">Brasil</option>
                                            <option value="CL">Chile</option>
                                            <option value="US">Estados Unidos</option>
                                            <option value="ES">España</option>
                                            <option value="OT">Otra</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2 block">Pasaporte / DNI</label>
                                        <input 
                                            type="text" 
                                            placeholder="Nº de documento" 
                                            className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-hotel-primary focus:ring-1 focus:ring-hotel-primary transition-all placeholder:text-stone-600"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2 block">Foto del Documento</label>
                                    <div className="border-2 border-dashed border-white/20 rounded-2xl p-6 text-center hover:border-hotel-primary/50 transition-colors cursor-pointer bg-black/20 group">
                                        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3 group-hover:bg-hotel-primary/20 group-hover:text-hotel-primary transition-colors">
                                            <svg className="w-6 h-6 text-stone-400 group-hover:text-hotel-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                        </div>
                                        <p className="text-sm text-stone-300 font-medium">Toca para abrir la cámara</p>
                                        <p className="text-xs text-stone-500 mt-1">Frente del documento</p>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2 block">Firma Digital</label>
                                    <div className="bg-white rounded-2xl h-32 w-full relative overflow-hidden border border-white/10">
                                        {/* Placeholder for Signature Canvas */}
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30">
                                            <span className="text-stone-400 font-medium select-none">Firma aquí</span>
                                        </div>
                                        <div className="absolute bottom-2 right-2">
                                            <button className="text-[10px] uppercase font-bold text-stone-400 hover:text-stone-600 bg-stone-100 px-2 py-1 rounded">Limpiar</button>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-stone-500 mt-2 text-center">Al firmar aceptas los términos y condiciones del hotel.</p>
                                </div>
                            </div>

                            <button 
                                onClick={() => setStep(4)}
                                className="w-full bg-hotel-primary hover:bg-hotel-primary-light text-white font-bold py-4 rounded-2xl flex items-center justify-center space-x-2 transition-all mt-6"
                            >
                                Finalizar Check-in
                            </button>
                        </motion.div>
                    )}

                    {step === 4 && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-10 space-y-6">
                            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto text-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                                <CheckCircle2 className="w-10 h-10" />
                            </div>
                            <div>
                                <h3 className="font-heading text-2xl font-bold text-white mb-2">¡Todo listo!</h3>
                                <p className="text-stone-400">Tu check-in se ha completado con éxito. Pasa por recepción solo a retirar tu llave física.</p>
                            </div>
                            <div className="pt-4">
                                <button className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-4 rounded-xl transition-all">
                                    Ver llave digital (Upsell)
                                </button>
                            </div>
                        </motion.div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
