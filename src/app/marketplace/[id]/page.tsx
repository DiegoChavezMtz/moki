import { MarketplaceDetail } from "../../../features/marketplace/components/organisms/marketplace-detail.tsx";
export default async function MarketplaceDetailPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <MarketplaceDetail agentId={id} />; }
