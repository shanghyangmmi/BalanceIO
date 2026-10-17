"use client"

import { Suspense } from "react"
import { ContactDetail } from "@/components/contacts/contact-detail"

export default function ContactDetailPage() {
  return (
    <Suspense fallback={null}>
      <ContactDetail />
    </Suspense>
  )
}
