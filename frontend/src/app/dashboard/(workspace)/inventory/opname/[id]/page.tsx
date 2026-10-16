import { StockOpnameDetailView } from "@/components/inventory/stock-opname-detail-view"

export async function generateStaticParams() {
    return [{ id: "1" }]
}

export default async function StockOpnameDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    return <StockOpnameDetailView id={id} />
}
