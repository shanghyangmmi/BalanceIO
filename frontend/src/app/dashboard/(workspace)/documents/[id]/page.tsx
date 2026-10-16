import { DocumentDetailView } from "@/components/documents/document-detail-view"

export async function generateStaticParams() {
    return [{ id: "1" }]
}

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    return <DocumentDetailView id={id} />
}
