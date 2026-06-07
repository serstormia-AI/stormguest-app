"use client";

import { Home, MessageCircle, User } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";

export default function BottomNav({ hotelId }: { hotelId: string }) {
    const pathname = usePathname();

    if (pathname.includes("/checkin") || pathname.includes("/login")) return null;

    const navItems = [
        { icon: Home,          label: "Inicio", path: `/${hotelId}` },
        { icon: MessageCircle, label: "Chat",   path: `/${hotelId}/chat` },
        { icon: User,          label: "Perfil", path: `/${hotelId}/profile` },
    ];

    return (
        <div className="fixed bottom-0 left-0 w-full z-50 px-5 pb-7 pt-2 pointer-events-none">
            <div className="max-w-xs mx-auto pointer-events-auto">
                <div className="flex justify-around items-center px-2 py-2 rounded-[2rem]"
                    style={{
                        background: 'rgba(18,18,18,0.85)',
                        border: '1px solid rgba(255,255,255,0.07)',
                        backdropFilter: 'blur(28px)',
                        WebkitBackdropFilter: 'blur(28px)',
                        boxShadow: '0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03) inset',
                    }}>
                    {navItems.map((item) => {
                        const isActive = pathname === item.path;
                        return (
                            <Link
                                key={item.path}
                                href={item.path}
                                className="relative flex flex-col items-center justify-center w-20 h-14 rounded-2xl transition-all z-10"
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="activeNav"
                                        className="absolute inset-0 rounded-2xl -z-10"
                                        style={{ background: 'rgba(255,255,255,0.07)' }}
                                        transition={{ type: "spring", stiffness: 450, damping: 32 }}
                                    />
                                )}
                                <item.icon
                                    className={`w-5 h-5 transition-all duration-200 ${isActive ? 'scale-110' : 'scale-100'}`}
                                    style={{ color: isActive ? 'var(--hotel-primary)' : 'rgba(240,235,227,0.3)' }}
                                />
                                <span className="text-[10px] mt-1 font-medium tracking-wide"
                                    style={{ color: isActive ? 'var(--hotel-primary)' : 'rgba(240,235,227,0.25)' }}>
                                    {item.label}
                                </span>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
