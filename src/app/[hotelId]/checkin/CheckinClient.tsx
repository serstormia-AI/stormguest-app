"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, AlertCircle, Loader2, Trash2 } from "lucide-react";

type Props = {
    hotelId: string;
    guestId: string;
    guestName: string;
    reservationId: string | null;
    roomNumber: string | null;
    alreadyCheckedIn: boolean;
};

export default function CheckinClient({ hotelId, guestId, guestName, reservationId, roomNumber, alreadyCheckedIn }: Props) {
    const router = useRouter();
    const [step, setStep] = useState(alreadyCheckedIn ? 3 : 1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [nationality, setNationality] = useState("");
    const [documentNumber, setDocumentNumber] = useState("");

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasSigned, setHasSigned] = useState(false);
    const lastPos = useRef<{ x: number; y: number } | null>(null);

    const firstName = guestName.split(' ')[0] || 'Huésped';

    useEffect(() => {
        if (step !== 2 || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const { width, height } = canvas.getBoundingClientRect();
        canvas.width = width;
        canvas.height = height;
    }, [step]);

    const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        if ("touches" in e) return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
        return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
    };

    const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        e.preventDefault(); setIsDrawing(true); lastPos.current = getPos(e);
    };
    const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        if (!isDrawing || !canvasRef.current) return;
        const ctx = canvasRef.current.getContext("2d");
        if (!ctx) return;
        const pos = getPos(e);
        ctx.beginPath(); ctx.moveTo(lastPos.current!.x, lastPos.current!.y);
        ctx.lineTo(pos.x, pos.y); ctx.strokeStyle = "#1a1a1a";
        ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke();
        lastPos.current = pos; setHasSigned(true);
    };
    const endDraw = () => { setIsDrawing(false); lastPos.current = null; };
    const clearCanvas = () => {
        canvasRef.current?.getContext("2d")?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        setHasSigned(false);
    };

    const handleFinish = async () => {
        if (!nationality || !documentNumber) { setError("Completá tu nacionalidad y documento."); return; }
        if (!hasSigned) { setError("Firma en el recuadro antes de continuar."); return; }
        setLoading(true); setError(null);
        const signatureBase64 = canvasRef.current?.toDataURL("image/png") ?? null;
        const res = await fetch("/api/checkin/complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ guestId, reservationId, nationality, documentNumber, signature: signatureBase64 }),
        });
        setLoading(false);
        if (res.ok) setStep(3);
        else { const d = await res.json(); setError(d.error || "Error al guardar. Intentá de nuevo."); }
    };

    return (
        <div className="flex-1 flex flex-col relative min-h-screen">
            {/* Background */}
            <div className="fixed inset-0 bg-[#080808] -z-20" />
            <div className="fixed top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none -z-10"
                style={{ background: 'radial-gradient(circle, var(--hotel-primary) 0%, transparent 70%)', opacity: 0.04 }} />

            <div className="flex-1 flex flex-col px-5 pt-6 pb-10 max-w-md mx-auto w-full">

                {/* Header */}
                <div className="mb-8">
                    <p className="text-[11px] tracking-[0.2em] uppercase mb-1" style={{ color: 'var(--hotel-primary)' }}>
                        Registro digital
                    </p>
                    <h2 className="font-heading text-[2rem] font-bold text-white leading-tight">Check-in</h2>
                </div>

                {/* Step indicator */}
                {step < 3 && (
                    <div className="flex items-center gap-2 mb-8">
                        {[1, 2].map((i) => (
                            <div key={i} className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                                    style={{
                                        background: step >= i ? 'var(--hotel-primary)' : 'rgba(255,255,255,0.07)',
                                        color: step >= i ? '#080808' : 'rgba(240,235,227,0.3)',
                                        border: step >= i ? 'none' : '1px solid rgba(255,255,255,0.1)',
                                    }}>
                                    {step > i ? <CheckCircle2 className="w-3.5 h-3.5" /> : i}
                                </div>
                                {i < 2 && (
                                    <div className="w-12 h-px" style={{ background: step > i ? 'var(--hotel-primary)' : 'rgba(255,255,255,0.08)' }} />
                                )}
                            </div>
                        ))}
                        <p className="text-xs ml-2" style={{ color: 'rgba(240,235,227,0.3)' }}>
                            {step === 1 ? 'Confirmación' : 'Tus datos'}
                        </p>
                    </div>
                )}

                {/* Card container */}
                <div className="flex-1">
                    <AnimatePresence mode="wait">

                        {/* Step 1: Confirm identity */}
                        {step === 1 && (
                            <motion.div key="step1"
                                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.3 }}
                                className="rounded-3xl p-7 text-center space-y-6"
                                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>

                                <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center"
                                    style={{ background: 'rgba(201,150,74,0.12)', border: '1px solid rgba(201,150,74,0.25)' }}>
                                    <CheckCircle2 className="w-8 h-8" style={{ color: 'var(--hotel-primary)' }} />
                                </div>

                                <div>
                                    <h3 className="font-heading text-2xl font-bold text-white">¡Hola, {firstName}!</h3>
                                    {roomNumber && (
                                        <p className="mt-1" style={{ color: 'rgba(240,235,227,0.5)' }}>
                                            Habitación <span className="font-bold" style={{ color: 'var(--hotel-primary)' }}>{roomNumber}</span>
                                        </p>
                                    )}
                                    <p className="text-sm mt-3" style={{ color: 'rgba(240,235,227,0.35)' }}>
                                        Completá tu registro para agilizar la llegada al hotel.
                                    </p>
                                </div>

                                <button onClick={() => setStep(2)}
                                    className="w-full py-4 rounded-2xl font-heading font-bold text-[15px] tracking-wide flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                                    style={{ background: 'var(--hotel-primary)', color: '#080808' }}>
                                    Continuar <ArrowRight className="w-4 h-4" />
                                </button>
                            </motion.div>
                        )}

                        {/* Step 2: Legal data */}
                        {step === 2 && (
                            <motion.div key="step2"
                                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.3 }}
                                className="space-y-5">

                                {error && (
                                    <div className="flex items-start gap-2.5 p-3.5 rounded-2xl text-sm"
                                        style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#FCA5A5' }}>
                                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                        <span>{error}</span>
                                    </div>
                                )}

                                <div className="rounded-3xl p-6 space-y-5"
                                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>

                                    <div>
                                        <label className="text-[11px] font-semibold tracking-[0.15em] uppercase block mb-2"
                                            style={{ color: 'var(--hotel-primary)' }}>Nacionalidad</label>
                                        <select value={nationality} onChange={e => setNationality(e.target.value)}
                                            className="w-full py-3.5 px-4 rounded-2xl text-white text-sm outline-none appearance-none"
                                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                            <option value="">Seleccionar país...</option>
                                            {[['AR','Argentina'],['BR','Brasil'],['CL','Chile'],['UY','Uruguay'],['PY','Paraguay'],
                                              ['BO','Bolivia'],['PE','Perú'],['CO','Colombia'],['MX','México'],['US','EEUU'],
                                              ['ES','España'],['OT','Otra']].map(([v,l]) => (
                                                <option key={v} value={v}>{l}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-[11px] font-semibold tracking-[0.15em] uppercase block mb-2"
                                            style={{ color: 'var(--hotel-primary)' }}>DNI / Pasaporte</label>
                                        <input type="text" value={documentNumber}
                                            onChange={e => setDocumentNumber(e.target.value)}
                                            placeholder="Número de documento"
                                            className="w-full py-3.5 px-4 rounded-2xl text-white text-sm outline-none placeholder:opacity-30"
                                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
                                    </div>

                                    {/* Signature */}
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-[11px] font-semibold tracking-[0.15em] uppercase"
                                                style={{ color: 'var(--hotel-primary)' }}>Firma digital</label>
                                            {hasSigned && (
                                                <button onClick={clearCanvas}
                                                    className="flex items-center gap-1 text-[10px] uppercase tracking-wide"
                                                    style={{ color: 'rgba(240,235,227,0.35)' }}>
                                                    <Trash2 className="w-3 h-3" /> Limpiar
                                                </button>
                                            )}
                                        </div>
                                        <div className="rounded-2xl overflow-hidden relative" style={{ height: 120, background: 'rgba(255,255,255,0.95)' }}>
                                            <canvas ref={canvasRef}
                                                className="absolute inset-0 w-full h-full touch-none cursor-crosshair"
                                                onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
                                                onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} />
                                            {!hasSigned && (
                                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                    <span className="text-sm font-medium" style={{ color: 'rgba(8,8,8,0.25)' }}>
                                                        Firmá aquí
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-[10px] mt-1.5 text-center" style={{ color: 'rgba(240,235,227,0.25)' }}>
                                            Al firmar aceptás los términos y condiciones del hotel.
                                        </p>
                                    </div>
                                </div>

                                <button onClick={handleFinish} disabled={loading}
                                    className="w-full py-4 rounded-2xl font-heading font-bold text-[15px] tracking-wide flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60"
                                    style={{ background: 'var(--hotel-primary)', color: '#080808' }}>
                                    {loading
                                        ? <Loader2 className="w-5 h-5 animate-spin" />
                                        : <>Finalizar Check-in <ArrowRight className="w-4 h-4" /></>}
                                </button>
                            </motion.div>
                        )}

                        {/* Step 3: Success */}
                        {step === 3 && (
                            <motion.div key="step3"
                                initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.4 }}
                                className="rounded-3xl p-10 text-center space-y-6"
                                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>

                                <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center"
                                    style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', boxShadow: '0 0 40px rgba(16,185,129,0.2)' }}>
                                    <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                                </div>

                                <div>
                                    <h3 className="font-heading text-2xl font-bold text-white mb-2">
                                        {alreadyCheckedIn ? '¡Ya estás registrado!' : '¡Todo listo!'}
                                    </h3>
                                    <p className="text-sm leading-relaxed" style={{ color: 'rgba(240,235,227,0.45)' }}>
                                        {alreadyCheckedIn
                                            ? 'Tu check-in digital ya fue completado anteriormente.'
                                            : 'Tu check-in se completó. Solo pasá a retirar tu llave en recepción cuando llegues.'}
                                    </p>
                                </div>

                                {roomNumber && (
                                    <div className="py-3 px-6 rounded-2xl inline-block"
                                        style={{ background: 'rgba(201,150,74,0.1)', border: '1px solid rgba(201,150,74,0.2)' }}>
                                        <p className="text-[11px] uppercase tracking-wider mb-0.5" style={{ color: 'rgba(201,150,74,0.6)' }}>Tu habitación</p>
                                        <p className="font-heading text-3xl font-bold" style={{ color: 'var(--hotel-primary)' }}>{roomNumber}</p>
                                    </div>
                                )}

                                <button onClick={() => router.replace(`/${hotelId}`)}
                                    className="w-full py-4 rounded-2xl font-heading font-bold text-sm tracking-wide transition-all active:scale-[0.98]"
                                    style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(240,235,227,0.8)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                    Volver al inicio
                                </button>
                            </motion.div>
                        )}

                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
