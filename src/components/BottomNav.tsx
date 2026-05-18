"use client";

import { Home, MessageCircle, User } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";

export default function BottomNav({ hotelId }: { hotelId: string }) {
    const pathname = usePathname();

    const navItems = [
        { icon: Home, label: "Inicio", path: `/${hotelId}` },
        { icon: MessageCircle, label: "Chat", path: `/${hotelId}/chat` },
        { icon: User, label: "Perfil", path: `/${hotelId}/profile` }
    ];
    if (pathname.endsWith("/checkin") || pathname.endsWith("/login")) {
        return null;
    }

    return (
        <div className="fixed bottom-0 left-0 w-full z-50 px-6 pb-8 pt-2 pointer-events-none">
            <div className="max-w-md mx-auto pointer-events-auto">
                {/* Floating pill style nav */}
                <div className="bg-[#0A0A0A]/80 backdrop-blur-2xl border border-white/5 rounded-full p-2 flex justify-between items-center shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
                    {navItems.map((item) => {
                        const isActive = pathname === item.path;
                        return (
                            <Link 
                                key={item.path} 
                                href={item.path}
                                className="relative flex flex-col items-center justify-center w-20 h-14 transition-colors z-10"
                            >
                                {isActive && (
                                    <motion.div 
                                        layoutId="activeNavIndicator"
                                        className="absolute inset-0 bg-white/10 rounded-full -z-10"
                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                    />
                                )}
                                <item.icon className={`w-6 h-6 transition-transform duration-300 ${isActive ? "text-hotel-primary scale-110" : "text-stone-500 hover:text-stone-300 scale-100"}`} />
                            </Link>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
