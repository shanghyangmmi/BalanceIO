"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"

/**
 * Global TanStack Query provider — the Zero-Delay data layer.
 *
 * Strategy:
 * - staleTime 30s: revisiting a page within 30s renders INSTANTLY from cache
 *   (no skeleton flash), then silently revalidates in the background.
 * - gcTime 10min: cache survives tab switches and back-navigation.
 * - refetchOnWindowFocus: refresh financial data when the user returns.
 * - retry 1: fail fast; the api-client already surfaces toasts.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
    // useState ensures a single client per browser session (safe for React 19 / RSC)
    const [client] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 30_000,
                        gcTime: 10 * 60_000,
                        refetchOnWindowFocus: true,
                        retry: 1,
                    },
                    mutations: {
                        retry: 0,
                    },
                },
            })
    )

    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
