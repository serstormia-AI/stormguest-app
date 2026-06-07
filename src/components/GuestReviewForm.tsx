"use client";

import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import { Star, Send, CheckCircle2 } from "lucide-react";

type Props = {
    guestId: string;
    dbHotelId: string;
    reservationId: string | null;
};

const supabase = createBrowserSupabase();

export default function GuestReviewForm({ guestId, dbHotelId, reservationId }: Props) {
    const [rating, setRating] = useState(0);
    const [hovered, setHovered] = useState(0);
    const [comment, setComment] = useState("");
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async () => {
        if (rating === 0) return;
        setLoading(true);
        setError(null);

        const { error: err } = await supabase.from("reviews").insert({
            hotel_id: dbHotelId,   // text field in reviews table
            guest_id: guestId,
            reservation_id: reservationId || null,
            rating,
            comment: comment.trim() || null,
        });

        setLoading(false);
        if (err) {
            setError("No se pudo enviar la reseña. Intentá de nuevo.");
        } else {
            setSubmitted(true);
        }
    };

    if (submitted) {
        return (
            <div className="rounded-3xl p-8 text-center"
                style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)" }}>
                <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-400" />
                <p className="font-heading font-bold text-white text-lg">¡Gracias por tu reseña!</p>
                <p className="text-sm mt-1" style={{ color: "rgba(240,235,227,0.45)" }}>
                    Tu opinión nos ayuda a mejorar.
                </p>
            </div>
        );
    }

    return (
        <div className="rounded-3xl p-6 space-y-5"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>

            <div>
                <p className="text-[11px] tracking-[0.2em] uppercase mb-1" style={{ color: "var(--hotel-primary)" }}>
                    Tu opinión importa
                </p>
                <h3 className="font-heading text-lg font-bold text-white">¿Cómo fue tu estadía?</h3>
            </div>

            {/* Star picker */}
            <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                    <button
                        key={star}
                        type="button"
                        onMouseEnter={() => setHovered(star)}
                        onMouseLeave={() => setHovered(0)}
                        onClick={() => setRating(star)}
                        className="transition-transform active:scale-90"
                    >
                        <Star
                            className="w-9 h-9 transition-colors"
                            style={{
                                color: star <= (hovered || rating) ? "var(--hotel-primary)" : "rgba(255,255,255,0.12)",
                                fill: star <= (hovered || rating) ? "var(--hotel-primary)" : "transparent",
                            }}
                        />
                    </button>
                ))}
            </div>

            {rating > 0 && (
                <p className="text-sm" style={{ color: "rgba(240,235,227,0.5)" }}>
                    {["", "Muy malo", "Malo", "Regular", "Bueno", "¡Excelente!"][rating]}
                </p>
            )}

            {/* Comment */}
            <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Contanos tu experiencia (opcional)..."
                rows={3}
                className="w-full text-sm text-white placeholder:opacity-30 outline-none resize-none rounded-2xl px-4 py-3"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            />

            {error && (
                <p className="text-sm text-red-400">{error}</p>
            )}

            <button
                onClick={handleSubmit}
                disabled={rating === 0 || loading}
                className="w-full py-3.5 rounded-2xl font-heading font-bold text-sm tracking-wide flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40"
                style={{ background: "var(--hotel-primary)", color: "#080808" }}
            >
                <Send className="w-4 h-4" />
                {loading ? "Enviando..." : "Enviar reseña"}
            </button>
        </div>
    );
}
