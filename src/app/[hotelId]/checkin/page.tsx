"use client";

import { motion } from "framer-motion";
import { use, useRef, useState, useEffect } from "react";
import { ArrowRight, CheckCircle2, User, Key, AlertCircle, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function CheckinPage({ params }: { params: Promise<{ hotelId: string }> }) {
    const { hotelId } = use(params);
    const [step, setStep] = useState(1);

    // Step 1 state
    const [reservationId, setReservationId] = useState("");
    const [lastName, setLastName] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [guestName, setGuestName] = useState("");

    // Step 3 state — legal data
    const [nationality, setNationality] = useState("");
    const [documentNumber, setDocumentNumber] = useState("");

    // Signature canvas
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasSigned, setHasSigned] = useState(false);
    const lastPos = useRef<{ x: number; y: number } | null>(null);

    // ─── Signature canvas helpers ───────────────────────────────────────────

    const getPos = (
        e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
    ) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        if ("touches" in e) {
            const touch = e.touches[0];
            return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
        }
        return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
    };

    const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        setIsDrawing(true);
        lastPos.current = getPos(e);
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        if (!isDrawing || !canvasRef.current) return;
        const ctx = canvasRef.current.getContext("2d");
        if (!ctx) return;
        const pos = getPos(e);
        ctx.beginPath();
        ctx.moveTo(lastPos.current!.x, lastPos.current!.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.strokeStyle = "#1a1a1a";
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();
        lastPos.current = pos;
        setHasSigned(true);
    };

    const endDraw = () => {
        setIsDrawing(false);
        lastPos.current = null;
    };

    const clearSignature = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasSigned(false);
    };

    // Keep canvas dimensions in sync with its display size
    useEffect(() => {
        if (step !== 3 || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const { width, height } = canvas.getBoundingClientRect();
        canvas.width = width;
        canvas.height = height;
    }, [step]);

    // ─── Step 1 — verify reservation ────────────────────────────────────────

    const handleVerify = async () => {
        if (!reservationId || !lastName) {
            setError("Por favor, completa ambos campos.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { data: { user }, error: authError } = await supabase.auth.signInAnonymously();

            if (authError || !user) {
                throw new Error("No se pudo establecer una conexión segura.");
            }

            const res = await fetch("/api/checkin/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    reservationId,
                    lastName,
                    hotelId,
                    authUserId: user.id,
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

    // ─── Step 3 — save legal data + signature ───────────────────────────────

    const handleFinishCheckin = async () => {
        if (!nationality || !documentNumber) {
            setError("Por favor, completa tu nacionalidad y número de documento.");
            return;
        }
        if (!hasSigned) {
            setError("Por favor, firma en el recuadro antes de continuar.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // Get signature as base64 PNG
            const signatureBase64 = canvasRef.current?.toDataURL("image/png") ?? null;

            // Identify the current anonymous user
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError || !user) throw new Error("Sesión no encontrada. Recargá la página.");

            // Find the guest row linked to this anonymous session
            const { data: guest, error: guestError } = await supabase
                .from("guests")
                .select("id")
                .eq("auth_user_id", user.id)
                .single();

            if (guestError || !guest) throw new Error("No se encontró el registro del huésped.");

            // Update guest with legal data and signature
            const { error: updateGuestError } = await supabase
                .from("guests")
                .update({
                    nationality,
                    document_number: documentNumber,
                    signature: signatureBase64,
                })
                .eq("id", guest.id);

            if (updateGuestError) {
                // Fallback: try saving into a notes/metadata field if the columns don't exist yet
                const fallbackPayload = {
                    nationality,
                    document_number: documentNumber,
                    signature: signatureBase64,
                };
                const { error: fallbackError } = await supabase
                    .from("guests")
                    .update({ notes: JSON.stringify(fallbackPayload) })
                    .eq("id", guest.id);

                if (fallbackError) {
                    // Last resort: keep in localStorage so data isn't lost
                    localStorage.setItem(
                        `checkin_legal_${guest.id}`,
                        JSON.stringify(fallbackPayload)
                    );
                }
            }

            // Update reservation status to checked_in
            const { error: reservationError } = await supabase
                .from("reservations")
                .update({ status: "checked_in" })
                .eq("id", reservationId);

            if (reservationError) {
                // Non-blocking: log but don't stop the flow — the guest data is already saved
                console.warn("No se pudo actualizar el estado de la reserva:", reservationError.message);
            }

            setStep(4);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // ─── Render ──────────────────────────────────────────────────────────────

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
                                step >= i ? "bg-hotel-primary text-white shadow-[0_0_15px_rgba(var(--hotel-primary),0.5)]" : "bg-white/5 text-stone-500"
                            }`}>
                                {step > i ? <CheckCircle2 className="w-4 h-4" /> : i}
                            </div>
                            {i < 3 && (
                                <div className={`w-12 h-0.5 mx-2 ${step > i ? "bg-hotel-primary" : "bg-white/5"}`} />
                            )}
                        </div>
                    ))}
                </div>

                {/* Form Card */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-xl">

                    {/* ── Step 1: Verify reservation ── */}
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
                                            onKeyDown={(e) => e.key === "Enter" && handleVerify()}
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

                    {/* ── Step 2: Confirmation ── */}
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

                    {/* ── Step 3: Legal data + signature ── */}
                    {step === 3 && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                            <div className="text-center mb-6">
                                <h3 className="text-xl font-bold text-white">Completa tus datos</h3>
                                <p className="text-stone-400 text-sm mt-1">Por requerimientos legales necesitamos esta información.</p>
                            </div>

                            {error && (
                                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm flex items-start space-x-2">
                                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2 block">Nacionalidad</label>
                                        <select
                                            value={nationality}
                                            onChange={(e) => setNationality(e.target.value)}
                                            className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-hotel-primary focus:ring-1 focus:ring-hotel-primary transition-all appearance-none"
                                        >
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
                                            value={documentNumber}
                                            onChange={(e) => setDocumentNumber(e.target.value)}
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

                                {/* ── Signature canvas ── */}
                                <div>
                                    <label className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2 block">Firma Digital</label>
                                    <div className="bg-white rounded-2xl relative overflow-hidden border border-white/10" style={{ height: "128px" }}>
                                        <canvas
                                            ref={canvasRef}
                                            className="absolute inset-0 w-full h-full touch-none cursor-crosshair"
                                            onMouseDown={startDraw}
                                            onMouseMove={draw}
                                            onMouseUp={endDraw}
                                            onMouseLeave={endDraw}
                                            onTouchStart={startDraw}
                                            onTouchMove={draw}
                                            onTouchEnd={endDraw}
                                        />
                                        {!hasSigned && (
                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                <span className="text-stone-400 font-medium select-none opacity-40">Firma aquí</span>
                                            </div>
                                        )}
                                        <button
                                            type="button"
                                            onClick={clearSignature}
                                            className="absolute bottom-2 right-2 z-10 flex items-center space-x-1 text-[10px] uppercase font-bold text-stone-500 hover:text-red-500 bg-stone-100 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                            <span>Limpiar</span>
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-stone-500 mt-2 text-center">Al firmar aceptas los términos y condiciones del hotel.</p>
                                </div>
                            </div>

                            <button
                                onClick={handleFinishCheckin}
                                disabled={loading}
                                className="w-full bg-hotel-primary hover:bg-hotel-primary-light text-white font-bold py-4 rounded-2xl flex items-center justify-center space-x-2 transition-all mt-6 disabled:opacity-50"
                            >
                                {loading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        <span>Finalizar Check-in</span>
                                        <ArrowRight className="w-5 h-5" />
                                    </>
                                )}
                            </button>
                        </motion.div>
                    )}

                    {/* ── Step 4: Success ── */}
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
