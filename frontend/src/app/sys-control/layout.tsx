"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
    LayoutDashboard,
    Users,
    Building2,
    CreditCard,
    ArrowLeft,
    Shield,
    Menu,
    X,
    Settings,
    Terminal,
    LogOut,
    Activity,
    Database,
    ScrollText,
    Tags
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, parseJwt } from "@/lib/utils";

interface LayoutProps {
    children: React.ReactNode;
}

/**
 * Grouped, because the panel now does four different jobs and a flat list
 * of nine rows makes them look like nine equal choices. Who is on the
 * platform, what they are sold, how the server is running, and the two
 * screens that can break it.
 */
const adminNavGroups = [
    {
        label: "Platform",
        items: [
            { title: "Overview", href: "/sys-control/dashboard", icon: LayoutDashboard },
            { title: "Users", href: "/sys-control/users", icon: Users },
            { title: "Companies", href: "/sys-control/companies", icon: Building2 },
        ],
    },
    {
        label: "Commercial",
        items: [
            { title: "Plans & pricing", href: "/sys-control/licensing", icon: Tags },
            { title: "Subscriptions", href: "/sys-control/subscriptions", icon: CreditCard },
        ],
    },
    {
        label: "Running it",
        items: [
            { title: "Operations", href: "/sys-control/operations", icon: Activity },
            { title: "Activity log", href: "/sys-control/activity", icon: ScrollText },
            { title: "Configuration", href: "/sys-control/configuration", icon: Settings },
        ],
    },
    {
        label: "Direct access",
        items: [
            { title: "Database", href: "/sys-control/database", icon: Database },
            { title: "Server actions", href: "/sys-control/server", icon: Terminal },
        ],
    },
];

export default function AdminLayout({ children }: LayoutProps) {

    const pathname = usePathname();
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(true);

    useEffect(() => {
        // Normalize path to ignore trailing slash and handle exact login path
        const isLogin = pathname === "/sys-control/login" || pathname === "/sys-control/login/";

        if (isLogin) {
            setIsAuthorized(true);
            setIsLoading(false);
            return;
        }

        const checkAccess = () => {
            const token = localStorage.getItem("adminToken");

            if (!token) {
                window.location.href = "/sys-control/login";
                return;
            }

            try {
                const user = parseJwt(token);
                // Check for standard role claim OR Microsoft specific role claim
                const role = user?.["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] || user?.role || "";

                if (role !== "Admin" && role !== "SuperAdmin") {
                    // console.log("Access Denied: User is not Admin. Role:", role);
                    // If they have a token but wrong role, maybe they are a normal user trying to access admin?
                    // But adminToken should ONLY contain admins.
                    // Just in case, redirect to login
                    window.location.href = "/sys-control/login";
                    return;
                }
                setIsAuthorized(true);
            } catch (e) {
                // Invalid token
                localStorage.removeItem("adminToken");
                window.location.href = "/sys-control/login";
            } finally {
                setIsLoading(false);
            }
        };

        checkAccess();
    }, [pathname]);

    // Check if we are on the login page
    const isLoginPage = pathname === "/sys-control/login" || pathname === "/sys-control/login/";

    if (isLoading) {
        return (
            <div className="h-screen flex items-center justify-center bg-background">
                <div className="animate-pulse text-muted-foreground">Verifying access...</div>
            </div>
        );
    }

    if (!isAuthorized) {
        return null;
    }

    // Full screen layout for login page
    if (isLoginPage) {
        return (
            <main className="min-h-screen bg-background">
                {children}
            </main>
        );
    }

    return (
        <div className="flex h-screen bg-background">
            {/* Sidebar */}
            <aside className={cn(
                "fixed inset-y-0 left-0 z-50 flex flex-col bg-card border-r transition-all duration-300",
                sidebarOpen ? "w-64" : "w-16"
            )}>
                {/* Header */}
                <div className="flex items-center gap-2 p-4 border-b">
                    <div className="p-2 rounded-lg bg-red-500/10 shrink-0">
                        <Shield className="h-5 w-5 text-red-500" />
                    </div>
                    {sidebarOpen && (
                        <div>
                            <h2 className="font-bold text-lg">Admin</h2>
                            <p className="text-xs text-muted-foreground">Superadmin Panel</p>
                        </div>
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="ml-auto"
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                    >
                        {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                    </Button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto p-2 space-y-5">
                    {adminNavGroups.map((group) => (
                        <div key={group.label} className="space-y-1">
                            {sidebarOpen && (
                                <div className="px-3 pb-1 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70">
                                    {group.label}
                                </div>
                            )}
                            {group.items.map((item) => {
                                const isActive =
                                    pathname === item.href ||
                                    (pathname?.startsWith(item.href) &&
                                        item.href !== "/sys-control/dashboard");
                                return (
                                    <Link key={item.href} href={item.href}>
                                        <div className={cn(
                                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                                            isActive
                                                ? "bg-foreground/[0.06] text-foreground"
                                                : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground"
                                        )}>
                                            <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                                            {sidebarOpen && <span>{item.title}</span>}
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    ))}
                </nav>

                {/* Footer */}
                <div className="p-2 border-t">
                    <Button
                        variant="ghost"
                        className={cn("w-full text-red-500 hover:text-red-600 hover:bg-red-50 justify-start", !sidebarOpen && "px-2 justify-center")}
                        onClick={() => {
                            localStorage.removeItem("adminToken");
                            window.location.href = "/sys-control/login";
                        }}
                    >
                        <LogOut className="h-4 w-4" />
                        {sidebarOpen && <span className="ml-2">Logout</span>}
                    </Button>
                </div>
            </aside>

            {/* Main Content */}
            <main className={cn(
                "flex-1 overflow-auto transition-all duration-300",
                sidebarOpen ? "ml-64" : "ml-16"
            )}>
                <div className="p-6">
                    {children}
                </div>
            </main>
        </div>
    );
}
