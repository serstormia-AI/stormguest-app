"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";

export default function LogoutButton({ hotelId }: { hotelId: string }) {
    const router = useRouter();

    const handleLogout = async () => {
        const supabase = createBrowserSupabase();
        await supabase.auth.signOut();
        router.replace(`/${hotelId}/login`);
    };

    return (
        <button
            onClick={handleLogout}
            className="w-full bg-zinc-900 border border-white/10 text-red-400 py-4 px-6 rounded-2xl flex justify-between items-center hover:bg-red-500/10 hover:border-red-500/20 transition-colors"
        >
            <span className="font-medium">Cerrar sesión</span>
            <LogOut className="w-5 h-5" />
        </button>
    );
}
