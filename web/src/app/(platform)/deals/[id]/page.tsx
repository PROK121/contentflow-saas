import { DealFlowView } from "@/components/deals/DealFlowView";

export default async function DealByIdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DealFlowView dealId={id} />;
}
