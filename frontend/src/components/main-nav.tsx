import Link from "next/link"
import { siteConfig } from "@/config/site"
import { BookOpen } from "lucide-react"

export function MainNav() {
    return (
        <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 group">
                <div className="h-8 w-8 rounded-lg overflow-hidden shadow-lg shadow-[#0B3C3D]/20 group-hover:scale-105 transition-transform duration-300">
                    <img src="/images/logo-icon.svg" alt={siteConfig.name} className="h-full w-full object-cover" />
                </div>
                <span className="font-bold text-lg text-[#0B3C3D] dark:text-white tracking-wide">
                    {siteConfig.name}
                    <span className="text-[#0B3C3D]">.</span>
                </span>
            </Link>
            <nav className="hidden lg:flex items-center gap-6">
                <Link href="/features" className="text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-[#0B3C3D] dark:hover:text-emerald-400 transition-colors">
                    Features
                </Link>
                <Link href="/pricing" className="text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-[#0B3C3D] dark:hover:text-emerald-400 transition-colors">
                    Pricing
                </Link>
            </nav>
        </div>
    )
}
