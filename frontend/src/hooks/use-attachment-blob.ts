"use client"

import * as React from "react"

import { siteConfig } from "@/config/site"

/**
 * Fetches an attachment with credentials and hands back a blob URL.
 *
 * An &lt;img src&gt; or &lt;iframe src&gt; carries no Authorization header, which
 * is why the preview endpoint had been opened to anonymous callers - and
 * that made every company's scanned invoices and bank statements readable
 * by anyone holding an id. The endpoint is closed again; the browser
 * fetches the bytes itself, with the token and the company header, and
 * renders the result from memory.
 *
 * The URLs were also relative ("/api/attachments/..."), which on a static
 * export points at the Next.js server rather than the API. Both the
 * preview and the download link were reaching the wrong origin.
 */
export function useAttachmentBlob(id: string | undefined, kind: "preview" | "download" = "preview") {
  const [url, setUrl] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (!id) {
      setUrl(null)
      setError(null)
      return
    }

    let revoked: string | null = null
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        const headers: Record<string, string> = {}

        const token = localStorage.getItem("token")
        if (token) headers.Authorization = `Bearer ${token}`

        const companyId = localStorage.getItem("selectedCompanyId")
        if (companyId) headers["X-Company-Id"] = companyId

        const response = await fetch(`${siteConfig.api.baseUrl}/attachments/${id}/${kind}`, {
          headers,
        })

        if (!response.ok) {
          throw new Error(
            response.status === 404
              ? "That attachment is not available."
              : `The server answered ${response.status}.`,
          )
        }

        const blob = await response.blob()

        // A component can unmount while the fetch is in flight. Creating
        // the URL anyway would leak it, since the cleanup below has
        // already run.
        if (cancelled) return

        revoked = URL.createObjectURL(blob)
        setUrl(revoked)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load the file.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
      if (revoked) URL.revokeObjectURL(revoked)
    }
  }, [id, kind])

  return { url, error, loading }
}

/**
 * Downloads an attachment through the same authenticated path and saves it
 * under its own name.
 */
export async function downloadAttachment(id: string, fileName: string) {
  const headers: Record<string, string> = {}

  const token = localStorage.getItem("token")
  if (token) headers.Authorization = `Bearer ${token}`

  const companyId = localStorage.getItem("selectedCompanyId")
  if (companyId) headers["X-Company-Id"] = companyId

  const response = await fetch(`${siteConfig.api.baseUrl}/attachments/${id}/download`, {
    headers,
  })

  if (!response.ok) {
    throw new Error(`The server answered ${response.status}.`)
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)

  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()

  URL.revokeObjectURL(url)
}
