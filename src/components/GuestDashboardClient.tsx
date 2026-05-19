"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Wifi, MessageSquare, Coffee, Sparkles, KeyRound, ChevronRight, X, Loader2 } from "lucide-react";
import { useState, useMemo } from "react";
import { createBrowserSupabase } from "@/lib/supabase";

type Experience = {
    id: string;
    title: string;
    price: number;
    currency: string;
    description: string;
    image_url: string;
};

type GuestDashboardClientProps = {
    hotelId: string;
    dbHotelId: string;
    guestId: string;
    experiences: Experience[];
    guestName: string;
    roomNumber: string;
    checkOut: string | null;
};

export default function GuestDashboardClient({ hotelId, dbHotelId, guestId, experiences, guestName, roomNumber, checkOut }: GuestDashboardClientProps) {
    const supabase = useMemo(() => createBrowserSupabase(), []);
    const [selectedExp, setSelectedExp] = useState<Experience | null>(null);
    const [isPurchasing, setIsPurchasing] = useState(false);
    const [purchaseSuccess, setPurchaseSuccess] = useState(false);

    const containerVariants = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.1 } }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 }
    };

    const handlePurchase = async () => {
        if (!selectedExp || !dbHotelId || !guestId) return;
        setIsPurchasing(true);

        const { error } = await supabase.from('requests').insert({
            hotel_id: dbHotelId,
            guest_id: guestId,
            experience_id: selectedExp.id,
            total_price: selectedExp.price,
            status: 'pending'
        });

        setIsPurchasing(false);
        if (!error) {
            setPurchaseSuccess(true);
            setTimeout(() => {
                setSelectedExp(null);
                setPurchaseSuccess(false);
            }, 2000);
        } else {
            alert("Error al procesar la solicitud: " + error.message);
        }
    };

    return (
        <>
            {/* Background Base */}
            <div className="fixed inset-0 bg-[#0A0A0A] -z-20" />
            
            {/* Ambient Hotel Primary Glow */}
            <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-hotel-primary/10 rounded-full blur-[120px] -z-10 pointer-events-none" />

            <motion.div 
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="flex-1 p-6 pb-32 max-w-lg mx-auto w-full space-y-8"
            >
                {/* 1. Header Hero Personalizado */}
                <motion.div variants={itemVariants} className="space-y-2 mt-6">
                    <div className="flex justify-between items-center">
                        <h2 className="font-heading text-3xl font-light text-white">
                            Buenas noches, <span className="font-bold text-hotel-primary">{guestName.split(' ')[0] || 'Huésped'}</span>
                        </h2>
                        <div className="flex items-center space-x-2 bg-white/5 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                            <span className="text-white/80 text-sm font-medium">24°C</span>
                        </div>
                    </div>
                    <p className="text-stone-400 text-sm tracking-wide">¿En qué podemos asistirte hoy?</p>
                </motion.div>

                {/* 2. Las 3 Acciones Principales (Glassmorphism) */}
                <motion.div variants={itemVariants} className="space-y-4">
                    {/* Acción 1: Chat con Julia (Destacada) */}
                    <button 
                        onClick={() => window.location.href = `/${hotelId}/chat`}
                        className="w-full relative overflow-hidden rounded-[2rem] bg-white/5 backdrop-blur-xl border border-white/10 p-6 text-left group transition-all active:scale-[0.98] hover:bg-white/10"
                    >
                        <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:opacity-40 transition-opacity">
                            <MessageSquare className="w-16 h-16 text-hotel-primary" />
                        </div>
                        <div className="relative z-10 space-y-2">
                            <div className="w-12 h-12 rounded-full bg-hotel-primary/20 flex items-center justify-center mb-4">
                                <Sparkles className="w-6 h-6 text-hotel-primary" />
                            </div>
                            <h3 className="font-heading text-xl font-bold text-white">Hablar con Julia</h3>
                            <p className="text-stone-400 text-sm w-3/4">Tu Concierge Digital. Pide servicio al cuarto, toallas o recomendaciones.</p>
                        </div>
                    </button>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Acción 2: Llave Digital */}
                        <button className="relative overflow-hidden rounded-[2rem] bg-white/5 backdrop-blur-xl border border-white/10 p-5 text-left group transition-all active:scale-[0.98] hover:bg-white/10 flex flex-col justify-between aspect-square">
                            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                                <KeyRound className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <p className="text-hotel-primary text-xs font-bold uppercase tracking-wider mb-1">{roomNumber ? `Hab. ${roomNumber}` : 'Mi Hab.'}</p>
                                <h3 className="font-heading text-lg font-bold text-white">Llave Digital</h3>
                            </div>
                        </button>

                        {/* Acción 3: Wi-Fi / Info */}
                        <button className="relative overflow-hidden rounded-[2rem] bg-white/5 backdrop-blur-xl border border-white/10 p-5 text-left group transition-all active:scale-[0.98] hover:bg-white/10 flex flex-col justify-between aspect-square">
                            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                                <Wifi className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <p className="text-stone-400 text-xs font-medium uppercase tracking-wider mb-1">
                                    {checkOut ? `Check-out: ${new Date(checkOut + 'T12:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short' })}` : 'Conectado'}
                                </p>
                                <h3 className="font-heading text-lg font-bold text-white">Red Wi-Fi</h3>
                            </div>
                        </button>
                    </div>
                </motion.div>

                {/* 3. Catálogo de Servicios (Upselling Luxury) */}
                <motion.div variants={itemVariants} className="space-y-5 pt-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-heading text-2xl font-light text-white">Para ti</h3>
                    </div>
                    
                    {experiences.length === 0 ? (
                        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 text-center">
                            <p className="text-stone-400 text-sm">No hay servicios disponibles en este momento.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col space-y-6">
                            {experiences.map((exp) => (
                                <div 
                                    key={exp.id} 
                                    onClick={() => setSelectedExp(exp)}
                                    className="relative rounded-[2rem] overflow-hidden group cursor-pointer border border-white/10 aspect-[4/3] w-full"
                                >
                                    <div 
                                        className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                                        style={{ backgroundImage: `url(${exp.image_url})` }}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                                    <div className="relative z-10 p-6 h-full flex flex-col justify-end">
                                        <div className="flex justify-between items-end">
                                            <div className="space-y-1">
                                                <h4 className="font-heading text-2xl font-bold text-white leading-tight">{exp.title}</h4>
                                                <p className="text-sm text-stone-300 line-clamp-2 pr-4">{exp.description}</p>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className="text-xl font-bold text-hotel-primary mb-2">
                                                    ${exp.price} <span className="text-sm font-normal text-stone-400">{exp.currency}</span>
                                                </span>
                                                <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white group-hover:bg-hotel-primary transition-colors">
                                                    <ChevronRight className="w-5 h-5" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </motion.div>
            </motion.div>

            {/* Modal de Compra (Drawer) */}
            <AnimatePresence>
                {selectedExp && (
                    <>
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedExp(null)}
                            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]"
                        />
                        <motion.div 
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="fixed bottom-0 left-0 w-full bg-zinc-950 border-t border-white/10 rounded-t-[2rem] z-[100] p-6 pb-12 shadow-2xl max-h-[80vh] overflow-y-auto"
                        >
                            <div className="max-w-lg mx-auto relative">
                                <button onClick={() => setSelectedExp(null)} className="absolute -top-2 right-0 p-2 bg-white/10 rounded-full text-white">
                                    <X className="w-5 h-5" />
                                </button>

                                <div className="w-full h-48 rounded-2xl overflow-hidden mb-6 mt-4">
                                    <img src={selectedExp.image_url} alt={selectedExp.title} className="w-full h-full object-cover" />
                                </div>

                                <h3 className="font-heading text-2xl font-bold text-white mb-2">{selectedExp.title}</h3>
                                <p className="text-stone-400 mb-6">{selectedExp.description}</p>

                                <div className="flex items-center justify-between bg-white/5 border border-white/10 p-4 rounded-2xl mb-8">
                                    <div>
                                        <p className="text-xs text-stone-500 uppercase tracking-wider">Precio Total</p>
                                        <p className="text-2xl font-bold text-white">${selectedExp.price} <span className="text-sm font-normal text-stone-500">{selectedExp.currency}</span></p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm text-hotel-primary font-bold">Cargo a la</p>
                                        <p className="text-sm text-hotel-primary font-bold">habitación</p>
                                    </div>
                                </div>

                                <button 
                                    onClick={handlePurchase}
                                    disabled={isPurchasing || purchaseSuccess}
                                    className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center transition-all ${
                                        purchaseSuccess 
                                        ? 'bg-emerald-500 text-white' 
                                        : 'bg-hotel-primary text-white hover:opacity-90 active:scale-95'
                                    }`}
                                >
                                    {isPurchasing ? (
                                        <Loader2 className="w-6 h-6 animate-spin" />
                                    ) : purchaseSuccess ? (
                                        "¡Solicitud Enviada!"
                                    ) : (
                                        "Cargar a mi habitación"
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
