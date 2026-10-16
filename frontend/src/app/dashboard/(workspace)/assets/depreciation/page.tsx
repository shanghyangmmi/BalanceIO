"use client"

import { AssetChargeScreen } from "@/components/dashboard/assets/asset-charge-screen"

/**
 * Depreciation of tangible assets.
 *
 * This page used to loop over every asset calling POST /Assets/{id}/depreciate
 * one request at a time. None of those calls wrote a journal entry or checked
 * the period lock, and a failure halfway through left some assets charged and
 * some not, with no ledger record either way. It is one posted entry now.
 */
export default function DepreciationPage() {
  return <AssetChargeScreen kind="depreciation" />
}
