"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/**
 * The audit trail lives at /dashboard/settings/audit-logs. This route used
 * to render a hard-coded list of invented events; it now forwards there so
 * an old bookmark lands on the real log.
 */
export default function AuditRedirectPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/dashboard/settings/audit-logs")
  }, [router])
  return null
}
