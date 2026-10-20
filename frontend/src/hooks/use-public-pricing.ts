"use client"

import { useQuery } from "@tanstack/react-query"
import { siteConfig } from "@/config/site"
import { queryKeys } from "@/lib/query-keys"

/** Mirrors PublicPricingDto in backend PlansController. */
export interface PublicPlan {
    id: string
    name: string
    description: string | null
    priceMonthly: number
    priceYearly: number
    /** Set only while a promotion is running. */
    promoPriceMonthly: number | null
    promoEndsAt: string | null
    /** What a monthly checkout started now is charged. */
    effectivePriceMonthly: number
    highlights: string[]
    modules: string[]
    maxUsers: number
    maxCompanies: number
    /** 0 or less means unlimited. */
    maxJournalEntries: number
    isPopular: boolean
}

export interface PublicFeature {
    key: string
    name: string
    description: string | null
    module: string
    planIds: string[]
}

export interface PublicPricing {
    currency: "IDR"
    journalLimitWindow: string
    plans: PublicPlan[]
    features: PublicFeature[]
}

/**
 * Prices as the API will charge them. A plain fetch rather than apiClient:
 * the endpoint is anonymous, and apiClient would attach a session and
 * redirect to sign-in on a 401, neither of which a visitor should meet.
 */
export function usePublicPricing() {
    return useQuery<PublicPricing>({
        queryKey: queryKeys.publicPricing,
        queryFn: async () => {
            const res = await fetch(`${siteConfig.api.baseUrl}/Plans/public`)
            if (!res.ok) throw new Error(`Prices could not be loaded (${res.status}).`)
            return res.json()
        },
        staleTime: 60_000,
        retry: 1,
    })
}
