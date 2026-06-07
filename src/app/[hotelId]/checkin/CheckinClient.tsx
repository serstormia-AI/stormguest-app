"use client";

import { motion } from "framer-motion";
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

    // Step 2 — legal data
    const [nationality, setNationality] = useState("");
    const [documentNumber, setDocumentNumber] = useState("");

    // Signature canvas
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasSigned, setHasSigned] = useState(false);
    const lastPos = useRef<{ x: number; y: number } | null>(null);

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
        if ("touches" in e) {
            return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
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

    const endDraw = () => { setIsDrawing(false); lastPos.current = null; };

    const clearSignature = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
        setHasSigned(false);
    };

    const handleFinish = async () => {
        if (!nationality || !documentNumber) {
            setError("Completá tu nacionalidad y número de documento.");
            return;
        }
        if (!hasSigned) {
            setError("Firma en el recuadro antes de continuar.");
            return;
        }

        setLoading(true);
        setError(null);

        const signatureBase64 = canvasRef.current?.toDataURL("image/png") ?? null;

        const res = await fetch("/api/checkin/complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                guestId,
                reservationId,
                nationality,
                documentNumber,
                signature: signatureBase64,
            }),
        });

        setLoading(false);

        if (res.ok) {
            setStep(3);
        } else {
            const data = await res.json();
            setError(data.error || "Error al guardar. Intentá de nuevo.");
        }
    };

    return (
        <div className="flex-1 flex flex-col p-6 items-center justify-center max-w-md mx-auto w-full">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full space-y-8">

                {/* Header */}
                <div className="text-center space-y-2">
                    <h2 className="font-heading text-3xl font-bold text-white">Check-in Digital</h2>
                    <p className="text-stone-400 text-sm">Evitá la fila en recepción.</p>
                </div>

                {/* Steps */}
                {step < 3 && (
                    <div className="flex items-center justify-center space-x-4">
                        {[1, 2].map((i) => (
                            <div key={i} className="flex items-center">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                                    step >= i ? "bg-hotel-primary text-white" : "bg-white/5 text-stone-500"
                                }`}>
                                    {step > i ? <CheckCircle2 className="w-4 h-4" /> : i}
                                </div>
                                {i < 2 && <div className={`w-16 h-0.5 mx-2 ${step > i ? "bg-hotel-primary" : "bg-white/5"}`} />}
                            </div>
                        ))}
                    </div>
                )}

                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-xl">

                    {/* Step 1: Confirm identity */}
                    {step === 1 && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 text-center py-4">
                            <div className="w-16 h-16 bg-hotel-primary/20 rounded-full flex items-center justify-center mx-auto text-hotel-primary">
                                <CheckCircle2 className="w-8 h-8" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">¡Hola, {guestName.split(' ')[0]}!</h3>
                                {roomNumber && (
                                    <p className="text-stone-400 mt-1">Habitación <span className="text-hotel-primary font-bold">{roomNumber}</span></p>
                                )}
                                <p className="text-stone-500 text-sm mt-3">Completá tu registro para agilizar la llegada al hotel.</p>
                            </div>
                            <button
                                onClick={() => setStep(2)}
                                className="w-full bg-hotel-primary text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95"
                            >
                                Continuar <ArrowRight className="w-5 h-5" />
                            </button>
                        </motion.div>
                    )}

                    {/* Step 2: Legal data + signature */}
                    {step === 2 && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
                            <div className="text-center">
                                <h3 className="text-xl font-bold text-white">Tus datos</h3>
                                <p className="text-stone-400 text-sm mt-1">Requerimiento legal hotelero.</p>
                            </div>

                            {error && (
                                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm flex items-start gap-2">
                                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2 block">Nacionalidad</label>
                                    <select
                                        value={nationality}
                                        onChange={(e) => setNationality(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-hotel-primary transition-all appearance-none"
                                    >
                                        <option value="">País...</option>
                                        <option value="AR">Argentina</option>
                                        <option value="BR">Brasil</option>
                                        <option value="CL">Chile</option>
                                        <option value="UY">Uruguay</option>
                                        <option value="PY">Paraguay</option>
                                        <option value="BO">Bolivia</option>
                                        <option value="PE">Perú</option>
                                        <option value="CO">Colombia</option>
                                        <option value="MX">México</option>
                                        <option value="US">EEUU</option>
                                        <option value="ES">España</option>
                                        <option value="OT">Otra</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2 block">DNI / Pasaporte</label>
                                    <input
                                        type="text"
                                        value={documentNumber}
                                        onChange={(e) => setDocumentNumber(e.target.value)}
                                        placeholder="Nº documento"
                                        className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-hotel-primary transition-all placeholder:text-stone-600"
                                    />
                                </div>
                            </div>

                            {/* Signature */}
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
                                            <span className="text-stone-400 font-medium opacity-40 select-none">Firma aquí</span>
                                        </div>
                                    )}
                                    <button
                                        type="button"
                                        onClick={clearSignature}
                                        className="absolute bottom-2 right-2 z-10 flex items-center gap-1 text-[10px] uppercase font-bold text-stone-500 hover:text-red-500 bg-stone-100 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                                    >
                                        <Trash2 className="w-3 h-3" /> Limpiar
                                    </button>
                                </div>
                                <p className="text-[10px] text-stone-500 mt-2 text-center">Al firmar aceptás los términos y condiciones del hotel.</p>
                            </div>

                            <button
                                onClick={handleFinish}
                                disabled={loading}
                                className="w-full bg-hotel-primary text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 mt-2"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Finalizar Check-in <ArrowRight className="w-5 h-5" /></>}
                            </button>
                        </motion.div>
                    )}

                    {/* Step 3: Success */}
                    {step === 3 && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-10 space-y-6">
                            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto text-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                                <CheckCircle2 className="w-10 h-10" />
                            </div>
                            <div>
                                <h3 className="font-heading text-2xl font-bold text-white mb-2">
                                    {alreadyCheckedIn ? '¡Ya estás registrado!' : '¡Todo listo!'}
                                </h3>
                                <p className="text-stone-400">
                                    {alreadyCheckedIn
                                        ? 'Tu check-in digital ya fue completado.'
                                        : 'Tu check-in se completó. Solo pasá a retirar tu llave física en recepción.'}
                                </p>
                            </div>
                            <button
                                onClick={() => router.replace(`/${hotelId}`)}
                                className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-4 rounded-xl transition-all"
                            >
                                Volver al inicio
                            </button>
                        </motion.div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
