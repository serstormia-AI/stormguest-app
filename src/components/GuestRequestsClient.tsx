"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import { CheckCircle2, Clock, XCircle, Receipt, ShoppingBag } from "lucide-react";

type Request = {
    id: string;
    experience_id: string | null;
    total_price: number;
    status: string;
    created_at: string;
    experienceTitle?: string;
};

function statusBadge(status: string) {
    if (status === "approved") return { label: "Aprobado",  color: "#10b981", Icon: CheckCircle2 };
    if (status === "rejected") return { label: "Rechazado", color: "#ef4444", Icon: XCircle };
    return { label: "Pendiente", color: "#C9964A", Icon: Clock };
}

const supabase = createBrowserSupabase();

export default function GuestRequestsClient({
    guestId,
    compact = false,
}: {
    guestId: string;
    compact?: boolean;
}) {
    const [requests, setRequests] = useState<Request[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchRequests();

        // Realtime — listen for status updates on this guest's requests
        const channel = supabase
            .channel(`guest-requests-${guestId}`)
            .on("postgres_changes", {
                event: "*",
                schema: "public",
                table: "requests",
                filter: `guest_id=eq.${guestId}`,
            }, () => {
                fetchRequests(); // refetch on any change
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [guestId]);

    const fetchRequests = async () => {
        const { data: rawRequests } = await supabase
            .from("requests")
            .select("id, experience_id, total_price, status, created_at")
            .eq("guest_id", guestId)
            .order("created_at", { ascending: false })
            .limit(compact ? 5 : 50);

        if (!rawRequests) { setLoading(false); return; }

        // Two-step fetch — no FK join
        const expIds = [...new Set(rawRequests.map(r => r.experience_id).filter(Boolean))] as string[];
        let expMap: Record<string, string> = {};
        if (expIds.length > 0) {
            const { data: exps } = await supabase
                .from("experiences")
                .select("id, title")
                .in("id", expIds);
            if (exps) expMap = Object.fromEntries(exps.map(e => [e.id, e.title]));
        }

        setRequests(rawRequests.map(r => ({
            ...r,
            experienceTitle: expMap[r.experience_id ?? ""] || "Servicio",
        })));
        setLoading(false);
    };

    if (loading) {
        return (
            <div className="flex justify-center py-6">
                <div className="flex gap-1">
                    {[0,1,2].map(i => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce"
                            style={{ background: "var(--hotel-primary)", animationDelay: `${i*150}ms` }} />
                    ))}
                </div>
            </div>
        );
    }

    if (requests.length === 0) {
        if (compact) return null; // hide section if no requests
        return (
            <div className="p-8 text-center" style={{ background: "rgba(255,255,255,0.02)" }}>
                <ShoppingBag className="w-8 h-8 mx-auto mb-2" style={{ color: "rgba(240,235,227,0.15)" }} />
                <p className="text-sm" style={{ color: "rgba(240,235,227,0.3)" }}>Sin consumos adicionales.</p>
            </div>
        );
    }

    const totalFolio = requests.reduce((sum, r) => sum + Number(r.total_price), 0);

    // ── Compact mode (dashboard card) ─────────────────────────
    if (compact) {
        const pending = requests.filter(r => r.status === "pending").length;
        return (
            <div className="rounded-3xl overflow-hidden"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b"
                    style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                    <div className="flex items-center gap-2">
                        <Receipt className="w-4 h-4" style={{ color: "var(--hotel-primary)" }} />
                        <p className="text-sm font-semibold text-white">Mis pedidos</p>
                    </div>
                    {pending > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: "rgba(201,150,74,0.15)", color: "var(--hotel-primary)", border: "1px solid rgba(201,150,74,0.25)" }}>
                            {pending} pendiente{pending > 1 ? "s" : ""}
                        </span>
                    )}
                </div>

                {/* List */}
                {requests.slice(0, 3).map((req, i) => {
                    const { label, color, Icon } = statusBadge(req.status);
                    return (
                        <div key={req.id}
                            className="flex items-center justify-between px-5 py-3.5"
                            style={{ borderBottom: i < Math.min(requests.length, 3) - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                            <p className="text-sm text-white truncate flex-1 min-w-0 mr-3">{req.experienceTitle}</p>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <div className="flex items-center gap-1">
                                    <Icon className="w-3 h-3" style={{ color }} />
                                    <span className="text-[10px] uppercase tracking-wide font-medium" style={{ color }}>{label}</span>
                                </div>
                                <span className="font-heading font-bold text-white text-sm">${req.total_price}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }

    // ── Full mode (profile page) ───────────────────────────────
    return (
        <div className="rounded-3xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ background: "rgba(255,255,255,0.03)" }}>
                {requests.map((req, i) => {
                    const { label, color, Icon } = statusBadge(req.status);
                    return (
                        <div key={req.id}
                            className="flex items-center justify-between px-5 py-4"
                            style={{ borderBottom: i < requests.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">{req.experienceTitle}</p>
                                <p className="text-[11px] mt-0.5" style={{ color: "rgba(240,235,227,0.3)" }}>
                                    {new Date(req.created_at).toLocaleDateString("es", { day: "numeric", month: "short" })}
                                </p>
                            </div>
                            <div className="flex items-center gap-3 ml-4">
                                <div className="flex items-center gap-1">
                                    <Icon className="w-3 h-3" style={{ color }} />
                                    <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color }}>{label}</span>
                                </div>
                                <p className="font-heading font-bold text-white">${req.total_price}</p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Total */}
            <div className="flex items-center justify-between px-5 py-5"
                style={{ background: "rgba(201,150,74,0.06)", borderTop: "1px solid rgba(201,150,74,0.15)" }}>
                <div>
                    <p className="text-sm font-medium text-white">Total a pagar</p>
                    <p className="text-[11px] mt-0.5" style={{ color: "rgba(240,235,227,0.35)" }}>Se abona en recepción al check-out</p>
                </div>
                <p className="font-heading text-2xl font-bold" style={{ color: "var(--hotel-primary)" }}>
                    ${totalFolio.toFixed(2)}
                </p>
            </div>
        </div>
    );
}
